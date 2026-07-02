-- =============================================================================
-- CONSOLIDATE MULTIPLE PERMISSIVE RLS POLICIES  (#95)
-- -----------------------------------------------------------------------------
-- Each table had a separate "Superadmin full access" FOR ALL policy layered on
-- top of the role-specific policies (and some tables had 2–3 SELECT policies).
-- Multiple permissive policies for the same role+action are all evaluated on
-- every query (perf advisor 0006). Collapse to exactly ONE policy per action by
-- folding `is_superadmin()` into each base policy with OR. Behaviour is
-- preserved; writes that go through SECURITY DEFINER RPCs/triggers bypass RLS
-- and are unaffected. Idempotent (drops-if-exists then recreates).
-- =============================================================================

-- LOCATIONS ------------------------------------------------------------------
DROP POLICY IF EXISTS "Owners manage locations" ON public.locations;
DROP POLICY IF EXISTS "Superadmin full access to locations" ON public.locations;
DROP POLICY IF EXISTS "Allow users to view their organization locations" ON public.locations;
CREATE POLICY "locations_select" ON public.locations FOR SELECT TO authenticated
  USING (is_superadmin() OR organization_id = get_my_org_id());
CREATE POLICY "locations_insert" ON public.locations FOR INSERT TO authenticated
  WITH CHECK (is_superadmin() OR (my_role_rank() >= 40 AND organization_id = get_my_org_id()));
CREATE POLICY "locations_update" ON public.locations FOR UPDATE TO authenticated
  USING (is_superadmin() OR (my_role_rank() >= 40 AND organization_id = get_my_org_id()))
  WITH CHECK (is_superadmin() OR (my_role_rank() >= 40 AND organization_id = get_my_org_id()));
CREATE POLICY "locations_delete" ON public.locations FOR DELETE TO authenticated
  USING (is_superadmin() OR (my_role_rank() >= 40 AND organization_id = get_my_org_id()));

-- ORGANIZATIONS --------------------------------------------------------------
DROP POLICY IF EXISTS "Superadmin full access to organizations" ON public.organizations;
DROP POLICY IF EXISTS "Allow users to view their own organization" ON public.organizations;
CREATE POLICY "organizations_select" ON public.organizations FOR SELECT TO authenticated
  USING (is_superadmin() OR id = (SELECT organization_id FROM public.profiles WHERE id = (SELECT auth.uid())));
CREATE POLICY "organizations_insert" ON public.organizations FOR INSERT TO authenticated WITH CHECK (is_superadmin());
CREATE POLICY "organizations_update" ON public.organizations FOR UPDATE TO authenticated USING (is_superadmin()) WITH CHECK (is_superadmin());
CREATE POLICY "organizations_delete" ON public.organizations FOR DELETE TO authenticated USING (is_superadmin());

-- PROFILES -------------------------------------------------------------------
DROP POLICY IF EXISTS "Superadmin full access to profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins delete lower members" ON public.profiles;
DROP POLICY IF EXISTS "Allow users to view their organization members" ON public.profiles;
DROP POLICY IF EXISTS "Admins update lower members" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "profiles_select" ON public.profiles FOR SELECT TO authenticated
  USING (is_superadmin() OR organization_id = get_my_org_id());
CREATE POLICY "profiles_insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (is_superadmin());
CREATE POLICY "profiles_update" ON public.profiles FOR UPDATE TO authenticated
  USING (
    is_superadmin()
    OR (SELECT auth.uid()) = id
    OR (my_role_rank() >= 30 AND organization_id = get_my_org_id() AND role_rank(role) < my_role_rank())
  )
  WITH CHECK (
    is_superadmin()
    OR (SELECT auth.uid()) = id
    OR (organization_id = get_my_org_id() AND role_rank(role) < my_role_rank())
  );
CREATE POLICY "profiles_delete" ON public.profiles FOR DELETE TO authenticated
  USING (
    is_superadmin()
    OR (my_role_rank() >= 30 AND organization_id = get_my_org_id() AND role_rank(role) < my_role_rank() AND id <> (SELECT auth.uid()))
  );

-- NAME_CHANGE_REQUESTS -------------------------------------------------------
DROP POLICY IF EXISTS "Superadmin full access to name change requests" ON public.name_change_requests;
DROP POLICY IF EXISTS "Admins view org name change requests" ON public.name_change_requests;
DROP POLICY IF EXISTS "View own name change requests" ON public.name_change_requests;
CREATE POLICY "ncr_select" ON public.name_change_requests FOR SELECT TO authenticated
  USING (
    is_superadmin()
    OR user_id = (SELECT auth.uid())
    OR (my_role_rank() >= 30 AND organization_id = get_my_org_id())
  );
CREATE POLICY "ncr_insert" ON public.name_change_requests FOR INSERT TO authenticated WITH CHECK (is_superadmin());
CREATE POLICY "ncr_update" ON public.name_change_requests FOR UPDATE TO authenticated USING (is_superadmin()) WITH CHECK (is_superadmin());
CREATE POLICY "ncr_delete" ON public.name_change_requests FOR DELETE TO authenticated USING (is_superadmin());

-- SHIFT_AUDIT_LOG ------------------------------------------------------------
DROP POLICY IF EXISTS "Superadmin full access to shift audit log" ON public.shift_audit_log;
DROP POLICY IF EXISTS "Admins view org shift audit log" ON public.shift_audit_log;
DROP POLICY IF EXISTS "Users read their own audit entries" ON public.shift_audit_log;
CREATE POLICY "sal_select" ON public.shift_audit_log FOR SELECT TO authenticated
  USING (
    is_superadmin()
    OR target_user_id = (SELECT auth.uid())
    OR (my_role_rank() >= 30 AND organization_id = get_my_org_id())
  );
CREATE POLICY "sal_insert" ON public.shift_audit_log FOR INSERT TO authenticated WITH CHECK (is_superadmin());
CREATE POLICY "sal_update" ON public.shift_audit_log FOR UPDATE TO authenticated USING (is_superadmin()) WITH CHECK (is_superadmin());
CREATE POLICY "sal_delete" ON public.shift_audit_log FOR DELETE TO authenticated USING (is_superadmin());

-- SHIFTS ---------------------------------------------------------------------
DROP POLICY IF EXISTS "Superadmin full access to shifts" ON public.shifts;
DROP POLICY IF EXISTS "Shifts are insertable by own user" ON public.shifts;
DROP POLICY IF EXISTS "Shifts are viewable by organization" ON public.shifts;
DROP POLICY IF EXISTS "Shifts are updatable by own user" ON public.shifts;
CREATE POLICY "shifts_select" ON public.shifts FOR SELECT TO authenticated
  USING (is_superadmin() OR organization_id = get_my_org_id());
CREATE POLICY "shifts_insert" ON public.shifts FOR INSERT TO authenticated
  WITH CHECK (is_superadmin() OR ((SELECT auth.uid()) = user_id AND organization_id = get_my_org_id()));
CREATE POLICY "shifts_update" ON public.shifts FOR UPDATE TO authenticated
  USING (is_superadmin() OR ((SELECT auth.uid()) = user_id AND organization_id = get_my_org_id()))
  WITH CHECK (is_superadmin() OR ((SELECT auth.uid()) = user_id AND organization_id = get_my_org_id()));
CREATE POLICY "shifts_delete" ON public.shifts FOR DELETE TO authenticated
  USING (is_superadmin());
