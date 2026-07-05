-- =============================================================================
-- LOCATION ROSTER  (#92)
-- -----------------------------------------------------------------------------
-- Which members belong to a location's rota. The roster-grid view lists only
-- these people (plus anyone already scheduled there), so managers edit just
-- the staff that matter for that location. Managers (rank >= 20) curate the
-- roster within their organization.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.location_roster (
  location_id     uuid NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  added_by        uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (location_id, user_id)
);

CREATE INDEX IF NOT EXISTS location_roster_org_idx ON public.location_roster (organization_id);

ALTER TABLE public.location_roster ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "roster_select" ON public.location_roster;
CREATE POLICY "roster_select" ON public.location_roster FOR SELECT TO authenticated
  USING (is_superadmin() OR organization_id = get_my_org_id());

DROP POLICY IF EXISTS "roster_insert" ON public.location_roster;
CREATE POLICY "roster_insert" ON public.location_roster FOR INSERT TO authenticated
  WITH CHECK (is_superadmin() OR (my_role_rank() >= 20 AND organization_id = get_my_org_id()));

DROP POLICY IF EXISTS "roster_delete" ON public.location_roster;
CREATE POLICY "roster_delete" ON public.location_roster FOR DELETE TO authenticated
  USING (is_superadmin() OR (my_role_rank() >= 20 AND organization_id = get_my_org_id()));
