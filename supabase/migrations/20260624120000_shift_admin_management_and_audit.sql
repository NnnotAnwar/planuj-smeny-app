-- =====================================================================
-- SHIFT ADMIN MANAGEMENT + AUDIT LOG
-- ---------------------------------------------------------------------
-- Lets managers and above (rank >= 20) create / edit / delete shifts for
-- members ranked below them (Superadmin: anyone), and records every such
-- administrative change in an append-only audit log that Admins+ (rank >= 30)
-- can review.
--
-- Why RPCs instead of broad RLS on `shifts`:
--   The normal RLS only lets a user touch their OWN shifts. Rather than open
--   up INSERT/UPDATE/DELETE on `shifts` to managers (easy to get subtly wrong
--   and risky), all administrative writes go through SECURITY DEFINER RPCs that
--   (a) enforce the rank/org rules in one place and (b) write the audit row
--   atomically with the change. Employee self clock-in/out keeps its existing
--   path untouched, so the hot path and the audit log stay clean.
-- =====================================================================

-- ---------------------------------------------------------------------
-- AUDIT LOG TABLE
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.shift_audit_log (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  -- Not a FK: the shift may later be deleted, but the audit entry must survive.
  shift_id        uuid,
  actor_id        uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  target_user_id  uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  action          text NOT NULL CHECK (action IN ('create', 'update', 'delete')),
  -- Snapshot of names + before/after values so the log stays readable even
  -- after profiles are renamed or the shift/location is removed.
  details         jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS shift_audit_log_org_created_idx
  ON public.shift_audit_log (organization_id, created_at DESC);

ALTER TABLE public.shift_audit_log ENABLE ROW LEVEL SECURITY;

-- Reads: Admins+ (rank >= 30) see their organization's log; Superadmin sees all.
-- There are deliberately NO write policies — the only writer is the SECURITY
-- DEFINER RPCs below.
DROP POLICY IF EXISTS "Admins view org shift audit log" ON public.shift_audit_log;
CREATE POLICY "Admins view org shift audit log"
  ON public.shift_audit_log FOR SELECT TO authenticated
  USING (public.my_role_rank() >= 30 AND organization_id = public.get_my_org_id());

DROP POLICY IF EXISTS "Superadmin full access to shift audit log" ON public.shift_audit_log;
CREATE POLICY "Superadmin full access to shift audit log"
  ON public.shift_audit_log FOR ALL TO authenticated
  USING (public.is_superadmin()) WITH CHECK (public.is_superadmin());

-- ---------------------------------------------------------------------
-- INTERNAL HELPER: authorize the caller to manage a target member's shifts,
-- returning the target profile. Raises on any violation.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._authorize_shift_admin(p_target_user_id uuid)
RETURNS public.profiles
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_actor  uuid := auth.uid();
  v_rank   smallint := public.my_role_rank();
  v_target public.profiles%ROWTYPE;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Not authenticated.' USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT * INTO v_target FROM public.profiles WHERE id = p_target_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Member not found.' USING ERRCODE = 'no_data_found';
  END IF;

  -- Superadmin may manage anyone, anywhere.
  IF public.is_superadmin() THEN
    RETURN v_target;
  END IF;

  -- Everyone else: manager+ (>= 20), same organization, strictly out-ranking
  -- the target (mirrors canManageMember in the UI).
  IF v_rank < 20
     OR v_target.organization_id <> public.get_my_org_id()
     OR public.role_rank(v_target.role) >= v_rank THEN
    RAISE EXCEPTION 'You are not allowed to manage this member''s shifts.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN v_target;
END;
$$;

REVOKE EXECUTE ON FUNCTION public._authorize_shift_admin(uuid) FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------
-- INTERNAL HELPER: validate a location belongs to an org, return its name.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._shift_location_name(p_location_id uuid, p_org_id uuid)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_name text;
  v_org  uuid;
BEGIN
  SELECT name, organization_id INTO v_name, v_org
  FROM public.locations WHERE id = p_location_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Location not found.' USING ERRCODE = 'no_data_found';
  END IF;
  IF v_org <> p_org_id THEN
    RAISE EXCEPTION 'Location belongs to another organization.' USING ERRCODE = 'check_violation';
  END IF;
  RETURN v_name;
END;
$$;

REVOKE EXECUTE ON FUNCTION public._shift_location_name(uuid, uuid) FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------
-- INTERNAL HELPER: best-effort display name for the audit snapshot.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._display_name(p_user_id uuid)
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(
    NULLIF(btrim(concat_ws(' ', first_name, last_name)), ''),
    username,
    'Unknown'
  )
  FROM public.profiles WHERE id = p_user_id;
$$;

REVOKE EXECUTE ON FUNCTION public._display_name(uuid) FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------
-- RPC: create a shift for a member
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_create_shift(
  p_user_id     uuid,
  p_location_id uuid,
  p_started_at  timestamptz,
  p_ended_at    timestamptz DEFAULT NULL,
  p_role        text DEFAULT NULL
) RETURNS public.shifts
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_actor   uuid := auth.uid();
  v_target  public.profiles%ROWTYPE;
  v_loc_name text;
  v_role    text;
  v_shift   public.shifts%ROWTYPE;
BEGIN
  v_target := public._authorize_shift_admin(p_user_id);

  IF p_started_at IS NULL THEN
    RAISE EXCEPTION 'A start time is required.' USING ERRCODE = 'check_violation';
  END IF;
  IF p_ended_at IS NOT NULL AND p_ended_at <= p_started_at THEN
    RAISE EXCEPTION 'The end time must be after the start time.' USING ERRCODE = 'check_violation';
  END IF;

  v_loc_name := public._shift_location_name(p_location_id, v_target.organization_id);
  v_role := COALESCE(NULLIF(btrim(p_role), ''), v_target.role);

  INSERT INTO public.shifts (user_id, location_id, organization_id, started_at, ended_at, role)
  VALUES (p_user_id, p_location_id, v_target.organization_id, p_started_at, p_ended_at, v_role)
  RETURNING * INTO v_shift;

  INSERT INTO public.shift_audit_log (organization_id, shift_id, actor_id, target_user_id, action, details)
  VALUES (
    v_target.organization_id, v_shift.id, v_actor, p_user_id, 'create',
    jsonb_build_object(
      'actor_name',  public._display_name(v_actor),
      'target_name', public._display_name(p_user_id),
      'new', jsonb_build_object(
        'started_at', p_started_at, 'ended_at', p_ended_at,
        'location_id', p_location_id, 'location_name', v_loc_name, 'role', v_role
      )
    )
  );

  RETURN v_shift;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_create_shift(uuid, uuid, timestamptz, timestamptz, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_create_shift(uuid, uuid, timestamptz, timestamptz, text) TO authenticated;

-- ---------------------------------------------------------------------
-- RPC: update a member's shift
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_update_shift(
  p_shift_id    uuid,
  p_started_at  timestamptz,
  p_ended_at    timestamptz,
  p_location_id uuid
) RETURNS public.shifts
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_actor    uuid := auth.uid();
  v_old      public.shifts%ROWTYPE;
  v_target   public.profiles%ROWTYPE;
  v_old_loc  text;
  v_new_loc  text;
  v_shift    public.shifts%ROWTYPE;
BEGIN
  SELECT * INTO v_old FROM public.shifts WHERE id = p_shift_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Shift not found.' USING ERRCODE = 'no_data_found';
  END IF;

  v_target := public._authorize_shift_admin(v_old.user_id);

  IF p_started_at IS NULL THEN
    RAISE EXCEPTION 'A start time is required.' USING ERRCODE = 'check_violation';
  END IF;
  IF p_ended_at IS NOT NULL AND p_ended_at <= p_started_at THEN
    RAISE EXCEPTION 'The end time must be after the start time.' USING ERRCODE = 'check_violation';
  END IF;

  v_new_loc := public._shift_location_name(p_location_id, v_old.organization_id);
  SELECT name INTO v_old_loc FROM public.locations WHERE id = v_old.location_id;

  UPDATE public.shifts
     SET started_at  = p_started_at,
         ended_at    = p_ended_at,
         location_id = p_location_id
   WHERE id = p_shift_id
   RETURNING * INTO v_shift;

  INSERT INTO public.shift_audit_log (organization_id, shift_id, actor_id, target_user_id, action, details)
  VALUES (
    v_old.organization_id, p_shift_id, v_actor, v_old.user_id, 'update',
    jsonb_build_object(
      'actor_name',  public._display_name(v_actor),
      'target_name', public._display_name(v_old.user_id),
      'old', jsonb_build_object(
        'started_at', v_old.started_at, 'ended_at', v_old.ended_at,
        'location_id', v_old.location_id, 'location_name', v_old_loc
      ),
      'new', jsonb_build_object(
        'started_at', p_started_at, 'ended_at', p_ended_at,
        'location_id', p_location_id, 'location_name', v_new_loc
      )
    )
  );

  RETURN v_shift;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_update_shift(uuid, timestamptz, timestamptz, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_update_shift(uuid, timestamptz, timestamptz, uuid) TO authenticated;

-- ---------------------------------------------------------------------
-- RPC: delete a member's shift
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_delete_shift(p_shift_id uuid)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_actor  uuid := auth.uid();
  v_old    public.shifts%ROWTYPE;
  v_loc    text;
BEGIN
  SELECT * INTO v_old FROM public.shifts WHERE id = p_shift_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Shift not found.' USING ERRCODE = 'no_data_found';
  END IF;

  PERFORM public._authorize_shift_admin(v_old.user_id);

  SELECT name INTO v_loc FROM public.locations WHERE id = v_old.location_id;

  DELETE FROM public.shifts WHERE id = p_shift_id;

  INSERT INTO public.shift_audit_log (organization_id, shift_id, actor_id, target_user_id, action, details)
  VALUES (
    v_old.organization_id, p_shift_id, v_actor, v_old.user_id, 'delete',
    jsonb_build_object(
      'actor_name',  public._display_name(v_actor),
      'target_name', public._display_name(v_old.user_id),
      'old', jsonb_build_object(
        'started_at', v_old.started_at, 'ended_at', v_old.ended_at,
        'location_id', v_old.location_id, 'location_name', v_loc, 'role', v_old.role
      )
    )
  );

  RETURN true;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_delete_shift(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_delete_shift(uuid) TO authenticated;
