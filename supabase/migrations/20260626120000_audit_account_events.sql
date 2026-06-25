-- =====================================================================
-- Audit account events: username changes + name-change request reviews
-- =====================================================================
-- Extends the existing shift_audit_log so the Activity Log also surfaces:
--   * username_change          — a user changed their own @username
--   * name_request_approved     — an admin approved a name-change request
--   * name_request_rejected     — an admin declined a name-change request
--
-- shift_id stays NULL for these account events; details carries the before/after
-- values. All writers are SECURITY DEFINER (RPC or trigger) so they can insert
-- into the audit log regardless of the caller's RLS.

-- 1. Allow the new action types ------------------------------------------------
ALTER TABLE public.shift_audit_log DROP CONSTRAINT IF EXISTS shift_audit_log_action_check;
ALTER TABLE public.shift_audit_log ADD CONSTRAINT shift_audit_log_action_check
  CHECK (action = ANY (ARRAY[
    'create', 'update', 'delete',
    'username_change', 'name_request_approved', 'name_request_rejected'
  ]));

-- 2. Log username changes via a trigger on profiles ----------------------------
-- Username edits go through a plain PostgREST update (no RPC), so a trigger is
-- the most reliable capture point.
CREATE OR REPLACE FUNCTION public.log_username_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.shift_audit_log (organization_id, shift_id, actor_id, target_user_id, action, details)
  VALUES (
    NEW.organization_id, NULL, COALESCE(auth.uid(), NEW.id), NEW.id, 'username_change',
    jsonb_build_object(
      'actor_name',   public._display_name(COALESCE(auth.uid(), NEW.id)),
      'target_name',  public._display_name(NEW.id),
      'old_username', OLD.username,
      'new_username', NEW.username
    )
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_username_change ON public.profiles;
CREATE TRIGGER trg_log_username_change
  AFTER UPDATE OF username ON public.profiles
  FOR EACH ROW
  WHEN (OLD.username IS DISTINCT FROM NEW.username)
  EXECUTE FUNCTION public.log_username_change();

-- 3. Audit name-change request reviews -----------------------------------------
-- Re-create the existing reviewer RPC with an audit insert appended (the rest of
-- the body is unchanged from 20260623140000_name_change_requests.sql).
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

  -- Audit the decision.
  INSERT INTO public.shift_audit_log (organization_id, shift_id, actor_id, target_user_id, action, details)
  VALUES (
    v_req.organization_id, NULL, v_uid, v_req.user_id,
    CASE WHEN p_approve THEN 'name_request_approved' ELSE 'name_request_rejected' END,
    jsonb_build_object(
      'actor_name',  public._display_name(v_uid),
      'target_name', public._display_name(v_req.user_id),
      'old_name',    btrim(concat_ws(' ', v_req.current_first_name, v_req.current_last_name)),
      'new_name',    btrim(concat_ws(' ', v_req.requested_first_name, v_req.requested_last_name)),
      'note',        NULLIF(btrim(p_review_note), '')
    )
  );

  RETURN v_req;
END;
$function$;
