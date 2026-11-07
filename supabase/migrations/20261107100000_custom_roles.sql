-- =============================================================================
-- CUSTOM ROLES — a Head Admin defines roles with read / write / delete per area
-- (issue #124, Discord-style). User decisions 2026-11-06: today's roles become
-- EDITABLE PRESETS every organization gets; Head Admin is locked (full rights).
-- -----------------------------------------------------------------------------
-- Model
--   • org_roles              — per-organization roles: name, colour, sort and a
--                              LEVEL (base_role: Employee / Supervisor / Manager
--                              / Admin / Head Admin). The level keeps the rank
--                              hierarchy (who may manage whom, no escalation).
--   • org_role_permissions   — area × read / write / delete for each role.
--   • profiles.org_role_id   — the member's role. A trigger keeps profiles.role
--                              (the level) in sync, so every rank-based check
--                              (hierarchy, subordinates) keeps working.
--   • has_permission(area, action) replaces `my_role_rank() >= N` in RLS and
--     RPCs. Superadmin and Head Admin (rank >= 40) always pass.
-- Areas: rota, timesheets, requests, announcements, members, wages, locations,
-- activity. Presets reproduce today's behaviour exactly, so nothing changes on
-- day one.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.org_roles (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name            text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 40),
  color           text NOT NULL DEFAULT '#64748b' CHECK (color ~ '^#[0-9a-fA-F]{6}$'),
  base_role       text NOT NULL REFERENCES public.roles(name)
                  CHECK (base_role IN ('Employee', 'Supervisor', 'Manager', 'Admin', 'Head Admin')),
  preset_key      text CHECK (preset_key IN ('employee', 'supervisor', 'manager', 'admin', 'head_admin')),
  sort            smallint NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),
  -- Only the locked preset may sit at the Head Admin level.
  CHECK (base_role <> 'Head Admin' OR preset_key = 'head_admin')
);
CREATE UNIQUE INDEX IF NOT EXISTS org_roles_name_uniq ON public.org_roles (organization_id, lower(btrim(name)));
CREATE UNIQUE INDEX IF NOT EXISTS org_roles_preset_uniq ON public.org_roles (organization_id, preset_key) WHERE preset_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.org_role_permissions (
  role_id    uuid NOT NULL REFERENCES public.org_roles(id) ON DELETE CASCADE,
  area       text NOT NULL CHECK (area IN ('rota', 'timesheets', 'requests', 'announcements', 'members', 'wages', 'locations', 'activity')),
  can_read   boolean NOT NULL DEFAULT false,
  can_write  boolean NOT NULL DEFAULT false,
  can_delete boolean NOT NULL DEFAULT false,
  PRIMARY KEY (role_id, area),
  -- write implies read, delete implies write
  CHECK (NOT can_write OR can_read),
  CHECK (NOT can_delete OR can_write)
);

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS org_role_id uuid REFERENCES public.org_roles(id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS profiles_org_role_idx ON public.profiles (org_role_id);

-- --- Presets ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._seed_org_roles(p_org uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_id uuid;
  a text;
  all_areas text[] := ARRAY['rota', 'timesheets', 'requests', 'announcements', 'members', 'wages', 'locations', 'activity'];
BEGIN
  INSERT INTO public.org_roles (organization_id, name, color, base_role, preset_key, sort) VALUES
    (p_org, 'Employee',   '#22c55e', 'Employee',   'employee',   0),
    (p_org, 'Supervisor', '#3b82f6', 'Supervisor', 'supervisor', 10),
    (p_org, 'Manager',    '#eab308', 'Manager',    'manager',    20),
    (p_org, 'Admin',      '#ef4444', 'Admin',      'admin',      30),
    (p_org, 'Head Admin', '#f59e0b', 'Head Admin', 'head_admin', 40)
  ON CONFLICT DO NOTHING;

  -- Manager: observes (read) the team's rota, timesheets, requests, team, receipts.
  SELECT id INTO v_id FROM public.org_roles WHERE organization_id = p_org AND preset_key = 'manager';
  FOREACH a IN ARRAY ARRAY['rota', 'timesheets', 'requests', 'members', 'announcements'] LOOP
    INSERT INTO public.org_role_permissions (role_id, area, can_read) VALUES (v_id, a, true) ON CONFLICT DO NOTHING;
  END LOOP;

  -- Admin: acts everywhere except locations (read) and the activity log (read).
  SELECT id INTO v_id FROM public.org_roles WHERE organization_id = p_org AND preset_key = 'admin';
  FOREACH a IN ARRAY ARRAY['rota', 'timesheets', 'requests', 'announcements', 'members', 'wages'] LOOP
    INSERT INTO public.org_role_permissions (role_id, area, can_read, can_write, can_delete) VALUES (v_id, a, true, true, true) ON CONFLICT DO NOTHING;
  END LOOP;
  INSERT INTO public.org_role_permissions (role_id, area, can_read) VALUES (v_id, 'locations', true), (v_id, 'activity', true) ON CONFLICT DO NOTHING;

  -- Head Admin: everything (also short-circuited in has_permission).
  SELECT id INTO v_id FROM public.org_roles WHERE organization_id = p_org AND preset_key = 'head_admin';
  FOREACH a IN ARRAY all_areas LOOP
    INSERT INTO public.org_role_permissions (role_id, area, can_read, can_write, can_delete) VALUES (v_id, a, true, true, true) ON CONFLICT DO NOTHING;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public._seed_org_roles_trigger()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$ BEGIN PERFORM public._seed_org_roles(NEW.id); RETURN NEW; END; $$;
DROP TRIGGER IF EXISTS seed_org_roles ON public.organizations;
CREATE TRIGGER seed_org_roles AFTER INSERT ON public.organizations FOR EACH ROW EXECUTE FUNCTION public._seed_org_roles_trigger();

DO $$ DECLARE o uuid; BEGIN FOR o IN SELECT id FROM public.organizations LOOP PERFORM public._seed_org_roles(o); END LOOP; END $$;

-- --- profiles.role ⇄ org_role_id sync -------------------------------------------
-- Named "a_…" so it runs BEFORE enforce_profile_privilege (alphabetical order):
-- the privilege check then validates the synced level.
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
    -- A role was picked: its level becomes profiles.role.
    SELECT * INTO v_role FROM public.org_roles WHERE id = NEW.org_role_id;
    IF NOT FOUND OR v_role.organization_id <> NEW.organization_id THEN
      RAISE EXCEPTION 'That role belongs to another organization.' USING ERRCODE = 'check_violation';
    END IF;
    NEW.role := v_role.base_role;
  ELSIF TG_OP = 'INSERT' OR NEW.org_role_id IS NULL
        OR NEW.role IS DISTINCT FROM OLD.role OR NEW.organization_id IS DISTINCT FROM OLD.organization_id THEN
    -- The level was set directly (invites, legacy screens, a role's level
    -- moving): keep the current role if it sits at that level, else use the
    -- level's preset.
    IF NOT EXISTS (SELECT 1 FROM public.org_roles
                    WHERE id = NEW.org_role_id AND organization_id = NEW.organization_id AND base_role = NEW.role) THEN
      -- The level's preset; if it was deleted, another role at that level; if
      -- the level has none, the nearest role BELOW it (never more rights). In
      -- that last case the level follows the role.
      SELECT r.* INTO v_role
        FROM public.org_roles r
       WHERE r.organization_id = NEW.organization_id AND public.role_rank(r.base_role) <= public.role_rank(NEW.role)
       ORDER BY public.role_rank(r.base_role) DESC, (r.preset_key IS NULL), r.sort
       LIMIT 1;
      IF FOUND THEN
        NEW.org_role_id := v_role.id;
        NEW.role := v_role.base_role;
      ELSE
        NEW.org_role_id := NULL;  -- no role at or below this level: no permissions
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS a_sync_org_role ON public.profiles;
CREATE TRIGGER a_sync_org_role BEFORE INSERT OR UPDATE OF role, org_role_id, organization_id ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.sync_profile_org_role();

-- Backfill every existing member onto their level's preset.
UPDATE public.profiles p SET org_role_id = r.id
  FROM public.org_roles r
 WHERE r.organization_id = p.organization_id AND r.preset_key IS NOT NULL AND r.base_role = p.role AND p.org_role_id IS NULL;

-- --- Permission checks ------------------------------------------------------------
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
            OR public.role_rank(pr.role) >= 40
            OR CASE p_action WHEN 'read' THEN op.can_read WHEN 'write' THEN op.can_write WHEN 'delete' THEN op.can_delete ELSE false END)
  );
$$;

CREATE OR REPLACE FUNCTION public.has_permission(p_area text, p_action text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$ SELECT public.profile_has_permission(auth.uid(), p_area, p_action); $$;

REVOKE ALL ON FUNCTION public._seed_org_roles(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._seed_org_roles_trigger() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_profile_org_role() FROM PUBLIC, anon, authenticated;
-- Only the database itself asks about OTHER people's permissions (notification
-- recipients); has_permission() is the one the API and RLS use.
REVOKE ALL ON FUNCTION public.profile_has_permission(uuid, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.has_permission(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_permission(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.profile_has_permission(uuid, text, text) TO service_role;  -- invite-employee

-- --- Roles are managed by the Head Admin ------------------------------------------
ALTER TABLE public.org_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_role_permissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org_roles_select" ON public.org_roles;
CREATE POLICY "org_roles_select" ON public.org_roles FOR SELECT TO authenticated
  USING (is_superadmin() OR organization_id = get_my_org_id());
-- Head Admin manages roles. Presets are created by the system (seeding runs as
-- the table owner, which bypasses RLS). Any role nobody holds can be deleted
-- (FK RESTRICT protects roles in use) — except the Head Admin preset, whose
-- permissions can't be touched either.
DROP POLICY IF EXISTS "org_roles_write" ON public.org_roles;
DROP POLICY IF EXISTS "org_roles_insert" ON public.org_roles;
CREATE POLICY "org_roles_insert" ON public.org_roles FOR INSERT TO authenticated
  WITH CHECK (preset_key IS NULL AND (is_superadmin() OR (my_role_rank() >= 40 AND organization_id = get_my_org_id())));
DROP POLICY IF EXISTS "org_roles_update" ON public.org_roles;
CREATE POLICY "org_roles_update" ON public.org_roles FOR UPDATE TO authenticated
  USING (is_superadmin() OR (my_role_rank() >= 40 AND organization_id = get_my_org_id()))
  WITH CHECK (is_superadmin() OR (my_role_rank() >= 40 AND organization_id = get_my_org_id()));
DROP POLICY IF EXISTS "org_roles_delete" ON public.org_roles;
CREATE POLICY "org_roles_delete" ON public.org_roles FOR DELETE TO authenticated
  USING (preset_key IS DISTINCT FROM 'head_admin' AND (is_superadmin() OR (my_role_rank() >= 40 AND organization_id = get_my_org_id())));

DROP POLICY IF EXISTS "org_role_perms_select" ON public.org_role_permissions;
CREATE POLICY "org_role_perms_select" ON public.org_role_permissions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.org_roles r WHERE r.id = role_id AND (is_superadmin() OR r.organization_id = get_my_org_id())));
DROP POLICY IF EXISTS "org_role_perms_write" ON public.org_role_permissions;
CREATE POLICY "org_role_perms_write" ON public.org_role_permissions FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.org_roles r WHERE r.id = role_id AND r.preset_key IS DISTINCT FROM 'head_admin'
                 AND (is_superadmin() OR (my_role_rank() >= 40 AND r.organization_id = get_my_org_id()))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.org_roles r WHERE r.id = role_id AND r.preset_key IS DISTINCT FROM 'head_admin'
                 AND (is_superadmin() OR (my_role_rank() >= 40 AND r.organization_id = get_my_org_id()))));

-- A preset keeps its level; the Head Admin preset keeps its name too.
CREATE OR REPLACE FUNCTION public.guard_org_roles()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
AS $$
BEGIN
  IF OLD.preset_key IS NOT NULL AND (NEW.base_role IS DISTINCT FROM OLD.base_role OR NEW.preset_key IS DISTINCT FROM OLD.preset_key) THEN
    RAISE EXCEPTION 'A preset keeps its level.' USING ERRCODE = 'check_violation';
  END IF;
  IF OLD.preset_key = 'head_admin' AND NEW.name IS DISTINCT FROM OLD.name THEN
    RAISE EXCEPTION 'The Head Admin role is locked.' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS guard_org_roles ON public.org_roles;
CREATE TRIGGER guard_org_roles BEFORE UPDATE ON public.org_roles FOR EACH ROW EXECUTE FUNCTION public.guard_org_roles();

-- Changing a custom role's level moves everyone holding it to that level.
CREATE OR REPLACE FUNCTION public.propagate_org_role_level()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.profiles SET role = NEW.base_role WHERE org_role_id = NEW.id AND role IS DISTINCT FROM NEW.base_role;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.propagate_org_role_level() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS propagate_org_role_level ON public.org_roles;
CREATE TRIGGER propagate_org_role_level AFTER UPDATE OF base_role ON public.org_roles
  FOR EACH ROW WHEN (NEW.base_role IS DISTINCT FROM OLD.base_role) EXECUTE FUNCTION public.propagate_org_role_level();

ALTER TABLE public.org_roles REPLICA IDENTITY FULL;
ALTER TABLE public.org_role_permissions REPLICA IDENTITY FULL;




-- --- Invites can assign an organization role --------------------------------------
-- Same as 20261106160000_owner_signup, plus the invite's org_role_id.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_trusted  boolean := new.invited_at IS NOT NULL OR (new.raw_app_meta_data ? 'organization_id');
  v_org_id   uuid;
  v_org_name text;
  v_slug     text;
  v_role     text;
  v_base     text;
  v_username text;
  v_suffix   int := 0;
BEGIN
  IF v_trusted THEN
    v_org_id := COALESCE(
      NULLIF(new.raw_app_meta_data->>'organization_id', '')::uuid,
      NULLIF(new.raw_user_meta_data->>'organization_id', '')::uuid
    );
    IF v_org_id IS NULL THEN
      SELECT id INTO v_org_id FROM public.organizations WHERE slug = 'default-org';
    END IF;
    IF v_org_id IS NULL THEN
      RAISE EXCEPTION 'No organization for new user: provide organization_id metadata or seed a "default-org".';
    END IF;
    v_role := COALESCE(
      NULLIF(new.raw_app_meta_data->>'role', ''),
      NULLIF(new.raw_user_meta_data->>'role', ''),
      'Employee'
    );
  ELSE
    -- Self sign-up → owner of a brand-new organization.
    v_org_name := left(btrim(COALESCE(new.raw_user_meta_data->>'organization_name', '')), 80);
    IF v_org_name = '' THEN
      RAISE EXCEPTION 'Sign-up needs an organization name.' USING ERRCODE = 'check_violation';
    END IF;
    v_slug := trim(BOTH '-' FROM regexp_replace(translate(lower(v_org_name), 'áäčďéěëíňóöřšťúůüýž', 'aacdeeeinoorstuuuyz'), '[^a-z0-9]+', '-', 'g'));
    v_slug := left(COALESCE(NULLIF(v_slug, ''), 'org'), 40) || '-' || substr(md5(random()::text || new.id::text), 1, 6);
    INSERT INTO public.organizations (name, slug) VALUES (v_org_name, v_slug) RETURNING id INTO v_org_id;
    v_role := 'Head Admin';
  END IF;

  v_base := CASE WHEN v_trusted THEN
      -- Invites: unchanged behaviour (the invite may carry a chosen username).
      COALESCE(NULLIF(new.raw_user_meta_data->>'username', ''), NULLIF(split_part(new.email, '@', 1), ''), 'user_' || substr(md5(random()::text), 1, 8))
    ELSE
      -- Self sign-up: a clean handle from the email (they can change it later).
      COALESCE(NULLIF(regexp_replace(lower(split_part(new.email, '@', 1)), '[^a-z0-9._]+', '', 'g'), ''), 'user_' || substr(md5(random()::text), 1, 8))
  END;
  v_username := v_base;
  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE username = v_username) LOOP
    v_suffix := v_suffix + 1;
    v_username := v_base || v_suffix;
  END LOOP;

  INSERT INTO public.profiles (id, username, role, email, organization_id, org_role_id, first_name, last_name)
  VALUES (
    new.id,
    v_username,
    v_role,
    new.email,
    v_org_id,
    -- Invites may name an organization role (the sync trigger checks it
    -- belongs to the org and sets the level from it). Self sign-ups: none.
    CASE WHEN v_trusted THEN NULLIF(new.raw_user_meta_data->>'org_role_id', '')::uuid END,
    NULLIF(left(btrim(new.raw_user_meta_data->>'first_name'), 60), ''),
    NULLIF(left(btrim(new.raw_user_meta_data->>'last_name'), 60), '')
  );

  RETURN new;
END;
$function$;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

NOTIFY pgrst, 'reload schema';
