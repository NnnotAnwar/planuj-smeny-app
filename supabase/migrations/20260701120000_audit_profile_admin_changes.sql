-- Notify users when an admin changes their profile from the Admin panel
-- (name / role / organization). Direct `profiles` UPDATEs are the write path, so
-- an AFTER UPDATE trigger is the catch-all: it records a `profile_updated` audit
-- row (which the in-app feed + push webhook already act on) for changes made by
-- someone other than the user themselves.

-- 1. Allow the new action.
alter table public.shift_audit_log drop constraint if exists shift_audit_log_action_check;
alter table public.shift_audit_log add constraint shift_audit_log_action_check
    check (action in (
        'create', 'update', 'delete',
        'username_change', 'name_request_approved', 'name_request_rejected',
        'profile_updated'
    ));

-- 2. Trigger: audit admin edits to name / role / organization.
create or replace function public.audit_profile_admin_change()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
    v_actor   uuid := auth.uid();
    v_changes jsonb := '[]'::jsonb;
begin
    -- Skip system writes, self-edits, and changes coming from the name-change
    -- request approval flow (already audited as name_request_approved).
    if v_actor is null or v_actor = new.id then
        return new;
    end if;
    if coalesce(current_setting('app.suppress_profile_audit', true), '') = 'on' then
        return new;
    end if;

    if new.first_name is distinct from old.first_name or new.last_name is distinct from old.last_name then
        v_changes := v_changes || jsonb_build_object(
            'field', 'name',
            'old', nullif(btrim(concat_ws(' ', old.first_name, old.last_name)), ''),
            'new', nullif(btrim(concat_ws(' ', new.first_name, new.last_name)), '')
        );
    end if;
    if new.role is distinct from old.role then
        v_changes := v_changes || jsonb_build_object('field', 'role', 'old', old.role, 'new', new.role);
    end if;
    if new.organization_id is distinct from old.organization_id then
        v_changes := v_changes || jsonb_build_object(
            'field', 'organization',
            'old', (select name from public.organizations where id = old.organization_id),
            'new', (select name from public.organizations where id = new.organization_id)
        );
    end if;

    if jsonb_array_length(v_changes) = 0 then
        return new;
    end if;

    insert into public.shift_audit_log (organization_id, shift_id, actor_id, target_user_id, action, details)
    values (
        new.organization_id, null, v_actor, new.id, 'profile_updated',
        jsonb_build_object(
            'actor_name', public._display_name(v_actor),
            'target_name', public._display_name(new.id),
            'changes', v_changes
        )
    );
    return new;
end;
$function$;

drop trigger if exists trg_audit_profile_admin_change on public.profiles;
create trigger trg_audit_profile_admin_change
    after update on public.profiles
    for each row execute function public.audit_profile_admin_change();

-- 3. Suppress the profile trigger during name-request approval (that flow writes
-- its own name_request_approved audit row).
create or replace function public.review_name_change_request(p_id uuid, p_approve boolean, p_review_note text default null::text)
returns name_change_requests
language plpgsql
security definer
set search_path to 'public'
as $function$
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
    PERFORM set_config('app.suppress_profile_audit', 'on', true);
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
