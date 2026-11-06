-- =============================================================================
-- REQUESTS: FOUR EYES + PRIVATE COMPLAINTS
-- 1. Nobody decides on their own request — no Head Admin / Superadmin
--    exception any more (time off, name changes, swaps they take part in,
--    role / other requests and complaints). Someone else has to approve.
-- 2. Complaints are seen only by the people who can decide them (Requests
--    change permission) — not by read-only Requests viewers — plus the sender
--    and a Superadmin. The same goes for complaint entries in the activity log.
-- =============================================================================

-- 1 — the shared check (time_off RLS, swaps, member requests use it).
CREATE OR REPLACE FUNCTION public.can_review_request(requester uuid, org uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT requester IS DISTINCT FROM auth.uid()
     AND (public.is_superadmin()
          OR (public.has_permission('requests', 'write') AND org = public.get_my_org_id()));
$$;

-- Name changes had their own copy of the rule.
CREATE OR REPLACE FUNCTION public.review_name_change_request(p_id uuid, p_approve boolean, p_review_note text DEFAULT NULL::text)
RETURNS name_change_requests LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid  uuid := auth.uid();
  v_req  public.name_change_requests;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated.' USING ERRCODE = 'insufficient_privilege'; END IF;
  SELECT * INTO v_req FROM public.name_change_requests WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Request not found.' USING ERRCODE = 'no_data_found'; END IF;
  IF v_req.status <> 'pending' THEN RAISE EXCEPTION 'This request has already been reviewed.' USING ERRCODE = 'check_violation'; END IF;
  IF NOT public.can_review_request(v_req.user_id, v_req.organization_id) THEN
    RAISE EXCEPTION 'You are not allowed to review this request.' USING ERRCODE = 'insufficient_privilege';
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
$$;

-- Swaps: the person taking the shift never approves it either.
CREATE OR REPLACE FUNCTION public.review_shift_swap(p_id uuid, p_approve boolean, p_note text DEFAULT NULL::text)
RETURNS shift_swaps LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid    uuid := auth.uid();
  v_swap   public.shift_swaps;
  v_shift  public.scheduled_shifts;
  v_reason text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not signed in.' USING ERRCODE = 'insufficient_privilege'; END IF;
  SELECT * INTO v_swap FROM public.shift_swaps WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Swap not found.' USING ERRCODE = 'no_data_found'; END IF;
  IF NOT public.can_review_request(v_swap.from_user, v_swap.organization_id) OR v_swap.taker_id = v_uid THEN
    RAISE EXCEPTION 'You are not allowed to review this swap.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF v_swap.status <> 'taken' THEN RAISE EXCEPTION 'This swap is no longer waiting for a decision.' USING ERRCODE = 'check_violation'; END IF;
  IF p_approve THEN
    SELECT * INTO v_shift FROM public.scheduled_shifts WHERE id = v_swap.shift_id FOR UPDATE;
    v_reason := public._swap_block_reason(v_swap.taker_id, v_shift);
    IF v_reason IS NOT NULL THEN
      RAISE EXCEPTION 'swap_blocked:%', v_reason USING ERRCODE = 'check_violation';
    END IF;
    PERFORM set_config('app.suppress_schedule_audit', 'on', true);
    UPDATE public.scheduled_shifts SET user_id = v_swap.taker_id WHERE id = v_swap.shift_id;
    PERFORM set_config('app.suppress_schedule_audit', 'off', true);
  END IF;
  UPDATE public.shift_swaps
     SET status = CASE WHEN p_approve THEN 'approved' ELSE 'declined' END,
         review_note = NULLIF(btrim(p_note), ''), reviewed_by = v_uid, reviewed_at = now(), updated_at = now()
   WHERE id = p_id RETURNING * INTO v_swap;
  PERFORM public._swap_notify(v_swap, CASE WHEN p_approve THEN 'swap_approved' ELSE 'swap_declined' END,
                              ARRAY[v_swap.from_user, v_swap.taker_id]);
  RETURN v_swap;
END;
$$;

-- 2 — complaints only for those who decide them.
CREATE OR REPLACE FUNCTION public.list_member_requests()
RETURNS TABLE (
  id uuid, organization_id uuid, user_id uuid, person_name text, kind text, subject text, body text,
  org_role_id uuid, role_name text, role_color text, current_role_name text, anonymous boolean,
  status text, review_note text, reviewer_name text, reviewed_at timestamptz, created_at timestamptz,
  mine boolean, can_review boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT r.id, r.organization_id,
         CASE WHEN r.anonymous AND r.user_id <> auth.uid() AND NOT public.is_superadmin() THEN NULL ELSE r.user_id END,
         CASE WHEN r.anonymous AND r.user_id <> auth.uid() AND NOT public.is_superadmin() THEN NULL ELSE public._display_name(r.user_id) END,
         r.kind, r.subject, r.body, r.org_role_id, ro.name, ro.color,
         CASE WHEN r.kind = 'role' THEN (SELECT o.name FROM public.profiles p JOIN public.org_roles o ON o.id = p.org_role_id WHERE p.id = r.user_id) END,
         r.anonymous, r.status, r.review_note, public._display_name(r.reviewed_by), r.reviewed_at, r.created_at,
         r.user_id = auth.uid(),
         r.status = 'pending' AND public._may_review_member_request(r)
  FROM public.member_requests r
  LEFT JOIN public.org_roles ro ON ro.id = r.org_role_id
  WHERE (r.status = 'pending' OR r.created_at >= now() - interval '90 days' OR r.reviewed_at >= now() - interval '90 days')
    AND (r.user_id = auth.uid()
         OR public.is_superadmin()
         OR (r.organization_id = public.get_my_org_id()
             AND public.has_permission('requests', CASE WHEN r.kind = 'complaint' THEN 'write' ELSE 'read' END)))
  ORDER BY r.created_at
$$;

DROP POLICY IF EXISTS sal_select ON public.shift_audit_log;
CREATE POLICY sal_select ON public.shift_audit_log FOR SELECT TO authenticated
USING (
  (SELECT public.is_superadmin())
  OR target_user_id = (SELECT auth.uid())
  OR ((SELECT public.has_permission('activity', 'read'))
      AND organization_id = public.get_my_org_id()
      AND (details->>'kind' IS DISTINCT FROM 'complaint'
           OR action NOT LIKE 'request\_%'
           OR (SELECT public.has_permission('requests', 'write'))))
);
