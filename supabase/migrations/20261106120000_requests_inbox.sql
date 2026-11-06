-- =============================================================================
-- REQUESTS INBOX — admins decide, managers observe, nobody reviews their own
-- -----------------------------------------------------------------------------
-- Role model (user decision 2026-11-06): managers (rank 20) WATCH — they can
-- read every request in the org; admins (rank >= 30) DECIDE. Nobody decides on
-- their own request, except the very top (Head Admin, rank >= 40), who has no
-- one above them.
--   • time_off: + review_note / reviewed_at (a decline can carry a reason).
--   • time_off writes: a member files their own PENDING request; decisions and
--     leave entered for someone else are admin-only (was rank >= 20).
--   • name_change_requests: managers may read them (observe); the review RPC
--     now refuses self-review.
--   • notify_time_off: a new request notifies the org's admins (was: the
--     requester's manager first).
-- =============================================================================

ALTER TABLE public.time_off
  ADD COLUMN IF NOT EXISTS review_note text,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;

-- May the caller decide on a request filed by `requester` in `org`?
CREATE OR REPLACE FUNCTION public.can_review_request(requester uuid, org uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT public.is_superadmin()
      OR (public.my_role_rank() >= 30
          AND org = public.get_my_org_id()
          AND (requester <> auth.uid() OR public.my_role_rank() >= 40));
$$;
REVOKE ALL ON FUNCTION public.can_review_request(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.can_review_request(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.can_review_request(uuid, uuid) TO authenticated;

-- time_off — reads unchanged (members: own; managers+: org, to observe/plan).
DROP POLICY IF EXISTS "timeoff_insert" ON public.time_off;
CREATE POLICY "timeoff_insert" ON public.time_off FOR INSERT TO authenticated
  WITH CHECK (
    is_superadmin()
    OR (user_id = (SELECT auth.uid()) AND organization_id = get_my_org_id() AND status = 'pending')
    OR public.can_review_request(user_id, organization_id)
  );

DROP POLICY IF EXISTS "timeoff_update" ON public.time_off;
CREATE POLICY "timeoff_update" ON public.time_off FOR UPDATE TO authenticated
  USING (public.can_review_request(user_id, organization_id))
  WITH CHECK (
    public.can_review_request(user_id, organization_id)
    AND (reviewed_by IS NULL OR reviewed_by = (SELECT auth.uid()) OR is_superadmin())
  );

DROP POLICY IF EXISTS "timeoff_delete" ON public.time_off;
CREATE POLICY "timeoff_delete" ON public.time_off FOR DELETE TO authenticated
  USING (
    is_superadmin()
    OR (user_id = (SELECT auth.uid()) AND status = 'pending')
    OR (my_role_rank() >= 30 AND organization_id = get_my_org_id())
  );

-- name_change_requests — managers can now read them too (observers).
DROP POLICY IF EXISTS "ncr_select" ON public.name_change_requests;
CREATE POLICY "ncr_select" ON public.name_change_requests FOR SELECT TO authenticated
  USING (
    is_superadmin()
    OR user_id = (SELECT auth.uid())
    OR (my_role_rank() >= 20 AND organization_id = get_my_org_id())
  );

-- Review RPC: same as before + no self-review below Head Admin.
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
    IF v_rank < 30 OR v_req.organization_id <> public.get_my_org_id() THEN
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

-- A new time-off request notifies the org's admins (the deciders).
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
      WHERE organization_id = NEW.organization_id AND role_rank(role) >= 30 AND id <> NEW.user_id
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

NOTIFY pgrst, 'reload schema';
