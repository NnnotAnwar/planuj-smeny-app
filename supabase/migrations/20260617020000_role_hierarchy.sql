-- =============================================================================
-- ROLE HIERARCHY (ranks) + permission tightening
-- -----------------------------------------------------------------------------
-- Replaces the single is_admin "can do everything" flag with a ranked hierarchy:
--
--   Superadmin (100) > Head Admin (40) > Admin (30) > Manager (20)
--                    > Supervisor (10) > Employee (0)
--
-- Capabilities (within one organization):
--   * View admin panel : rank >= Manager (20)        -> is_admin = true
--   * Invite / manage   : rank >= Admin   (30)
--   * Manage locations  : rank >= Head Admin (40)     -> "owner"
--   * Assign/invite role: only to a role with rank STRICTLY below your own
--       - Head Admin can grant up to Admin
--       - Admin      can grant up to Manager
--       - Manager    can grant nothing (view only)
--   * Only Superadmin can grant Head Admin.
--
-- A user can never change their OWN role/organization, and an admin can only
-- act on members ranked below themselves. Enforced by both RLS and a trigger.
-- =============================================================================

-- 1. Rank column ------------------------------------------------------------
ALTER TABLE public.roles ADD COLUMN IF NOT EXISTS rank smallint NOT NULL DEFAULT 0;

-- 2. Roles + ranks (adds the new "Head Admin" owner role) -------------------
INSERT INTO public.roles (name, color, description, is_admin, rank) VALUES
  ('Superadmin', '#9333ea', 'Full system access',   true,  100),
  ('Head Admin', '#f59e0b', 'Organization owner',    true,  40),
  ('Admin',      '#ef4444', 'Organization admin',    true,  30),
  ('Manager',    '#eab308', 'View only',             true,  20),
  ('Supervisor', '#3b82f6', 'Shift control',         false, 10),
  ('Employee',   '#22c55e', 'Employee',              false, 0)
ON CONFLICT (name) DO UPDATE
  SET is_admin    = EXCLUDED.is_admin,
      rank        = EXCLUDED.rank,
      description = EXCLUDED.description;

-- 3. Rank helper functions (SECURITY DEFINER, no RLS recursion) -------------
CREATE OR REPLACE FUNCTION public.role_rank(p_role text)
RETURNS smallint LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT rank FROM public.roles WHERE name = p_role), 0)::smallint;
$$;

CREATE OR REPLACE FUNCTION public.my_role_rank()
RETURNS smallint LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(
    (SELECT r.rank
       FROM public.profiles p
       JOIN public.roles r ON r.name = p.role
      WHERE p.id = auth.uid()),
    0)::smallint;
$$;

GRANT ALL ON FUNCTION public.role_rank(text)  TO anon, authenticated, service_role;
GRANT ALL ON FUNCTION public.my_role_rank()   TO anon, authenticated, service_role;

-- 4. Remove the old over-permissive policies (they let Manager write) -------
DROP POLICY IF EXISTS "Org admins manage locations" ON public.locations;
DROP POLICY IF EXISTS "Org admins update members"   ON public.profiles;
DROP POLICY IF EXISTS "Org admins delete members"   ON public.profiles;
DROP FUNCTION IF EXISTS public.is_org_admin();

-- 5. Rank-based policies -----------------------------------------------------

-- Locations: only owners (Head Admin+) manage their own org's locations.
CREATE POLICY "Owners manage locations"
ON public.locations FOR ALL TO authenticated
USING (public.my_role_rank() >= 40 AND organization_id = public.get_my_org_id())
WITH CHECK (public.my_role_rank() >= 40 AND organization_id = public.get_my_org_id());

-- Profiles UPDATE: Admin+ may update members ranked below them, and may only
-- set a role ranked below them (the new-row role cannot reach their own level).
CREATE POLICY "Admins update lower members"
ON public.profiles FOR UPDATE TO authenticated
USING (
  public.my_role_rank() >= 30
  AND organization_id = public.get_my_org_id()
  AND public.role_rank(role) < public.my_role_rank()
)
WITH CHECK (
  organization_id = public.get_my_org_id()
  AND public.role_rank(role) < public.my_role_rank()
);

-- Profiles DELETE: Admin+ may remove members ranked below them (never self).
CREATE POLICY "Admins delete lower members"
ON public.profiles FOR DELETE TO authenticated
USING (
  public.my_role_rank() >= 30
  AND organization_id = public.get_my_org_id()
  AND public.role_rank(role) < public.my_role_rank()
  AND id <> auth.uid()
);

-- 6. Defense-in-depth: a BEFORE UPDATE trigger that forbids changing the role
--    or organization unless the actor is a Superadmin, or out-ranks BOTH the
--    target's current and new role within the same org. This blocks self
--    escalation even through the "Users can update own profile" policy.
CREATE OR REPLACE FUNCTION public.enforce_profile_privilege()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role
     OR NEW.organization_id IS DISTINCT FROM OLD.organization_id THEN

    IF public.is_superadmin() THEN
      RETURN NEW;
    END IF;

    IF public.my_role_rank() >= 30
       AND OLD.organization_id = public.get_my_org_id()
       AND NEW.organization_id = OLD.organization_id          -- non-superadmins can't move orgs
       AND public.role_rank(OLD.role) < public.my_role_rank()  -- target ranked below me
       AND public.role_rank(NEW.role) < public.my_role_rank()  -- new role ranked below me
    THEN
      RETURN NEW;
    END IF;

    RAISE EXCEPTION 'You are not allowed to change the role or organization of this user.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_profile_privilege_trigger ON public.profiles;
CREATE TRIGGER enforce_profile_privilege_trigger
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.enforce_profile_privilege();
