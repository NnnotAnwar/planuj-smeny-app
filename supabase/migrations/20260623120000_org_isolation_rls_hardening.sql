-- =============================================================================
-- ORGANIZATION-ISOLATION RLS HARDENING
-- -----------------------------------------------------------------------------
-- Production had drifted from preprod: several early permissive policies with
-- `USING (true)` were still present and, because RLS policies combine with OR,
-- they DEFEATED the org-scoped policies. The effect:
--   * any authenticated user could read EVERY profile / shift / location and
--     the full list of organizations, across all tenants;
--   * locations were even readable by the anonymous (`public`) role.
--
-- This migration makes the policy set canonical and org-isolated on every
-- environment, and tightens EXECUTE on internal functions so they are not
-- reachable as `/rest/v1/rpc/*` by anon (and, for trigger/cron-only helpers,
-- by authenticated either). It is idempotent: it drops every known policy
-- variant (legacy + canonical) before recreating the canonical set.
--
-- Canonical read rule everywhere: a signed-in user only sees rows belonging to
-- their own organization; Superadmin keeps full access via its own policies;
-- anonymous users see nothing.
-- =============================================================================

-- 1. ORGANIZATIONS -----------------------------------------------------------
DROP POLICY IF EXISTS "Organizations are viewable by auth users"   ON public.organizations;
DROP POLICY IF EXISTS "Allow users to view their own organization" ON public.organizations;

CREATE POLICY "Allow users to view their own organization"
ON public.organizations FOR SELECT TO authenticated
USING (id = (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid()));

-- 2. LOCATIONS ---------------------------------------------------------------
DROP POLICY IF EXISTS "Enable read access for ALL users on locations"           ON public.locations;
DROP POLICY IF EXISTS "Enable read access for authenticated users on locations" ON public.locations;
DROP POLICY IF EXISTS "View org locations only"                                 ON public.locations;
DROP POLICY IF EXISTS "Allow users to view their organization locations"        ON public.locations;

CREATE POLICY "Allow users to view their organization locations"
ON public.locations FOR SELECT TO authenticated
USING (organization_id = (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid()));

-- 3. PROFILES ----------------------------------------------------------------
DROP POLICY IF EXISTS "Enable read access for authenticated users on profiles" ON public.profiles;
DROP POLICY IF EXISTS "View org members only"                                  ON public.profiles;
DROP POLICY IF EXISTS "Allow users to view their organization members"         ON public.profiles;

CREATE POLICY "Allow users to view their organization members"
ON public.profiles FOR SELECT TO authenticated
USING (organization_id = public.get_my_org_id());

-- 4. SHIFTS ------------------------------------------------------------------
-- Read: own organization only.
DROP POLICY IF EXISTS "Enable read access for authenticated users on shifts" ON public.shifts;
DROP POLICY IF EXISTS "Shifts are viewable by organization"                  ON public.shifts;

CREATE POLICY "Shifts are viewable by organization"
ON public.shifts FOR SELECT TO authenticated
USING (organization_id = (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid()));

-- Insert/Update: only your own shift, and only within your own organization.
DROP POLICY IF EXISTS "Users can insert their own shifts" ON public.shifts;
DROP POLICY IF EXISTS "Shifts are insertable by own user" ON public.shifts;

CREATE POLICY "Shifts are insertable by own user"
ON public.shifts FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND organization_id = (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid())
);

DROP POLICY IF EXISTS "Users can update their own shifts" ON public.shifts;
DROP POLICY IF EXISTS "Shifts are updatable by own user"  ON public.shifts;

CREATE POLICY "Shifts are updatable by own user"
ON public.shifts FOR UPDATE TO authenticated
USING (
  auth.uid() = user_id
  AND organization_id = (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid())
);

-- 5. FUNCTION EXECUTE HARDENING ----------------------------------------------
-- Trigger-/cron-only functions: never meant to be called directly over the API.
REVOKE EXECUTE ON FUNCTION public.handle_new_user()           FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_profile_privilege() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.auto_end_open_shifts()      FROM PUBLIC, anon, authenticated;

-- RLS helper functions: used inside policies, so `authenticated` must keep
-- EXECUTE, but anon never needs them (no policy targets the anon role).
REVOKE EXECUTE ON FUNCTION public.get_my_org_id()   FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_superadmin()   FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.my_role_rank()    FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.role_rank(text)   FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.get_my_org_id()  TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_superadmin()  TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_role_rank()   TO authenticated;
GRANT EXECUTE ON FUNCTION public.role_rank(text)  TO authenticated;
