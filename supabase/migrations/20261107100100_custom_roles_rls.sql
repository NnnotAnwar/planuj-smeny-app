-- CUSTOM ROLES, part 2 — RLS policies and RPCs move from rank thresholds to
-- has_permission(area, action). See 20261107100000_custom_roles.sql.

-- =============================================================================
-- RLS: rank thresholds → area permissions (same outcome for the presets)
-- `(SELECT has_permission(...))` is evaluated once per statement, not per row.
-- =============================================================================
-- Rota
DROP POLICY IF EXISTS "scheduled_select" ON public.scheduled_shifts;
CREATE POLICY "scheduled_select" ON public.scheduled_shifts FOR SELECT TO authenticated
  USING (is_superadmin() OR ((SELECT has_permission('rota', 'read')) AND organization_id = get_my_org_id()) OR (user_id = (SELECT auth.uid()) AND published));
DROP POLICY IF EXISTS "scheduled_insert" ON public.scheduled_shifts;
CREATE POLICY "scheduled_insert" ON public.scheduled_shifts FOR INSERT TO authenticated
  WITH CHECK (is_superadmin() OR ((SELECT has_permission('rota', 'write')) AND organization_id = get_my_org_id()));
DROP POLICY IF EXISTS "scheduled_update" ON public.scheduled_shifts;
CREATE POLICY "scheduled_update" ON public.scheduled_shifts FOR UPDATE TO authenticated
  USING (is_superadmin() OR ((SELECT has_permission('rota', 'write')) AND organization_id = get_my_org_id()))
  WITH CHECK (is_superadmin() OR ((SELECT has_permission('rota', 'write')) AND organization_id = get_my_org_id()));
DROP POLICY IF EXISTS "scheduled_delete" ON public.scheduled_shifts;
CREATE POLICY "scheduled_delete" ON public.scheduled_shifts FOR DELETE TO authenticated
  USING (is_superadmin() OR ((SELECT has_permission('rota', 'delete')) AND organization_id = get_my_org_id()));

DROP POLICY IF EXISTS "roster_insert" ON public.location_roster;
CREATE POLICY "roster_insert" ON public.location_roster FOR INSERT TO authenticated
  WITH CHECK (is_superadmin() OR ((SELECT has_permission('rota', 'write')) AND organization_id = get_my_org_id()));
DROP POLICY IF EXISTS "roster_delete" ON public.location_roster;
CREATE POLICY "roster_delete" ON public.location_roster FOR DELETE TO authenticated
  USING (is_superadmin() OR ((SELECT has_permission('rota', 'write')) AND organization_id = get_my_org_id()));

DROP POLICY IF EXISTS "coverage_write" ON public.coverage_requirements;
CREATE POLICY "coverage_write" ON public.coverage_requirements FOR ALL TO authenticated
  USING (is_superadmin() OR ((SELECT has_permission('rota', 'write')) AND organization_id = get_my_org_id()))
  WITH CHECK (is_superadmin() OR ((SELECT has_permission('rota', 'write')) AND organization_id = get_my_org_id()));

DROP POLICY IF EXISTS "shift_templates_write" ON public.shift_templates;
CREATE POLICY "shift_templates_write" ON public.shift_templates FOR ALL TO authenticated
  USING (is_superadmin() OR ((SELECT has_permission('rota', 'write')) AND organization_id = get_my_org_id()))
  WITH CHECK (is_superadmin() OR ((SELECT has_permission('rota', 'write')) AND organization_id = get_my_org_id()));

DROP POLICY IF EXISTS "open_shifts_insert" ON public.open_shifts;
CREATE POLICY "open_shifts_insert" ON public.open_shifts FOR INSERT TO authenticated
  WITH CHECK (is_superadmin() OR ((SELECT has_permission('rota', 'write')) AND organization_id = get_my_org_id() AND created_by = (SELECT auth.uid())));
DROP POLICY IF EXISTS "open_shifts_update" ON public.open_shifts;
CREATE POLICY "open_shifts_update" ON public.open_shifts FOR UPDATE TO authenticated
  USING (organization_id = get_my_org_id() AND ((SELECT has_permission('rota', 'write')) OR claimed_by IS NULL OR claimed_by = (SELECT auth.uid())))
  WITH CHECK (organization_id = get_my_org_id() AND ((SELECT has_permission('rota', 'write')) OR claimed_by IS NULL OR claimed_by = (SELECT auth.uid())));
DROP POLICY IF EXISTS "open_shifts_delete" ON public.open_shifts;
CREATE POLICY "open_shifts_delete" ON public.open_shifts FOR DELETE TO authenticated
  USING (is_superadmin() OR ((SELECT has_permission('rota', 'delete')) AND organization_id = get_my_org_id()));

DROP POLICY IF EXISTS "shift_conf_select" ON public.shift_confirmations;
CREATE POLICY "shift_conf_select" ON public.shift_confirmations FOR SELECT TO authenticated
  USING (is_superadmin() OR user_id = (SELECT auth.uid()) OR ((SELECT has_permission('rota', 'read')) AND organization_id = get_my_org_id()));
DROP POLICY IF EXISTS "shift_conf_delete" ON public.shift_confirmations;
CREATE POLICY "shift_conf_delete" ON public.shift_confirmations FOR DELETE TO authenticated
  USING (is_superadmin() OR ((SELECT has_permission('rota', 'write')) AND organization_id = get_my_org_id()));

DROP POLICY IF EXISTS "availability_select" ON public.availability;
CREATE POLICY "availability_select" ON public.availability FOR SELECT TO authenticated
  USING (is_superadmin() OR user_id = (SELECT auth.uid()) OR ((SELECT has_permission('rota', 'read')) AND organization_id = get_my_org_id()));

-- Requests (planners also need to see leave on the rota)
DROP POLICY IF EXISTS "timeoff_select" ON public.time_off;
CREATE POLICY "timeoff_select" ON public.time_off FOR SELECT TO authenticated
  USING (is_superadmin() OR user_id = (SELECT auth.uid())
         OR (((SELECT has_permission('requests', 'read')) OR (SELECT has_permission('rota', 'read'))) AND organization_id = get_my_org_id()));
DROP POLICY IF EXISTS "timeoff_delete" ON public.time_off;
CREATE POLICY "timeoff_delete" ON public.time_off FOR DELETE TO authenticated
  USING (is_superadmin() OR (user_id = (SELECT auth.uid()) AND status = 'pending')
         OR ((SELECT has_permission('requests', 'delete')) AND organization_id = get_my_org_id()));

DROP POLICY IF EXISTS "ncr_select" ON public.name_change_requests;
CREATE POLICY "ncr_select" ON public.name_change_requests FOR SELECT TO authenticated
  USING (is_superadmin() OR user_id = (SELECT auth.uid()) OR ((SELECT has_permission('requests', 'read')) AND organization_id = get_my_org_id()));

DROP POLICY IF EXISTS "shift_swaps_select" ON public.shift_swaps;
CREATE POLICY "shift_swaps_select" ON public.shift_swaps FOR SELECT TO authenticated
  USING (is_superadmin() OR (organization_id = get_my_org_id() AND (
          from_user = (SELECT auth.uid()) OR taker_id = (SELECT auth.uid()) OR to_user = (SELECT auth.uid())
          OR (status = 'open' AND to_user IS NULL) OR (SELECT has_permission('requests', 'read')))));

CREATE OR REPLACE FUNCTION public.can_review_request(requester uuid, org uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT public.is_superadmin()
      OR (public.has_permission('requests', 'write')
          AND org = public.get_my_org_id()
          AND (requester <> auth.uid() OR public.my_role_rank() >= 40));
$$;

-- Announcements
DROP POLICY IF EXISTS "announcements_insert" ON public.announcements;
CREATE POLICY "announcements_insert" ON public.announcements FOR INSERT TO authenticated
  WITH CHECK (is_superadmin() OR ((SELECT has_permission('announcements', 'write')) AND organization_id = get_my_org_id() AND author_id = (SELECT auth.uid())));
DROP POLICY IF EXISTS "announcements_update" ON public.announcements;
CREATE POLICY "announcements_update" ON public.announcements FOR UPDATE TO authenticated
  USING (is_superadmin() OR ((SELECT has_permission('announcements', 'write')) AND organization_id = get_my_org_id()))
  WITH CHECK (is_superadmin() OR ((SELECT has_permission('announcements', 'write')) AND organization_id = get_my_org_id()));
DROP POLICY IF EXISTS "announcements_delete" ON public.announcements;
CREATE POLICY "announcements_delete" ON public.announcements FOR DELETE TO authenticated
  USING (is_superadmin() OR ((SELECT has_permission('announcements', 'delete')) AND organization_id = get_my_org_id()));
DROP POLICY IF EXISTS "ann_reads_select" ON public.announcement_reads;
CREATE POLICY "ann_reads_select" ON public.announcement_reads FOR SELECT TO authenticated
  USING (is_superadmin() OR user_id = (SELECT auth.uid()) OR ((SELECT has_permission('announcements', 'read')) AND organization_id = get_my_org_id()));

-- Members (hierarchy stays rank-based: only members below your level)
DROP POLICY IF EXISTS "profiles_update" ON public.profiles;
CREATE POLICY "profiles_update" ON public.profiles FOR UPDATE TO authenticated
  USING (is_superadmin() OR (SELECT auth.uid()) = id
         OR ((SELECT has_permission('members', 'write')) AND organization_id = get_my_org_id() AND role_rank(role) < my_role_rank()))
  WITH CHECK (is_superadmin() OR (SELECT auth.uid()) = id
         OR (organization_id = get_my_org_id() AND role_rank(role) < my_role_rank()));
DROP POLICY IF EXISTS "profiles_delete" ON public.profiles;
CREATE POLICY "profiles_delete" ON public.profiles FOR DELETE TO authenticated
  USING (is_superadmin() OR ((SELECT has_permission('members', 'delete')) AND organization_id = get_my_org_id()
         AND role_rank(role) < my_role_rank() AND id <> (SELECT auth.uid())));

-- Wages
DROP POLICY IF EXISTS "member_wages_select" ON public.member_wages;
CREATE POLICY "member_wages_select" ON public.member_wages FOR SELECT TO authenticated
  USING (is_superadmin() OR user_id = (SELECT auth.uid()) OR ((SELECT has_permission('wages', 'read')) AND is_my_subordinate(user_id)));
DROP POLICY IF EXISTS "member_wages_write" ON public.member_wages;
CREATE POLICY "member_wages_write" ON public.member_wages FOR ALL TO authenticated
  USING (is_superadmin() OR ((SELECT has_permission('wages', 'write')) AND is_my_subordinate(user_id)))
  WITH CHECK (is_superadmin() OR ((SELECT has_permission('wages', 'write')) AND organization_id = get_my_org_id() AND is_my_subordinate(user_id)));

-- Locations
DROP POLICY IF EXISTS "locations_insert" ON public.locations;
CREATE POLICY "locations_insert" ON public.locations FOR INSERT TO authenticated
  WITH CHECK (is_superadmin() OR ((SELECT has_permission('locations', 'write')) AND organization_id = get_my_org_id()));
DROP POLICY IF EXISTS "locations_update" ON public.locations;
CREATE POLICY "locations_update" ON public.locations FOR UPDATE TO authenticated
  USING (is_superadmin() OR ((SELECT has_permission('locations', 'write')) AND organization_id = get_my_org_id()))
  WITH CHECK (is_superadmin() OR ((SELECT has_permission('locations', 'write')) AND organization_id = get_my_org_id()));
DROP POLICY IF EXISTS "locations_delete" ON public.locations;
CREATE POLICY "locations_delete" ON public.locations FOR DELETE TO authenticated
  USING (is_superadmin() OR ((SELECT has_permission('locations', 'delete')) AND organization_id = get_my_org_id()));
DROP POLICY IF EXISTS "location_settings_write" ON public.location_settings;
CREATE POLICY "location_settings_write" ON public.location_settings FOR ALL TO authenticated
  USING (is_superadmin() OR ((SELECT has_permission('locations', 'write')) AND organization_id = get_my_org_id()))
  WITH CHECK (is_superadmin() OR ((SELECT has_permission('locations', 'write')) AND organization_id = get_my_org_id()));

-- Activity log
DROP POLICY IF EXISTS "sal_select" ON public.shift_audit_log;
CREATE POLICY "sal_select" ON public.shift_audit_log FOR SELECT TO authenticated
  USING (is_superadmin() OR target_user_id = (SELECT auth.uid()) OR ((SELECT has_permission('activity', 'read')) AND organization_id = get_my_org_id()));

-- =============================================================================
-- Triggers / RPCs
-- =============================================================================
CREATE OR REPLACE FUNCTION public.enforce_profile_privilege()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role
     OR NEW.organization_id IS DISTINCT FROM OLD.organization_id
     OR NEW.org_role_id IS DISTINCT FROM OLD.org_role_id THEN

    IF public.is_superadmin() THEN
      RETURN NEW;
    END IF;

    IF public.has_permission('members', 'write')
       AND OLD.organization_id = public.get_my_org_id()
       AND NEW.organization_id = OLD.organization_id          -- non-superadmins can't move orgs
       AND public.role_rank(OLD.role) < public.my_role_rank()  -- target ranked below me
       AND public.role_rank(NEW.role) < public.my_role_rank()  -- new level ranked below me
       AND OLD.id <> auth.uid()                               -- never your own role
    THEN
      RETURN NEW;
    END IF;

    RAISE EXCEPTION 'You are not allowed to change the role or organization of this user.';
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.enforce_profile_self_edit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_actor uuid := auth.uid();
  v_rank  smallint := public.my_role_rank();
  v_edit  boolean := public.has_permission('members', 'write');
BEGIN
  IF (NEW.first_name IS DISTINCT FROM OLD.first_name)
     OR (NEW.last_name IS DISTINCT FROM OLD.last_name) THEN
    IF OLD.first_name IS NULL AND OLD.last_name IS NULL THEN
      NULL;
    ELSIF public.is_superadmin() THEN
      NULL;
    ELSIF v_actor = NEW.id AND v_edit THEN
      NULL;
    ELSIF v_actor <> NEW.id AND v_edit
          AND OLD.organization_id = public.get_my_org_id()
          AND public.role_rank(OLD.role) < v_rank THEN
      NULL;
    ELSE
      RAISE EXCEPTION 'Name changes must be requested from an administrator.'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

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
$function$;

CREATE OR REPLACE FUNCTION public._notify_late(p_user uuid, p_manager uuid, p_org uuid, p_action text, p_name text, p_loc text, p_start timestamp with time zone, p_minutes integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_details jsonb := jsonb_build_object(
    'target_name', p_name, 'location_name', p_loc,
    'scheduled_start', p_start, 'minutes', p_minutes
  );
  v_admin uuid;
BEGIN
  INSERT INTO public.shift_audit_log (organization_id, shift_id, actor_id, target_user_id, action, details)
  VALUES (p_org, NULL, NULL, p_user, p_action, v_details);

  IF p_manager IS NOT NULL THEN
    INSERT INTO public.shift_audit_log (organization_id, shift_id, actor_id, target_user_id, action, details)
    VALUES (p_org, NULL, NULL, p_manager, p_action, v_details);
  ELSE
    -- No team lead: tell the people who plan the rota.
    FOR v_admin IN
      SELECT id FROM public.profiles
      WHERE organization_id = p_org AND public.profile_has_permission(id, 'rota', 'write') AND id <> p_user
    LOOP
      INSERT INTO public.shift_audit_log (organization_id, shift_id, actor_id, target_user_id, action, details)
      VALUES (p_org, NULL, NULL, v_admin, p_action, v_details);
    END LOOP;
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.publish_schedule(p_from timestamp with time zone, p_to timestamp with time zone)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_total integer;
BEGIN
  IF NOT public.has_permission('rota', 'write') THEN
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
  IF NOT public.has_permission('rota', 'write') THEN
    RAISE EXCEPTION 'You are not allowed to manage a team.';
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

  -- Timesheet editors, same organization, strictly out-ranking the target.
  IF NOT public.has_permission('timesheets', 'write')
     OR v_target.organization_id <> public.get_my_org_id()
     OR public.role_rank(v_target.role) >= v_rank THEN
    RAISE EXCEPTION 'You are not allowed to manage this member''s shifts.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN v_target;
END;
$function$;

CREATE OR REPLACE FUNCTION public.open_shifts_guard_member_edits()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF public.has_permission('rota', 'write') THEN
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

CREATE OR REPLACE FUNCTION public.review_name_change_request(p_id uuid, p_approve boolean, p_review_note text DEFAULT NULL::text)
RETURNS name_change_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid  uuid := auth.uid();
  v_rank smallint := public.my_role_rank();
  v_req  public.name_change_requests;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated.' USING ERRCODE = 'insufficient_privilege'; END IF;
  SELECT * INTO v_req FROM public.name_change_requests WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Request not found.' USING ERRCODE = 'no_data_found'; END IF;
  IF v_req.status <> 'pending' THEN RAISE EXCEPTION 'This request has already been reviewed.' USING ERRCODE = 'check_violation'; END IF;
  IF NOT public.is_superadmin() THEN
    IF NOT public.has_permission('requests', 'write') OR v_req.organization_id <> public.get_my_org_id() THEN
      RAISE EXCEPTION 'You are not allowed to review this request.' USING ERRCODE = 'insufficient_privilege';
    END IF;
    IF v_req.user_id = v_uid AND v_rank < 40 THEN
      RAISE EXCEPTION 'You cannot review your own request.' USING ERRCODE = 'insufficient_privilege';
    END IF;
  END IF;
  IF p_approve THEN
    PERFORM set_config('app.suppress_profile_audit', 'on', true);
    UPDATE public.profiles SET first_name = v_req.requested_first_name, last_name = v_req.requested_last_name WHERE id = v_req.user_id;
  END IF;
  UPDATE public.name_change_requests
     SET status = CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END,
         review_note = NULLIF(btrim(p_review_note), ''), reviewed_by = v_uid, reviewed_at = now()
   WHERE id = p_id RETURNING * INTO v_req;
  INSERT INTO public.shift_audit_log (organization_id, shift_id, actor_id, target_user_id, action, details)
  VALUES (v_req.organization_id, NULL, v_uid, v_req.user_id,
    CASE WHEN p_approve THEN 'name_request_approved' ELSE 'name_request_rejected' END,
    jsonb_build_object('actor_name', public._display_name(v_uid), 'target_name', public._display_name(v_req.user_id),
      'old_name', btrim(concat_ws(' ', v_req.current_first_name, v_req.current_last_name)),
      'new_name', btrim(concat_ws(' ', v_req.requested_first_name, v_req.requested_last_name)),
      'note', NULLIF(btrim(p_review_note), '')));
  RETURN v_req;
END;
$function$;

CREATE OR REPLACE FUNCTION public.notify_time_off()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_details jsonb := jsonb_build_object(
    'actor_name', COALESCE(public._display_name(auth.uid()), 'System'),
    'target_name', public._display_name(NEW.user_id),
    'kind', NEW.kind,
    'starts_on', NEW.starts_on,
    'ends_on', NEW.ends_on,
    'note', NULLIF(btrim(NEW.review_note), '')
  );
  v_recipient uuid;
BEGIN
  IF TG_OP = 'INSERT' AND NEW.status = 'pending' THEN
    FOR v_recipient IN
      SELECT id FROM public.profiles
      WHERE organization_id = NEW.organization_id AND public.profile_has_permission(id, 'requests', 'write') AND id <> NEW.user_id
    LOOP
      INSERT INTO public.shift_audit_log (organization_id, shift_id, actor_id, target_user_id, action, details)
      VALUES (NEW.organization_id, NULL, NEW.user_id, v_recipient, 'timeoff_requested', v_details);
    END LOOP;
  ELSIF NEW.status IN ('approved', 'declined')
        AND (TG_OP = 'INSERT' OR OLD.status = 'pending') THEN
    INSERT INTO public.shift_audit_log (organization_id, shift_id, actor_id, target_user_id, action, details)
    VALUES (
      NEW.organization_id, NULL, auth.uid(),
      CASE WHEN NEW.user_id IS DISTINCT FROM auth.uid() THEN NEW.user_id END,
      CASE WHEN NEW.status = 'approved' THEN 'timeoff_approved' ELSE 'timeoff_declined' END,
      v_details
    );
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.take_shift_swap(p_id uuid)
RETURNS public.shift_swaps
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid    uuid := auth.uid();
  v_swap   public.shift_swaps;
  v_shift  public.scheduled_shifts;
  v_reason text;
  v_admins uuid[];
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not signed in.' USING ERRCODE = 'insufficient_privilege'; END IF;
  SELECT * INTO v_swap FROM public.shift_swaps WHERE id = p_id FOR UPDATE;
  IF NOT FOUND OR v_swap.organization_id <> get_my_org_id() THEN
    RAISE EXCEPTION 'Swap not found.' USING ERRCODE = 'no_data_found';
  END IF;
  IF v_swap.status <> 'open' THEN RAISE EXCEPTION 'Someone already took this shift.' USING ERRCODE = 'check_violation'; END IF;
  IF v_swap.from_user = v_uid THEN RAISE EXCEPTION 'You can''t take your own shift.' USING ERRCODE = 'check_violation'; END IF;
  IF v_swap.to_user IS NOT NULL AND v_swap.to_user <> v_uid THEN
    RAISE EXCEPTION 'This shift was offered to someone else.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  SELECT * INTO v_shift FROM public.scheduled_shifts WHERE id = v_swap.shift_id;
  v_reason := public._swap_block_reason(v_uid, v_shift);
  IF v_reason IS NOT NULL THEN
    RAISE EXCEPTION 'swap_blocked:%', v_reason USING ERRCODE = 'check_violation';
  END IF;

  UPDATE public.shift_swaps SET taker_id = v_uid, status = 'taken', updated_at = now()
  WHERE id = p_id RETURNING * INTO v_swap;

  SELECT array_agg(id) INTO v_admins FROM public.profiles
  WHERE organization_id = v_swap.organization_id AND public.profile_has_permission(id, 'requests', 'write')
    AND id NOT IN (v_swap.from_user, v_uid);
  PERFORM public._swap_notify(v_swap, 'swap_taken', ARRAY[v_swap.from_user]);
  PERFORM public._swap_notify(v_swap, 'swap_requested', COALESCE(v_admins, '{}'));
  RETURN v_swap;
END;
$$;
NOTIFY pgrst, 'reload schema';
