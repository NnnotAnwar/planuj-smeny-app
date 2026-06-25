-- =====================================================================
-- SHIFT OVERLAP GUARD
-- ---------------------------------------------------------------------
-- Adds an overlap check to the admin shift RPCs so a member can't have two
-- shifts that overlap in time (which would double-count their hours). Uses a
-- tstzrange intersection; an open shift (ended_at IS NULL) is treated as running
-- to +infinity. admin_update_shift excludes the row being edited.
--
-- Redefines admin_create_shift / admin_update_shift in full (CREATE OR REPLACE
-- preserves their existing grants).
-- =====================================================================

CREATE OR REPLACE FUNCTION public.admin_create_shift(
  p_user_id     uuid,
  p_location_id uuid,
  p_started_at  timestamptz,
  p_ended_at    timestamptz DEFAULT NULL,
  p_role        text DEFAULT NULL
) RETURNS public.shifts
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_actor    uuid := auth.uid();
  v_target   public.profiles%ROWTYPE;
  v_loc_name text;
  v_role     text;
  v_shift    public.shifts%ROWTYPE;
BEGIN
  v_target := public._authorize_shift_admin(p_user_id);

  IF p_started_at IS NULL THEN
    RAISE EXCEPTION 'A start time is required.' USING ERRCODE = 'check_violation';
  END IF;
  IF p_ended_at IS NOT NULL AND p_ended_at <= p_started_at THEN
    RAISE EXCEPTION 'The end time must be after the start time.' USING ERRCODE = 'check_violation';
  END IF;

  -- Reject overlap with any existing shift of this member.
  IF EXISTS (
    SELECT 1 FROM public.shifts s
    WHERE s.user_id = p_user_id
      AND tstzrange(s.started_at, COALESCE(s.ended_at, 'infinity'::timestamptz), '[)')
          && tstzrange(p_started_at, COALESCE(p_ended_at, 'infinity'::timestamptz), '[)')
  ) THEN
    RAISE EXCEPTION 'This shift overlaps an existing shift for this member.'
      USING ERRCODE = 'check_violation';
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

GRANT EXECUTE ON FUNCTION public.admin_create_shift(uuid, uuid, timestamptz, timestamptz, text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_create_shift(uuid, uuid, timestamptz, timestamptz, text) FROM PUBLIC, anon;

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

  -- Reject overlap with this member's OTHER shifts.
  IF EXISTS (
    SELECT 1 FROM public.shifts s
    WHERE s.user_id = v_old.user_id
      AND s.id <> p_shift_id
      AND tstzrange(s.started_at, COALESCE(s.ended_at, 'infinity'::timestamptz), '[)')
          && tstzrange(p_started_at, COALESCE(p_ended_at, 'infinity'::timestamptz), '[)')
  ) THEN
    RAISE EXCEPTION 'This shift overlaps an existing shift for this member.'
      USING ERRCODE = 'check_violation';
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

GRANT EXECUTE ON FUNCTION public.admin_update_shift(uuid, timestamptz, timestamptz, uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_update_shift(uuid, timestamptz, timestamptz, uuid) FROM PUBLIC, anon;
