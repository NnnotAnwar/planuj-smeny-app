-- =============================================================================
-- ADMIN ORG MANAGEMENT
-- -----------------------------------------------------------------------------
-- Superadmins already have full access via is_superadmin(). This migration lets
-- organization-scoped admins (any role flagged is_admin = true, e.g. Admin /
-- Manager) manage their OWN organization from the Admin Panel:
--   * create / update / delete locations in their org
--   * update / delete member profiles in their org (never a Superadmin)
--
-- All checks go through SECURITY DEFINER helpers to avoid RLS recursion on the
-- profiles table (same pattern as get_my_org_id / is_superadmin).
-- =============================================================================

-- Helper: is the current user an admin within their organization?
CREATE OR REPLACE FUNCTION public.is_org_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin boolean;
BEGIN
  SELECT r.is_admin
    INTO v_is_admin
  FROM public.profiles p
  JOIN public.roles r ON r.name = p.role
  WHERE p.id = auth.uid();

  RETURN COALESCE(v_is_admin, false);
END;
$$;

GRANT ALL ON FUNCTION public.is_org_admin() TO anon, authenticated, service_role;

-- --- LOCATIONS: org admins get full control within their own organization ----
DROP POLICY IF EXISTS "Org admins manage locations" ON public.locations;
CREATE POLICY "Org admins manage locations"
ON public.locations FOR ALL TO authenticated
USING (public.is_org_admin() AND organization_id = public.get_my_org_id())
WITH CHECK (public.is_org_admin() AND organization_id = public.get_my_org_id());

-- --- PROFILES: org admins manage members in their org (except Superadmins) ---
DROP POLICY IF EXISTS "Org admins update members" ON public.profiles;
CREATE POLICY "Org admins update members"
ON public.profiles FOR UPDATE TO authenticated
USING (
  public.is_org_admin()
  AND organization_id = public.get_my_org_id()
  AND role <> 'Superadmin'
)
WITH CHECK (
  organization_id = public.get_my_org_id()
  AND role <> 'Superadmin'
);

DROP POLICY IF EXISTS "Org admins delete members" ON public.profiles;
CREATE POLICY "Org admins delete members"
ON public.profiles FOR DELETE TO authenticated
USING (
  public.is_org_admin()
  AND organization_id = public.get_my_org_id()
  AND role <> 'Superadmin'
  AND id <> auth.uid()            -- an admin can't delete their own account
);
