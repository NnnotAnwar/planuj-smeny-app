-- =============================================================================
-- ROLES IN THE ACTIVITY LOG (product owner, 2026-11-06)
-- -----------------------------------------------------------------------------
--   • role_created / role_updated (name, colour) / role_moved / role_deleted /
--     role_permissions (one entry per save: area → before / after)
--   • A member's role change is logged by ROLE NAME ("Manager → Shift lead"),
--     also when the level stays the same.
--   • Internal re-syncs (a role moving, a deleted role's people moving to the
--     default role) no longer log a fake "role changed" per member — the role
--     entry says what happened.
-- Org-scoped entries (target_user_id NULL): they show in the Activity log, not
-- as anyone's notification.
-- =============================================================================
ALTER TABLE public.shift_audit_log DROP CONSTRAINT IF EXISTS shift_audit_log_action_check;
ALTER TABLE public.shift_audit_log ADD CONSTRAINT shift_audit_log_action_check
  CHECK (action = ANY (ARRAY[
    'create', 'update', 'delete', 'username_change', 'name_request_approved', 'name_request_rejected',
    'profile_updated', 'late_15', 'late_60', 'schedule_created', 'schedule_updated', 'schedule_removed',
    'schedule_published', 'timeoff_requested', 'timeoff_approved', 'timeoff_declined',
    'swap_taken', 'swap_requested', 'swap_approved', 'swap_declined',
    'role_created', 'role_updated', 'role_moved', 'role_deleted', 'role_permissions'
  ]));

CREATE OR REPLACE FUNCTION public._log_role(p_org uuid, p_action text, p_details jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  -- System work (seeding, cascades of a deleted organization) isn't logged.
  IF auth.uid() IS NULL OR NOT EXISTS (SELECT 1 FROM public.organizations WHERE id = p_org) THEN RETURN; END IF;
  INSERT INTO public.shift_audit_log (organization_id, shift_id, actor_id, target_user_id, action, details)
  VALUES (p_org, NULL, auth.uid(), NULL, p_action,
          jsonb_build_object('actor_name', COALESCE(public._display_name(auth.uid()), 'System')) || p_details);
END;
$$;

-- Created / renamed / recoloured (moves are logged by move_org_role).
CREATE OR REPLACE FUNCTION public.audit_org_roles()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public._log_role(NEW.organization_id, 'role_created', jsonb_build_object('role_name', NEW.name, 'color', NEW.color));
  ELSIF NEW.name IS DISTINCT FROM OLD.name OR NEW.color IS DISTINCT FROM OLD.color THEN
    PERFORM public._log_role(NEW.organization_id, 'role_updated', jsonb_build_object(
      'role_name', NEW.name, 'old_name', OLD.name, 'color', NEW.color, 'old_color', OLD.color));
  END IF;
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS audit_org_roles ON public.org_roles;
CREATE TRIGGER audit_org_roles AFTER INSERT OR UPDATE ON public.org_roles FOR EACH ROW EXECUTE FUNCTION public.audit_org_roles();

-- Permission edits: one entry per role per statement, listing the areas changed.
CREATE OR REPLACE FUNCTION public.audit_org_role_perms()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT n.role_id, ro.organization_id, ro.name,
           jsonb_agg(jsonb_build_object(
             'area', n.area,
             'old', CASE WHEN o.role_id IS NULL THEN '' ELSE concat_ws('', CASE WHEN o.can_read THEN 'r' END, CASE WHEN o.can_write THEN 'w' END, CASE WHEN o.can_delete THEN 'd' END) END,
             'new', concat_ws('', CASE WHEN n.can_read THEN 'r' END, CASE WHEN n.can_write THEN 'w' END, CASE WHEN n.can_delete THEN 'd' END)
           ) ORDER BY n.area) AS changes
      FROM new_rows n
      LEFT JOIN (SELECT * FROM old_rows) o ON o.role_id = n.role_id AND o.area = n.area
      JOIN public.org_roles ro ON ro.id = n.role_id
     WHERE o.role_id IS NULL OR (n.can_read, n.can_write, n.can_delete) IS DISTINCT FROM (o.can_read, o.can_write, o.can_delete)
     GROUP BY n.role_id, ro.organization_id, ro.name
  LOOP
    PERFORM public._log_role(r.organization_id, 'role_permissions', jsonb_build_object('role_name', r.name, 'changes', r.changes));
  END LOOP;
  RETURN NULL;
END;
$$;
-- INSERT has no old rows: a twin that feeds an empty "old".
CREATE OR REPLACE FUNCTION public.audit_org_role_perms_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT n.role_id, ro.organization_id, ro.name,
           jsonb_agg(jsonb_build_object('area', n.area, 'old', '',
             'new', concat_ws('', CASE WHEN n.can_read THEN 'r' END, CASE WHEN n.can_write THEN 'w' END, CASE WHEN n.can_delete THEN 'd' END)) ORDER BY n.area) AS changes
      FROM new_rows n JOIN public.org_roles ro ON ro.id = n.role_id
     WHERE n.can_read OR n.can_write OR n.can_delete
     GROUP BY n.role_id, ro.organization_id, ro.name
  LOOP
    PERFORM public._log_role(r.organization_id, 'role_permissions', jsonb_build_object('role_name', r.name, 'changes', r.changes));
  END LOOP;
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS audit_org_role_perms_upd ON public.org_role_permissions;
CREATE TRIGGER audit_org_role_perms_upd AFTER UPDATE ON public.org_role_permissions
  REFERENCING OLD TABLE AS old_rows NEW TABLE AS new_rows FOR EACH STATEMENT EXECUTE FUNCTION public.audit_org_role_perms();
DROP TRIGGER IF EXISTS audit_org_role_perms_ins ON public.org_role_permissions;
CREATE TRIGGER audit_org_role_perms_ins AFTER INSERT ON public.org_role_permissions
  REFERENCING NEW TABLE AS new_rows FOR EACH STATEMENT EXECUTE FUNCTION public.audit_org_role_perms_insert();

-- Deleted (with how many people moved to the default role).
CREATE OR REPLACE FUNCTION public.org_roles_before_delete()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_default public.org_roles; v_moved int := 0;
BEGIN
  SELECT * INTO v_default FROM public.org_roles WHERE organization_id = OLD.organization_id AND preset_key = 'employee';
  IF FOUND AND v_default.id <> OLD.id THEN
    PERFORM set_config('app.role_sync', 'on', true);
    UPDATE public.profiles SET org_role_id = v_default.id WHERE org_role_id = OLD.id;
    GET DIAGNOSTICS v_moved = ROW_COUNT;
    PERFORM set_config('app.role_sync', 'off', true);
  END IF;
  PERFORM public._log_role(OLD.organization_id, 'role_deleted', jsonb_build_object(
    'role_name', OLD.name, 'moved', v_moved, 'moved_to', v_default.name));
  RETURN OLD;
END;
$$;

-- Moved.
CREATE OR REPLACE FUNCTION public.move_org_role(p_role uuid, p_up boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_me   smallint := public.my_role_rank();
  v_role public.org_roles;
  v_nb   public.org_roles;
  v_a    smallint;
BEGIN
  SELECT * INTO v_role FROM public.org_roles WHERE id = p_role FOR UPDATE;
  IF NOT FOUND OR (v_role.organization_id <> public.get_my_org_id() AND NOT public.is_superadmin()) THEN
    RAISE EXCEPTION 'Role not found.' USING ERRCODE = 'no_data_found';
  END IF;
  IF NOT public.is_superadmin() AND NOT public.has_permission('roles', 'write') THEN
    RAISE EXCEPTION 'You are not allowed to reorder roles.' USING ERRCODE = '42501';
  END IF;
  IF v_role.preset_key IN ('head_admin', 'employee') THEN
    RAISE EXCEPTION 'This role keeps its place.' USING ERRCODE = 'check_violation';
  END IF;
  SELECT * INTO v_nb FROM public.org_roles
   WHERE organization_id = v_role.organization_id AND preset_key IS DISTINCT FROM 'head_admin' AND preset_key IS DISTINCT FROM 'employee'
     AND CASE WHEN p_up THEN sort > v_role.sort ELSE sort < v_role.sort END
   ORDER BY CASE WHEN p_up THEN sort END ASC, CASE WHEN NOT p_up THEN sort END DESC
   LIMIT 1 FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;
  IF NOT public.is_superadmin() AND (v_role.sort >= v_me OR v_nb.sort >= v_me) THEN
    RAISE EXCEPTION 'You can only move roles below your own.' USING ERRCODE = '42501';
  END IF;
  v_a := v_role.sort;
  UPDATE public.org_roles SET sort = v_nb.sort WHERE id = v_role.id;
  UPDATE public.org_roles SET sort = v_a WHERE id = v_nb.id;
  PERFORM public._log_role(v_role.organization_id, 'role_moved', jsonb_build_object(
    'role_name', v_role.name, 'direction', CASE WHEN p_up THEN 'up' ELSE 'down' END, 'other_name', v_nb.name));
END;
$$;
REVOKE ALL ON FUNCTION public.move_org_role(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.move_org_role(uuid, boolean) TO authenticated;

-- A member's role change, by role name; system re-syncs stay quiet.
CREATE OR REPLACE FUNCTION public.audit_profile_admin_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
    v_actor   uuid := auth.uid();
    v_changes jsonb := '[]'::jsonb;
begin
    if v_actor is null or v_actor = new.id then return new; end if;
    if coalesce(current_setting('app.suppress_profile_audit', true), '') = 'on' then return new; end if;
    if coalesce(current_setting('app.role_sync', true), '') = 'on' then return new; end if;
    if new.first_name is distinct from old.first_name or new.last_name is distinct from old.last_name then
        v_changes := v_changes || jsonb_build_object('field','name',
            'old', nullif(btrim(concat_ws(' ', old.first_name, old.last_name)), ''),
            'new', nullif(btrim(concat_ws(' ', new.first_name, new.last_name)), ''));
    end if;
    if new.org_role_id is distinct from old.org_role_id or new.role is distinct from old.role then
        v_changes := v_changes || jsonb_build_object('field','role',
            'old', coalesce((select name from public.org_roles where id = old.org_role_id), old.role),
            'new', coalesce((select name from public.org_roles where id = new.org_role_id), new.role));
    end if;
    if new.organization_id is distinct from old.organization_id then
        v_changes := v_changes || jsonb_build_object('field','organization',
            'old', (select name from public.organizations where id = old.organization_id),
            'new', (select name from public.organizations where id = new.organization_id));
    end if;
    if jsonb_array_length(v_changes) = 0 then return new; end if;
    insert into public.shift_audit_log (organization_id, shift_id, actor_id, target_user_id, action, details)
    values (new.organization_id, null, v_actor, new.id, 'profile_updated',
        jsonb_build_object('actor_name', public._display_name(v_actor),
            'target_name', public._display_name(new.id), 'changes', v_changes));
    return new;
end;
$function$;

REVOKE ALL ON FUNCTION public._log_role(uuid, text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.audit_org_roles() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.audit_org_role_perms() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.audit_org_role_perms_insert() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.org_roles_before_delete() FROM PUBLIC, anon, authenticated;
