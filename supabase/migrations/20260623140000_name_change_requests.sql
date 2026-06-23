-- =============================================================================
-- NAME-CHANGE REQUESTS + USERNAME WEEKLY LIMIT
-- -----------------------------------------------------------------------------
-- Staff (rank < 30) may no longer change their own first/last name directly —
-- they submit a request that an admin (rank >= 30, same org) or a Superadmin
-- approves; approval applies the new name to the profile automatically.
--
-- Username stays self-service but is limited to one change every 7 days, for
-- everyone (tracked via profiles.username_changed_at).
--
-- Enforcement is at the database level (a BEFORE UPDATE trigger), so the rules
-- hold even for direct API calls — the UI only mirrors them.
-- =============================================================================

-- 1. Track when the username was last changed -------------------------------
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS username_changed_at timestamptz;

-- 2. Requests table ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.name_change_requests (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  organization_id      uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  current_first_name   text,
  current_last_name    text,
  requested_first_name text,
  requested_last_name  text,
  note                 text,          -- optional message from the requester
  review_note          text,          -- optional message from the reviewer
  status               text NOT NULL DEFAULT 'pending'
                         CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by          uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at          timestamptz,
  created_at           timestamptz NOT NULL DEFAULT now()
);

-- At most one pending request per user.
CREATE UNIQUE INDEX IF NOT EXISTS one_pending_name_change_per_user
  ON public.name_change_requests (user_id) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS name_change_requests_org_status_idx
  ON public.name_change_requests (organization_id, status);

ALTER TABLE public.name_change_requests ENABLE ROW LEVEL SECURITY;

-- Writes go through SECURITY DEFINER RPCs only; clients get SELECT (under RLS).
REVOKE ALL              ON public.name_change_requests FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.name_change_requests FROM authenticated;
GRANT  SELECT           ON public.name_change_requests TO authenticated;
GRANT  ALL              ON public.name_change_requests TO service_role;

-- RLS: requester sees own; admins see their org; superadmin sees everything.
DROP POLICY IF EXISTS "View own name change requests" ON public.name_change_requests;
CREATE POLICY "View own name change requests"
  ON public.name_change_requests FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins view org name change requests" ON public.name_change_requests;
CREATE POLICY "Admins view org name change requests"
  ON public.name_change_requests FOR SELECT TO authenticated
  USING (public.my_role_rank() >= 30 AND organization_id = public.get_my_org_id());

DROP POLICY IF EXISTS "Superadmin full access to name change requests" ON public.name_change_requests;
CREATE POLICY "Superadmin full access to name change requests"
  ON public.name_change_requests FOR ALL TO authenticated
  USING (public.is_superadmin()) WITH CHECK (public.is_superadmin());

-- 3. Self-edit enforcement trigger ------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_profile_self_edit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_rank  smallint := public.my_role_rank();
BEGIN
  -- NAME: first/last name changes are gated for non-admins (rank < 30).
  IF (NEW.first_name IS DISTINCT FROM OLD.first_name)
     OR (NEW.last_name IS DISTINCT FROM OLD.last_name) THEN

    IF OLD.first_name IS NULL AND OLD.last_name IS NULL THEN
      NULL;  -- onboarding: first-time name entry is allowed
    ELSIF public.is_superadmin() THEN
      NULL;  -- superadmin may set any name
    ELSIF v_actor = NEW.id AND v_rank >= 30 THEN
      NULL;  -- admins may edit their own name
    ELSIF v_actor <> NEW.id AND v_rank >= 30
          AND OLD.organization_id = public.get_my_org_id()
          AND public.role_rank(OLD.role) < v_rank THEN
      NULL;  -- admins may edit a lower-ranked member (incl. approving a request)
    ELSE
      RAISE EXCEPTION 'Name changes must be requested from an administrator.'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  -- USERNAME: at most one change every 7 days, for everyone.
  IF NEW.username IS DISTINCT FROM OLD.username THEN
    IF OLD.username_changed_at IS NOT NULL
       AND now() - OLD.username_changed_at < interval '7 days' THEN
      RAISE EXCEPTION
        'You can only change your username once every 7 days. Next change available after %.',
        to_char(OLD.username_changed_at + interval '7 days', 'YYYY-MM-DD HH24:MI UTC')
        USING ERRCODE = 'check_violation';
    END IF;
    NEW.username_changed_at := now();
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.enforce_profile_self_edit() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS enforce_profile_self_edit_trigger ON public.profiles;
CREATE TRIGGER enforce_profile_self_edit_trigger
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.enforce_profile_self_edit();

-- 4. RPC: submit a name-change request --------------------------------------
CREATE OR REPLACE FUNCTION public.request_name_change(
  p_first_name text,
  p_last_name  text,
  p_note       text DEFAULT NULL
) RETURNS public.name_change_requests
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid     uuid := auth.uid();
  v_profile public.profiles%ROWTYPE;
  v_first   text := NULLIF(btrim(p_first_name), '');
  v_last    text := NULLIF(btrim(p_last_name), '');
  v_row     public.name_change_requests;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF v_first IS NULL AND v_last IS NULL THEN
    RAISE EXCEPTION 'Provide a first and/or last name.' USING ERRCODE = 'check_violation';
  END IF;

  SELECT * INTO v_profile FROM public.profiles WHERE id = v_uid;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found.' USING ERRCODE = 'no_data_found';
  END IF;

  -- Fall back to the current value for any field the requester left blank.
  v_first := COALESCE(v_first, v_profile.first_name);
  v_last  := COALESCE(v_last,  v_profile.last_name);

  IF v_first IS NOT DISTINCT FROM v_profile.first_name
     AND v_last IS NOT DISTINCT FROM v_profile.last_name THEN
    RAISE EXCEPTION 'The requested name matches your current name.' USING ERRCODE = 'check_violation';
  END IF;

  INSERT INTO public.name_change_requests (
    user_id, organization_id,
    current_first_name, current_last_name,
    requested_first_name, requested_last_name, note
  ) VALUES (
    v_uid, v_profile.organization_id,
    v_profile.first_name, v_profile.last_name,
    v_first, v_last, NULLIF(btrim(p_note), '')
  )
  RETURNING * INTO v_row;

  RETURN v_row;
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'You already have a pending name change request.' USING ERRCODE = 'unique_violation';
END;
$$;

REVOKE ALL  ON FUNCTION public.request_name_change(text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_name_change(text, text, text) TO authenticated;

-- 5. RPC: cancel your own pending request -----------------------------------
CREATE OR REPLACE FUNCTION public.cancel_name_change_request(p_id uuid)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_deleted int;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  DELETE FROM public.name_change_requests
   WHERE id = p_id AND user_id = v_uid AND status = 'pending';
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted > 0;
END;
$$;

REVOKE ALL  ON FUNCTION public.cancel_name_change_request(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_name_change_request(uuid) TO authenticated;

-- 6. RPC: approve / reject a request (admins same org, or superadmin) --------
CREATE OR REPLACE FUNCTION public.review_name_change_request(
  p_id          uuid,
  p_approve     boolean,
  p_review_note text DEFAULT NULL
) RETURNS public.name_change_requests
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid  uuid := auth.uid();
  v_rank smallint := public.my_role_rank();
  v_req  public.name_change_requests;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated.' USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT * INTO v_req FROM public.name_change_requests WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request not found.' USING ERRCODE = 'no_data_found';
  END IF;
  IF v_req.status <> 'pending' THEN
    RAISE EXCEPTION 'This request has already been reviewed.' USING ERRCODE = 'check_violation';
  END IF;

  -- Superadmin anywhere; otherwise admin (>= 30) within the same organization.
  IF NOT public.is_superadmin() THEN
    IF v_rank < 30 OR v_req.organization_id <> public.get_my_org_id() THEN
      RAISE EXCEPTION 'You are not allowed to review this request.'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
  END IF;

  IF p_approve THEN
    UPDATE public.profiles
       SET first_name = v_req.requested_first_name,
           last_name  = v_req.requested_last_name
     WHERE id = v_req.user_id;
  END IF;

  UPDATE public.name_change_requests
     SET status      = CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END,
         review_note = NULLIF(btrim(p_review_note), ''),
         reviewed_by = v_uid,
         reviewed_at = now()
   WHERE id = p_id
   RETURNING * INTO v_req;

  RETURN v_req;
END;
$$;

REVOKE ALL  ON FUNCTION public.review_name_change_request(uuid, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.review_name_change_request(uuid, boolean, text) TO authenticated;
