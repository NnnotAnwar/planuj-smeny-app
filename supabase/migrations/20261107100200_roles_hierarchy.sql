-- =============================================================================
-- ROLES HIERARCHY — Discord-style (product owner, 2026-11-06)
-- -----------------------------------------------------------------------------
--   • A role's POSITION is the hierarchy. org_roles.sort (0–40) is the rank:
--     Head Admin is always 40 (top), roles can be moved up and down. You manage
--     only people and roles BELOW your own role.
--   • New area "roles" (read / write / delete): holders create, edit, reorder
--     and delete roles below their own — and can only hand out permissions they
--     hold themselves. Head Admin (and Superadmin) hold everything.
--   • base_role (the legacy level) is now derived from the position, so the
--     few legacy checks that look at profiles.role keep coarse-correct values.
-- =============================================================================

-- --- "roles" area ------------------------------------------------------------------
ALTER TABLE public.org_role_permissions DROP CONSTRAINT IF EXISTS org_role_permissions_area_check;
ALTER TABLE public.org_role_permissions ADD CONSTRAINT org_role_permissions_area_check
  CHECK (area IN ('rota', 'timesheets', 'requests', 'announcements', 'members', 'wages', 'locations', 'activity', 'roles'));
INSERT INTO public.org_role_permissions (role_id, area, can_read, can_write, can_delete)
  SELECT id, 'roles', true, true, true FROM public.org_roles WHERE preset_key = 'head_admin'
  ON CONFLICT DO NOTHING;

-- --- position = rank -----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.level_for_position(p smallint)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN p >= 40 THEN 'Head Admin' WHEN p >= 30 THEN 'Admin' WHEN p >= 20 THEN 'Manager'
              WHEN p >= 10 THEN 'Supervisor' ELSE 'Employee' END;
$$;

ALTER TABLE public.org_roles ALTER COLUMN sort DROP DEFAULT;
ALTER TABLE public.org_roles DROP CONSTRAINT IF EXISTS org_roles_sort_range;
ALTER TABLE public.org_roles ADD CONSTRAINT org_roles_sort_range CHECK (sort BETWEEN 0 AND 40);
ALTER TABLE public.org_roles DROP CONSTRAINT IF EXISTS org_roles_sort_head;
ALTER TABLE public.org_roles ADD CONSTRAINT org_roles_sort_head CHECK ((preset_key IS NOT DISTINCT FROM 'head_admin') = (sort = 40));
ALTER TABLE public.org_roles DROP CONSTRAINT IF EXISTS org_roles_position_uniq;
ALTER TABLE public.org_roles ADD CONSTRAINT org_roles_position_uniq UNIQUE (organization_id, sort) DEFERRABLE INITIALLY DEFERRED;

-- Rank of a profile from its role (Superadmin 100; no role → the legacy level).
CREATE OR REPLACE FUNCTION public.org_role_rank(p_org_role uuid, p_role text)
RETURNS smallint LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT (CASE WHEN p_role = 'Superadmin' THEN 100
               ELSE COALESCE((SELECT sort FROM public.org_roles WHERE id = p_org_role), public.role_rank(p_role)) END)::smallint;
$$;

CREATE OR REPLACE FUNCTION public.profile_rank(p_user uuid)
RETURNS smallint LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$ SELECT COALESCE((SELECT public.org_role_rank(p.org_role_id, p.role) FROM public.profiles p WHERE p.id = p_user), 0)::smallint; $$;

CREATE OR REPLACE FUNCTION public.my_role_rank()
RETURNS smallint LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$ SELECT public.profile_rank(auth.uid()); $$;

-- Before insert/move: derive the level; a new role without a position goes to
-- the BOTTOM (lowest free slot, like Discord) — move it up from there.
CREATE OR REPLACE FUNCTION public.org_roles_position()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_cap int; v_slot int;
BEGIN
  IF NEW.sort IS NULL THEN
    v_cap := LEAST(COALESCE(public.my_role_rank(), 40), 40) - 1;
    SELECT s INTO v_slot FROM generate_series(0, v_cap) s
     WHERE NOT EXISTS (SELECT 1 FROM public.org_roles r WHERE r.organization_id = NEW.organization_id AND r.sort = s)
     LIMIT 1;
    IF v_slot IS NULL THEN
      RAISE EXCEPTION 'There is no room for another role below yours.' USING ERRCODE = 'check_violation';
    END IF;
    NEW.sort := v_slot;
  END IF;
  NEW.base_role := public.level_for_position(NEW.sort::smallint);
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS org_roles_position ON public.org_roles;
CREATE TRIGGER org_roles_position BEFORE INSERT OR UPDATE ON public.org_roles FOR EACH ROW EXECUTE FUNCTION public.org_roles_position();

-- Presets no longer keep a fixed level (they move like any role); only the
-- Head Admin preset is locked (name; position via CHECK).
CREATE OR REPLACE FUNCTION public.guard_org_roles()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
AS $$
BEGIN
  IF OLD.preset_key = 'head_admin' AND NEW.name IS DISTINCT FROM OLD.name THEN
    RAISE EXCEPTION 'The Head Admin role is locked.' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

-- A role moving changes its level → its members follow (without tripping the
-- member-privilege check: this is a role edit, authorized on org_roles).
CREATE OR REPLACE FUNCTION public.propagate_org_role_level()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  PERFORM set_config('app.role_sync', 'on', true);
  UPDATE public.profiles SET role = NEW.base_role WHERE org_role_id = NEW.id AND role IS DISTINCT FROM NEW.base_role;
  PERFORM set_config('app.role_sync', 'off', true);
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS propagate_org_role_level ON public.org_roles;
CREATE TRIGGER propagate_org_role_level AFTER UPDATE ON public.org_roles
  FOR EACH ROW WHEN (NEW.base_role IS DISTINCT FROM OLD.base_role) EXECUTE FUNCTION public.propagate_org_role_level();

-- Level-only assignments (legacy / level invites): the level's preset, else the
-- highest role at or below that level.
CREATE OR REPLACE FUNCTION public.sync_profile_org_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_role public.org_roles;
  v_picked boolean;
BEGIN
  IF NEW.role = 'Superadmin' THEN
    NEW.org_role_id := NULL;
    RETURN NEW;
  END IF;
  v_picked := NEW.org_role_id IS NOT NULL
              AND (TG_OP = 'INSERT' OR NEW.org_role_id IS DISTINCT FROM OLD.org_role_id);
  IF v_picked THEN
    SELECT * INTO v_role FROM public.org_roles WHERE id = NEW.org_role_id;
    IF NOT FOUND OR v_role.organization_id <> NEW.organization_id THEN
      RAISE EXCEPTION 'That role belongs to another organization.' USING ERRCODE = 'check_violation';
    END IF;
    NEW.role := v_role.base_role;
  ELSIF TG_OP = 'INSERT' OR NEW.org_role_id IS NULL
        OR NEW.role IS DISTINCT FROM OLD.role OR NEW.organization_id IS DISTINCT FROM OLD.organization_id THEN
    IF NOT EXISTS (SELECT 1 FROM public.org_roles
                    WHERE id = NEW.org_role_id AND organization_id = NEW.organization_id AND base_role = NEW.role) THEN
      SELECT r.* INTO v_role
        FROM public.org_roles r
       WHERE r.organization_id = NEW.organization_id AND r.sort <= public.role_rank(NEW.role)
       ORDER BY (r.preset_key IS NOT NULL AND r.base_role = NEW.role) DESC, r.sort DESC
       LIMIT 1;
      IF FOUND THEN
        NEW.org_role_id := v_role.id;
        NEW.role := v_role.base_role;
      ELSE
        NEW.org_role_id := NULL;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Head Admin = position 40.
CREATE OR REPLACE FUNCTION public.profile_has_permission(p_user uuid, p_area text, p_action text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.profiles pr
      LEFT JOIN public.org_role_permissions op ON op.role_id = pr.org_role_id AND op.area = p_area
     WHERE pr.id = p_user
       AND (pr.role = 'Superadmin'
            OR public.org_role_rank(pr.org_role_id, pr.role) >= 40
            OR CASE p_action WHEN 'read' THEN op.can_read WHEN 'write' THEN op.can_write WHEN 'delete' THEN op.can_delete ELSE false END)
  );
$$;

-- --- Who may edit roles: "roles" holders, for roles below their own ----------------
DROP POLICY IF EXISTS "org_roles_insert" ON public.org_roles;
CREATE POLICY "org_roles_insert" ON public.org_roles FOR INSERT TO authenticated
  WITH CHECK (preset_key IS NULL AND (is_superadmin() OR (organization_id = get_my_org_id()
              AND (SELECT has_permission('roles', 'write')) AND sort < my_role_rank())));
DROP POLICY IF EXISTS "org_roles_update" ON public.org_roles;
CREATE POLICY "org_roles_update" ON public.org_roles FOR UPDATE TO authenticated
  USING (is_superadmin() OR (organization_id = get_my_org_id() AND (SELECT has_permission('roles', 'write')) AND sort < my_role_rank()))
  WITH CHECK (is_superadmin() OR (organization_id = get_my_org_id() AND sort < my_role_rank()));
DROP POLICY IF EXISTS "org_roles_delete" ON public.org_roles;
CREATE POLICY "org_roles_delete" ON public.org_roles FOR DELETE TO authenticated
  USING (preset_key IS DISTINCT FROM 'head_admin' AND (is_superadmin() OR (organization_id = get_my_org_id()
         AND (SELECT has_permission('roles', 'delete')) AND sort < my_role_rank())));

DROP POLICY IF EXISTS "org_role_perms_write" ON public.org_role_permissions;
CREATE POLICY "org_role_perms_write" ON public.org_role_permissions FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.org_roles r WHERE r.id = role_id AND r.preset_key IS DISTINCT FROM 'head_admin'
                 AND (is_superadmin() OR (r.organization_id = get_my_org_id() AND (SELECT has_permission('roles', 'write')) AND r.sort < my_role_rank()))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.org_roles r WHERE r.id = role_id AND r.preset_key IS DISTINCT FROM 'head_admin'
                 AND (is_superadmin() OR (r.organization_id = get_my_org_id() AND (SELECT has_permission('roles', 'write')) AND r.sort < my_role_rank()))));

-- You can only change permissions you hold yourself (Discord rule).
CREATE OR REPLACE FUNCTION public.guard_grant_own_permissions()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
AS $$
BEGIN
  IF current_user NOT IN ('authenticated') OR public.is_superadmin() OR public.my_role_rank() >= 40 THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  IF TG_OP = 'DELETE' THEN
    IF (OLD.can_read AND NOT public.has_permission(OLD.area, 'read'))
       OR (OLD.can_write AND NOT public.has_permission(OLD.area, 'write'))
       OR (OLD.can_delete AND NOT public.has_permission(OLD.area, 'delete')) THEN
      RAISE EXCEPTION 'You can only change permissions you have yourself.' USING ERRCODE = '42501';
    END IF;
    RETURN OLD;
  END IF;
  IF (NEW.can_read IS DISTINCT FROM (CASE WHEN TG_OP = 'UPDATE' THEN OLD.can_read ELSE false END) AND NOT public.has_permission(NEW.area, 'read'))
     OR (NEW.can_write IS DISTINCT FROM (CASE WHEN TG_OP = 'UPDATE' THEN OLD.can_write ELSE false END) AND NOT public.has_permission(NEW.area, 'write'))
     OR (NEW.can_delete IS DISTINCT FROM (CASE WHEN TG_OP = 'UPDATE' THEN OLD.can_delete ELSE false END) AND NOT public.has_permission(NEW.area, 'delete')) THEN
    RAISE EXCEPTION 'You can only change permissions you have yourself.' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS guard_grant_own_permissions ON public.org_role_permissions;
CREATE TRIGGER guard_grant_own_permissions BEFORE INSERT OR UPDATE OR DELETE ON public.org_role_permissions
  FOR EACH ROW EXECUTE FUNCTION public.guard_grant_own_permissions();

-- Move a role one step up or down (swap with its neighbour); both must sit
-- below the caller's role. Head Admin never moves.
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
  IF v_role.preset_key = 'head_admin' THEN
    RAISE EXCEPTION 'The Head Admin role always stays on top.' USING ERRCODE = 'check_violation';
  END IF;
  SELECT * INTO v_nb FROM public.org_roles
   WHERE organization_id = v_role.organization_id AND preset_key IS DISTINCT FROM 'head_admin'
     AND CASE WHEN p_up THEN sort > v_role.sort ELSE sort < v_role.sort END
   ORDER BY CASE WHEN p_up THEN sort END ASC, CASE WHEN NOT p_up THEN sort END DESC
   LIMIT 1 FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;  -- already at the edge
  IF NOT public.is_superadmin() AND (v_role.sort >= v_me OR v_nb.sort >= v_me) THEN
    RAISE EXCEPTION 'You can only move roles below your own.' USING ERRCODE = '42501';
  END IF;
  v_a := v_role.sort;
  UPDATE public.org_roles SET sort = v_nb.sort WHERE id = v_role.id;
  UPDATE public.org_roles SET sort = v_a WHERE id = v_nb.id;
END;
$$;

REVOKE ALL ON FUNCTION public.move_org_role(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.move_org_role(uuid, boolean) TO authenticated;
REVOKE ALL ON FUNCTION public.org_roles_position() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.propagate_org_role_level() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.org_role_rank(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.org_role_rank(uuid, text) TO authenticated;
REVOKE ALL ON FUNCTION public.profile_rank(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.profile_rank(uuid) TO service_role;

-- New organizations: Head Admin also gets the roles area.
CREATE OR REPLACE FUNCTION public._seed_org_roles(p_org uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_id uuid;
  a text;
  all_areas text[] := ARRAY['rota', 'timesheets', 'requests', 'announcements', 'members', 'wages', 'locations', 'activity', 'roles'];
BEGIN
  INSERT INTO public.org_roles (organization_id, name, color, base_role, preset_key, sort) VALUES
    (p_org, 'Employee',   '#22c55e', 'Employee',   'employee',   0),
    (p_org, 'Supervisor', '#3b82f6', 'Supervisor', 'supervisor', 10),
    (p_org, 'Manager',    '#eab308', 'Manager',    'manager',    20),
    (p_org, 'Admin',      '#ef4444', 'Admin',      'admin',      30),
    (p_org, 'Head Admin', '#f59e0b', 'Head Admin', 'head_admin', 40)
  ON CONFLICT DO NOTHING;

  SELECT id INTO v_id FROM public.org_roles WHERE organization_id = p_org AND preset_key = 'manager';
  FOREACH a IN ARRAY ARRAY['rota', 'timesheets', 'requests', 'members', 'announcements'] LOOP
    INSERT INTO public.org_role_permissions (role_id, area, can_read) VALUES (v_id, a, true) ON CONFLICT DO NOTHING;
  END LOOP;

  SELECT id INTO v_id FROM public.org_roles WHERE organization_id = p_org AND preset_key = 'admin';
  FOREACH a IN ARRAY ARRAY['rota', 'timesheets', 'requests', 'announcements', 'members', 'wages'] LOOP
    INSERT INTO public.org_role_permissions (role_id, area, can_read, can_write, can_delete) VALUES (v_id, a, true, true, true) ON CONFLICT DO NOTHING;
  END LOOP;
  INSERT INTO public.org_role_permissions (role_id, area, can_read) VALUES (v_id, 'locations', true), (v_id, 'activity', true) ON CONFLICT DO NOTHING;

  SELECT id INTO v_id FROM public.org_roles WHERE organization_id = p_org AND preset_key = 'head_admin';
  FOREACH a IN ARRAY all_areas LOOP
    INSERT INTO public.org_role_permissions (role_id, area, can_read, can_write, can_delete) VALUES (v_id, a, true, true, true) ON CONFLICT DO NOTHING;
  END LOOP;
END;
$$;

-- --- Hierarchy comparisons use the role position ------------------------------------
DROP POLICY IF EXISTS "profiles_update" ON public.profiles;
CREATE POLICY "profiles_update" ON public.profiles FOR UPDATE TO authenticated
  USING (is_superadmin() OR (SELECT auth.uid()) = id
         OR ((SELECT has_permission('members', 'write')) AND organization_id = get_my_org_id() AND org_role_rank(org_role_id, role) < my_role_rank()))
  WITH CHECK (is_superadmin() OR (SELECT auth.uid()) = id
         OR (organization_id = get_my_org_id() AND org_role_rank(org_role_id, role) < my_role_rank()));
DROP POLICY IF EXISTS "profiles_delete" ON public.profiles;
CREATE POLICY "profiles_delete" ON public.profiles FOR DELETE TO authenticated
  USING (is_superadmin() OR ((SELECT has_permission('members', 'delete')) AND organization_id = get_my_org_id()
         AND org_role_rank(org_role_id, role) < my_role_rank() AND id <> (SELECT auth.uid())));

CREATE OR REPLACE FUNCTION public.enforce_profile_privilege()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- A role moving (propagate_org_role_level) re-syncs levels — that edit was
  -- authorized on org_roles already.
  IF current_setting('app.role_sync', true) = 'on' THEN
    RETURN NEW;
  END IF;
  IF NEW.role IS DISTINCT FROM OLD.role
     OR NEW.organization_id IS DISTINCT FROM OLD.organization_id
     OR NEW.org_role_id IS DISTINCT FROM OLD.org_role_id THEN

    IF public.is_superadmin() THEN
      RETURN NEW;
    END IF;

    IF public.has_permission('members', 'write')
       AND OLD.organization_id = public.get_my_org_id()
       AND NEW.organization_id = OLD.organization_id          -- non-superadmins can't move orgs
       AND public.org_role_rank(OLD.org_role_id, OLD.role) < public.my_role_rank()  -- target below me
       AND public.org_role_rank(NEW.org_role_id, NEW.role) < public.my_role_rank()  -- new role below me
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
          AND public.org_role_rank(OLD.org_role_id, OLD.role) < v_rank THEN
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
     OR public.org_role_rank(v_target.org_role_id, v_target.role) >= v_rank THEN
    RAISE EXCEPTION 'You are not allowed to manage this member''s shifts.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN v_target;
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
  IF public.org_role_rank(v_target.org_role_id, v_target.role) >= v_caller_rank AND NOT is_superadmin() THEN
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

CREATE OR REPLACE FUNCTION public.is_my_subordinate(target uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
      FROM public.profiles p
     WHERE p.id = target
       AND p.id <> auth.uid()
       AND p.organization_id = public.get_my_org_id()
       AND public.org_role_rank(p.org_role_id, p.role) < public.my_role_rank()
  );
$function$;

-- =============================================================================
-- DEFAULT ROLE (product owner, 2026-11-06) — "Employee" works like Discord's
-- @everyone: every member has it underneath their own role, it always sits at
-- the bottom (position 0), it can't be moved or deleted, and its permissions
-- add to everyone's. Deleting any other role moves its people onto it.
-- =============================================================================
ALTER TABLE public.org_roles DROP CONSTRAINT IF EXISTS org_roles_sort_default;
ALTER TABLE public.org_roles ADD CONSTRAINT org_roles_sort_default CHECK ((preset_key IS NOT DISTINCT FROM 'employee') = (sort = 0));

-- Effective permissions = own role ∪ the organization's default role.
CREATE OR REPLACE FUNCTION public.profile_has_permission(p_user uuid, p_area text, p_action text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.profiles pr
      LEFT JOIN public.org_role_permissions op ON op.role_id = pr.org_role_id AND op.area = p_area
      LEFT JOIN public.org_roles dr ON dr.organization_id = pr.organization_id AND dr.preset_key = 'employee'
      LEFT JOIN public.org_role_permissions dp ON dp.role_id = dr.id AND dp.area = p_area
     WHERE pr.id = p_user
       AND (pr.role = 'Superadmin'
            OR public.org_role_rank(pr.org_role_id, pr.role) >= 40
            OR CASE p_action WHEN 'read' THEN op.can_read OR dp.can_read
                             WHEN 'write' THEN op.can_write OR dp.can_write
                             WHEN 'delete' THEN op.can_delete OR dp.can_delete
                             ELSE false END)
  );
$$;

-- Deleting a role moves its people to the default role first.
CREATE OR REPLACE FUNCTION public.org_roles_before_delete()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_default uuid;
BEGIN
  SELECT id INTO v_default FROM public.org_roles WHERE organization_id = OLD.organization_id AND preset_key = 'employee';
  IF v_default IS NOT NULL AND v_default <> OLD.id THEN
    PERFORM set_config('app.role_sync', 'on', true);
    UPDATE public.profiles SET org_role_id = v_default WHERE org_role_id = OLD.id;
    PERFORM set_config('app.role_sync', 'off', true);
  END IF;
  RETURN OLD;
END;
$$;
REVOKE ALL ON FUNCTION public.org_roles_before_delete() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS org_roles_before_delete ON public.org_roles;
CREATE TRIGGER org_roles_before_delete BEFORE DELETE ON public.org_roles FOR EACH ROW EXECUTE FUNCTION public.org_roles_before_delete();

-- The default role can't be deleted (Head Admin neither).
DROP POLICY IF EXISTS "org_roles_delete" ON public.org_roles;
CREATE POLICY "org_roles_delete" ON public.org_roles FOR DELETE TO authenticated
  USING (preset_key IS DISTINCT FROM 'head_admin' AND preset_key IS DISTINCT FROM 'employee'
         AND (is_superadmin() OR (organization_id = get_my_org_id()
         AND (SELECT has_permission('roles', 'delete')) AND sort < my_role_rank())));

-- Moving never touches the top (Head Admin) or the bottom (default role).
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
END;
$$;
REVOKE ALL ON FUNCTION public.move_org_role(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.move_org_role(uuid, boolean) TO authenticated;

-- New roles land just above the default role (lowest free slot from 1).
CREATE OR REPLACE FUNCTION public.org_roles_position()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_cap int; v_slot int;
BEGIN
  IF NEW.sort IS NULL THEN
    v_cap := LEAST(COALESCE(public.my_role_rank(), 40), 40) - 1;
    SELECT s INTO v_slot FROM generate_series(1, v_cap) s
     WHERE NOT EXISTS (SELECT 1 FROM public.org_roles r WHERE r.organization_id = NEW.organization_id AND r.sort = s)
     LIMIT 1;
    IF v_slot IS NULL THEN
      RAISE EXCEPTION 'There is no room for another role below yours.' USING ERRCODE = 'check_violation';
    END IF;
    NEW.sort := v_slot;
  END IF;
  NEW.base_role := public.level_for_position(NEW.sort::smallint);
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.org_roles_position() FROM PUBLIC, anon, authenticated;

NOTIFY pgrst, 'reload schema';
