-- =============================================================================
-- MANAGERS OBSERVE, ADMINS ACT — app-wide (user decision 2026-11-06)
-- -----------------------------------------------------------------------------
-- Roles:  Employee 0 · Supervisor 10 (a badge only, no extra rights)
--         Manager 20 — an employee who can SEE more (team rota, timesheets,
--                      team, requests); never changes anything of others
--         Admin 30+ — plans the rota, edits timesheets, decides requests,
--                      posts announcements, sets templates/coverage/etc.
-- Every write that was open to rank >= 20 becomes rank >= 30. Read policies
-- for rank >= 20 stay (that's the managers' observer view). time_off and
-- name-change reviews were already moved in 20261106120000_requests_inbox.
-- =============================================================================

-- --- Rota ---------------------------------------------------------------------
DROP POLICY IF EXISTS "scheduled_insert" ON public.scheduled_shifts;
CREATE POLICY "scheduled_insert" ON public.scheduled_shifts FOR INSERT TO authenticated
  WITH CHECK (is_superadmin() OR (my_role_rank() >= 30 AND organization_id = get_my_org_id()));
DROP POLICY IF EXISTS "scheduled_update" ON public.scheduled_shifts;
CREATE POLICY "scheduled_update" ON public.scheduled_shifts FOR UPDATE TO authenticated
  USING (is_superadmin() OR (my_role_rank() >= 30 AND organization_id = get_my_org_id()))
  WITH CHECK (is_superadmin() OR (my_role_rank() >= 30 AND organization_id = get_my_org_id()));
DROP POLICY IF EXISTS "scheduled_delete" ON public.scheduled_shifts;
CREATE POLICY "scheduled_delete" ON public.scheduled_shifts FOR DELETE TO authenticated
  USING (is_superadmin() OR (my_role_rank() >= 30 AND organization_id = get_my_org_id()));

DROP POLICY IF EXISTS "roster_insert" ON public.location_roster;
CREATE POLICY "roster_insert" ON public.location_roster FOR INSERT TO authenticated
  WITH CHECK (is_superadmin() OR (my_role_rank() >= 30 AND organization_id = get_my_org_id()));
DROP POLICY IF EXISTS "roster_delete" ON public.location_roster;
CREATE POLICY "roster_delete" ON public.location_roster FOR DELETE TO authenticated
  USING (is_superadmin() OR (my_role_rank() >= 30 AND organization_id = get_my_org_id()));

CREATE OR REPLACE FUNCTION public.publish_schedule(p_from timestamp with time zone, p_to timestamp with time zone)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_total integer;
BEGIN
  IF my_role_rank() < 30 AND NOT is_superadmin() THEN
    RAISE EXCEPTION 'not allowed';
  END IF;

  WITH upd AS (
    UPDATE public.scheduled_shifts
    SET published = true
    WHERE published = false
      AND starts_at >= p_from AND starts_at < p_to
      AND (organization_id = get_my_org_id() OR is_superadmin())
    RETURNING organization_id, user_id
  ), notif AS (
    INSERT INTO public.shift_audit_log (organization_id, shift_id, actor_id, target_user_id, action, details)
    SELECT organization_id, NULL, auth.uid(),
           CASE WHEN user_id IS DISTINCT FROM auth.uid() THEN user_id END,
           'schedule_published',
           jsonb_build_object(
             'actor_name', COALESCE(public._display_name(auth.uid()), 'System'),
             'target_name', public._display_name(user_id),
             'count', count(*),
             'month_start', p_from
           )
    FROM upd
    GROUP BY organization_id, user_id
    RETURNING 1
  )
  SELECT count(*) INTO v_total FROM upd;
  RETURN COALESCE(v_total, 0);
END;
$function$;

-- Assigning people to someone's team is an admin action now.
CREATE OR REPLACE FUNCTION public.claim_member(p_member uuid, p_claim boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_caller uuid := auth.uid();
  v_caller_rank int := my_role_rank();
  v_target public.profiles%ROWTYPE;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not signed in.';
  END IF;
  IF v_caller_rank < 30 AND NOT is_superadmin() THEN
    RAISE EXCEPTION 'Only admins can manage a team.';
  END IF;
  IF p_member = v_caller THEN
    RAISE EXCEPTION 'You cannot manage yourself.';
  END IF;

  SELECT * INTO v_target FROM public.profiles WHERE id = p_member;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Member not found.';
  END IF;
  IF v_target.organization_id <> get_my_org_id() AND NOT is_superadmin() THEN
    RAISE EXCEPTION 'Member is not in your organization.';
  END IF;
  IF role_rank(v_target.role) >= v_caller_rank AND NOT is_superadmin() THEN
    RAISE EXCEPTION 'You can only manage members below your role.';
  END IF;

  IF p_claim THEN
    IF v_target.manager_id IS NOT NULL AND v_target.manager_id <> v_caller THEN
      RAISE EXCEPTION 'This member already has a manager.';
    END IF;
    UPDATE public.profiles SET manager_id = v_caller WHERE id = p_member;
  ELSE
    IF v_target.manager_id IS DISTINCT FROM v_caller AND NOT is_superadmin() THEN
      RAISE EXCEPTION 'This member is not on your team.';
    END IF;
    UPDATE public.profiles SET manager_id = NULL WHERE id = p_member;
  END IF;
END;
$function$;

-- --- Timesheets (worked shifts: create / edit / delete for others) --------------
CREATE OR REPLACE FUNCTION public._authorize_shift_admin(p_target_user_id uuid)
RETURNS profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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

  IF public.is_superadmin() THEN
    RETURN v_target;
  END IF;

  -- Admin+ (>= 30), same organization, strictly out-ranking the target.
  IF v_rank < 30
     OR v_target.organization_id <> public.get_my_org_id()
     OR public.role_rank(v_target.role) >= v_rank THEN
    RAISE EXCEPTION 'You are not allowed to manage this member''s shifts.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN v_target;
END;
$function$;

-- --- Announcements --------------------------------------------------------------
DROP POLICY IF EXISTS "announcements_insert" ON public.announcements;
CREATE POLICY "announcements_insert" ON public.announcements FOR INSERT TO authenticated
  WITH CHECK (is_superadmin() OR (my_role_rank() >= 30 AND organization_id = get_my_org_id() AND author_id = (SELECT auth.uid())));
DROP POLICY IF EXISTS "announcements_update" ON public.announcements;
CREATE POLICY "announcements_update" ON public.announcements FOR UPDATE TO authenticated
  USING (is_superadmin() OR (my_role_rank() >= 30 AND organization_id = get_my_org_id()))
  WITH CHECK (is_superadmin() OR (my_role_rank() >= 30 AND organization_id = get_my_org_id()));
DROP POLICY IF EXISTS "announcements_delete" ON public.announcements;
CREATE POLICY "announcements_delete" ON public.announcements FOR DELETE TO authenticated
  USING (is_superadmin() OR (my_role_rank() >= 30 AND organization_id = get_my_org_id()));

-- --- v1.10 planning tables ------------------------------------------------------
DROP POLICY IF EXISTS "coverage_write" ON public.coverage_requirements;
CREATE POLICY "coverage_write" ON public.coverage_requirements FOR ALL TO authenticated
  USING (is_superadmin() OR (my_role_rank() >= 30 AND organization_id = get_my_org_id()))
  WITH CHECK (is_superadmin() OR (my_role_rank() >= 30 AND organization_id = get_my_org_id()));

DROP POLICY IF EXISTS "shift_templates_write" ON public.shift_templates;
CREATE POLICY "shift_templates_write" ON public.shift_templates FOR ALL TO authenticated
  USING (is_superadmin() OR (my_role_rank() >= 30 AND organization_id = get_my_org_id()))
  WITH CHECK (is_superadmin() OR (my_role_rank() >= 30 AND organization_id = get_my_org_id()));

DROP POLICY IF EXISTS "location_settings_write" ON public.location_settings;
CREATE POLICY "location_settings_write" ON public.location_settings FOR ALL TO authenticated
  USING (is_superadmin() OR (my_role_rank() >= 30 AND organization_id = get_my_org_id()))
  WITH CHECK (is_superadmin() OR (my_role_rank() >= 30 AND organization_id = get_my_org_id()));

DROP POLICY IF EXISTS "open_shifts_insert" ON public.open_shifts;
CREATE POLICY "open_shifts_insert" ON public.open_shifts FOR INSERT TO authenticated
  WITH CHECK (is_superadmin() OR (my_role_rank() >= 30 AND organization_id = get_my_org_id() AND created_by = (SELECT auth.uid())));
DROP POLICY IF EXISTS "open_shifts_update" ON public.open_shifts;
CREATE POLICY "open_shifts_update" ON public.open_shifts FOR UPDATE TO authenticated
  USING (organization_id = get_my_org_id() AND (my_role_rank() >= 30 OR claimed_by IS NULL OR claimed_by = (SELECT auth.uid())))
  WITH CHECK (organization_id = get_my_org_id() AND (my_role_rank() >= 30 OR claimed_by IS NULL OR claimed_by = (SELECT auth.uid())));
DROP POLICY IF EXISTS "open_shifts_delete" ON public.open_shifts;
CREATE POLICY "open_shifts_delete" ON public.open_shifts FOR DELETE TO authenticated
  USING (is_superadmin() OR (my_role_rank() >= 30 AND organization_id = get_my_org_id()));

CREATE OR REPLACE FUNCTION public.open_shifts_guard_member_edits()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF is_superadmin() OR my_role_rank() >= 30 THEN
    RETURN NEW;
  END IF;
  IF (NEW.organization_id, NEW.location_id, NEW.role, NEW.starts_at, NEW.ends_at, NEW.note, NEW.created_by)
     IS DISTINCT FROM
     (OLD.organization_id, OLD.location_id, OLD.role, OLD.starts_at, OLD.ends_at, OLD.note, OLD.created_by) THEN
    RAISE EXCEPTION 'Only admins can change an open shift''s details' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP POLICY IF EXISTS "shift_conf_delete" ON public.shift_confirmations;
CREATE POLICY "shift_conf_delete" ON public.shift_confirmations FOR DELETE TO authenticated
  USING (is_superadmin() OR (my_role_rank() >= 30 AND organization_id = get_my_org_id()));

NOTIFY pgrst, 'reload schema';
