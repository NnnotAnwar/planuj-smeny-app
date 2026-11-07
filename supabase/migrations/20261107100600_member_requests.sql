-- =============================================================================
-- MEMBER REQUESTS: ask for a role, anything else, or file a complaint.
-- Lands in the shared Requests inbox next to time off, name changes and swaps.
--   • role       — pick one of the organization's roles; approving applies it
--                  at once (the reviewer must be allowed to give that role:
--                  Team change permission, both the person and the role below
--                  the reviewer — enforce_profile_privilege re-checks it).
--   • other      — free text (subject + message); approve = done.
--   • complaint  — free text, optionally anonymous: reviewers never see who
--                  sent it (only the sender and a Superadmin do), the activity
--                  log shows "Anonymous", and the decision isn't pushed back
--                  (that would name the sender) — they see it in My requests.
-- Reviewers = everyone whose role has Requests change permission
-- (can_review_request), same as the other request types.
-- All writes go through the RPCs below; RLS only lets you read your own rows.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.member_requests (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  kind            text NOT NULL CHECK (kind IN ('role', 'other', 'complaint')),
  subject         text CHECK (char_length(subject) <= 120),
  body            text CHECK (char_length(body) <= 2000),
  org_role_id     uuid REFERENCES public.org_roles(id) ON DELETE SET NULL,
  anonymous       boolean NOT NULL DEFAULT false,
  status          text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'declined')),
  review_note     text CHECK (char_length(review_note) <= 500),
  reviewed_by     uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at     timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT member_requests_anon_complaint CHECK (NOT anonymous OR kind = 'complaint')
);
CREATE INDEX IF NOT EXISTS member_requests_org_idx ON public.member_requests (organization_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS member_requests_user_idx ON public.member_requests (user_id);
CREATE UNIQUE INDEX IF NOT EXISTS member_requests_one_role_pending
  ON public.member_requests (user_id) WHERE kind = 'role' AND status = 'pending';

ALTER TABLE public.member_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS member_requests_select ON public.member_requests;
CREATE POLICY member_requests_select ON public.member_requests FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()) OR (SELECT public.is_superadmin()));
REVOKE INSERT, UPDATE, DELETE ON public.member_requests FROM anon, authenticated;

-- Fan-out rows for the logs; an anonymous request never carries its sender.
CREATE OR REPLACE FUNCTION public._request_log(p_req public.member_requests, p_action text, p_recipients uuid[], p_actor uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_details jsonb := jsonb_strip_nulls(jsonb_build_object(
    'actor_name', CASE WHEN p_req.anonymous AND p_actor = p_req.user_id THEN 'Anonymous'
                       ELSE COALESCE(public._display_name(p_actor), 'System') END,
    'target_name', CASE WHEN NOT p_req.anonymous THEN public._display_name(p_req.user_id) END,
    'kind', p_req.kind,
    -- A complaint's text stays in the inbox, not in the log / on lock screens.
    'subject_name', CASE WHEN p_req.kind <> 'complaint' THEN p_req.subject END,
    'role_name', (SELECT name FROM public.org_roles WHERE id = p_req.org_role_id),
    'anonymous', NULLIF(p_req.anonymous, false),
    'note', CASE WHEN p_action <> 'request_submitted' THEN p_req.review_note END));
  v_actor uuid := CASE WHEN p_req.anonymous AND p_actor = p_req.user_id THEN NULL ELSE p_actor END;
  v_subject uuid := CASE WHEN p_req.anonymous THEN NULL ELSE p_req.user_id END;
  r uuid;
BEGIN
  IF COALESCE(array_length(p_recipients, 1), 0) = 0 THEN
    INSERT INTO public.shift_audit_log (organization_id, shift_id, actor_id, target_user_id, subject_id, action, details)
    VALUES (p_req.organization_id, NULL, v_actor, NULL, v_subject, p_action, v_details);
    RETURN;
  END IF;
  FOREACH r IN ARRAY p_recipients LOOP
    INSERT INTO public.shift_audit_log (organization_id, shift_id, actor_id, target_user_id, subject_id, action, details)
    VALUES (p_req.organization_id, NULL, v_actor, r, v_subject, p_action, v_details);
  END LOOP;
END;
$$;
REVOKE EXECUTE ON FUNCTION public._request_log(public.member_requests, text, uuid[], uuid) FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Submit.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.submit_member_request(
  p_kind text, p_subject text DEFAULT NULL, p_body text DEFAULT NULL,
  p_org_role uuid DEFAULT NULL, p_anonymous boolean DEFAULT false)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid  uuid := auth.uid();
  v_me   public.profiles;
  v_role public.org_roles;
  v_req  public.member_requests;
  v_reviewers uuid[];
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not signed in.' USING ERRCODE = 'insufficient_privilege'; END IF;
  SELECT * INTO v_me FROM public.profiles WHERE id = v_uid;
  IF v_me.organization_id IS NULL THEN RAISE EXCEPTION 'You are not in an organization.' USING ERRCODE = 'check_violation'; END IF;
  IF p_kind NOT IN ('role', 'other', 'complaint') THEN RAISE EXCEPTION 'Unknown request type.' USING ERRCODE = 'check_violation'; END IF;

  p_subject := NULLIF(btrim(p_subject), '');
  p_body := NULLIF(btrim(p_body), '');

  IF p_kind = 'role' THEN
    SELECT * INTO v_role FROM public.org_roles WHERE id = p_org_role;
    IF NOT FOUND OR v_role.organization_id <> v_me.organization_id THEN
      RAISE EXCEPTION 'Pick a role from your organization.' USING ERRCODE = 'check_violation';
    END IF;
    IF v_role.preset_key = 'head_admin' THEN
      RAISE EXCEPTION 'request_role_top' USING ERRCODE = 'check_violation';
    END IF;
    IF v_role.id = v_me.org_role_id THEN
      RAISE EXCEPTION 'request_role_same' USING ERRCODE = 'check_violation';
    END IF;
    IF EXISTS (SELECT 1 FROM public.member_requests WHERE user_id = v_uid AND kind = 'role' AND status = 'pending') THEN
      RAISE EXCEPTION 'request_role_pending' USING ERRCODE = 'unique_violation';
    END IF;
    p_anonymous := false;
  ELSE
    IF p_subject IS NULL AND p_body IS NULL THEN
      RAISE EXCEPTION 'request_empty' USING ERRCODE = 'check_violation';
    END IF;
    IF (SELECT count(*) FROM public.member_requests WHERE user_id = v_uid AND kind <> 'role' AND status = 'pending') >= 5 THEN
      RAISE EXCEPTION 'request_too_many' USING ERRCODE = 'check_violation';
    END IF;
    p_org_role := NULL;
    p_anonymous := p_kind = 'complaint' AND COALESCE(p_anonymous, false);
  END IF;

  INSERT INTO public.member_requests (organization_id, user_id, kind, subject, body, org_role_id, anonymous)
  VALUES (v_me.organization_id, v_uid, p_kind, p_subject, p_body, p_org_role, p_anonymous)
  RETURNING * INTO v_req;

  SELECT array_agg(id) INTO v_reviewers FROM public.profiles
  WHERE organization_id = v_req.organization_id AND id <> v_uid
    AND public.profile_has_permission(id, 'requests', 'write');
  PERFORM public._request_log(v_req, 'request_submitted', COALESCE(v_reviewers, '{}'), v_uid);
  RETURN v_req.id;
END;
$$;

-- ---------------------------------------------------------------------------
-- May the signed-in user decide on this one? (role requests need the right to
-- hand out that role on top of the Requests permission.)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._may_review_member_request(p_req public.member_requests)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.can_review_request(p_req.user_id, p_req.organization_id)
     AND (p_req.kind <> 'role' OR public.is_superadmin() OR (
          public.has_permission('members', 'write')
          AND public.profile_rank(p_req.user_id) < public.my_role_rank()
          AND COALESCE((SELECT sort FROM public.org_roles WHERE id = p_req.org_role_id), 999) < public.my_role_rank()))
$$;
REVOKE EXECUTE ON FUNCTION public._may_review_member_request(public.member_requests) FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- The inbox: my own requests + (reviewers / Requests viewers) the org's.
-- Anonymous senders are hidden from everyone but themselves and a Superadmin.
-- ---------------------------------------------------------------------------
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
         OR (r.organization_id = public.get_my_org_id() AND public.has_permission('requests', 'read')))
  ORDER BY r.created_at
$$;

-- ---------------------------------------------------------------------------
-- Decide.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.review_member_request(p_id uuid, p_approve boolean, p_note text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_req public.member_requests;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not signed in.' USING ERRCODE = 'insufficient_privilege'; END IF;
  SELECT * INTO v_req FROM public.member_requests WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Request not found.' USING ERRCODE = 'no_data_found'; END IF;
  IF v_req.status <> 'pending' THEN RAISE EXCEPTION 'This request was already decided.' USING ERRCODE = 'check_violation'; END IF;
  IF NOT public._may_review_member_request(v_req) THEN
    RAISE EXCEPTION 'You are not allowed to decide on this request.' USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF p_approve AND v_req.kind = 'role' THEN
    IF v_req.org_role_id IS NULL THEN RAISE EXCEPTION 'request_role_gone' USING ERRCODE = 'check_violation'; END IF;
    -- Runs the normal guards (enforce_profile_privilege) as the reviewer.
    UPDATE public.profiles SET org_role_id = v_req.org_role_id WHERE id = v_req.user_id;
  END IF;

  UPDATE public.member_requests
     SET status = CASE WHEN p_approve THEN 'approved' ELSE 'declined' END,
         review_note = NULLIF(btrim(p_note), ''), reviewed_by = v_uid, reviewed_at = now()
   WHERE id = p_id RETURNING * INTO v_req;

  -- Tell the sender — unless that would reveal an anonymous one.
  PERFORM public._request_log(v_req, CASE WHEN p_approve THEN 'request_approved' ELSE 'request_declined' END,
    CASE WHEN v_req.anonymous OR v_req.user_id = v_uid THEN '{}'::uuid[] ELSE ARRAY[v_req.user_id] END, v_uid);
END;
$$;

-- ---------------------------------------------------------------------------
-- Withdraw (sender, while pending).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cancel_member_request(p_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_req public.member_requests;
BEGIN
  DELETE FROM public.member_requests WHERE id = p_id AND user_id = auth.uid() AND status = 'pending'
  RETURNING * INTO v_req;
  IF NOT FOUND THEN RAISE EXCEPTION 'Nothing to withdraw.' USING ERRCODE = 'check_violation'; END IF;
  PERFORM public._request_log(v_req, 'request_cancelled', '{}'::uuid[], auth.uid());
END;
$$;

REVOKE EXECUTE ON FUNCTION public.submit_member_request(text, text, text, uuid, boolean) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.list_member_requests() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.review_member_request(uuid, boolean, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.cancel_member_request(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_member_request(text, text, text, uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_member_requests() TO authenticated;
GRANT EXECUTE ON FUNCTION public.review_member_request(uuid, boolean, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_member_request(uuid) TO authenticated;

-- The subject of a fan-out "submitted" row is the sender (null when anonymous),
-- not the reviewer it notifies. _request_log sets it already; keep the
-- fallback in step for safety.
CREATE OR REPLACE FUNCTION public._audit_subject(p_action text, p_actor uuid, p_target uuid)
RETURNS uuid LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE
    WHEN p_action IN ('timeoff_requested', 'swap_requested', 'request_submitted') THEN p_actor
    WHEN p_action IN ('late_15', 'late_60') THEN NULL
    ELSE p_target
  END
$$;
