-- =============================================================================
-- COVERAGE REQUIREMENTS (minimum headcount per location per weekday)  — v1.10
-- -----------------------------------------------------------------------------
-- A manager sets "Fridays at the bar need >= 3 people"; the rota can then flag
-- understaffed days. One row per (location, weekday). Org-scoped; managers
-- manage, members read.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.coverage_requirements (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  location_id     uuid NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  day_of_week     smallint NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  min_headcount   smallint NOT NULL DEFAULT 1 CHECK (min_headcount >= 0),
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT coverage_unique_slot UNIQUE (location_id, day_of_week)
);

CREATE INDEX IF NOT EXISTS coverage_org_idx ON public.coverage_requirements (organization_id);

ALTER TABLE public.coverage_requirements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "coverage_select" ON public.coverage_requirements;
CREATE POLICY "coverage_select" ON public.coverage_requirements FOR SELECT TO authenticated
  USING (is_superadmin() OR organization_id = get_my_org_id());

DROP POLICY IF EXISTS "coverage_write" ON public.coverage_requirements;
CREATE POLICY "coverage_write" ON public.coverage_requirements FOR ALL TO authenticated
  USING (is_superadmin() OR (my_role_rank() >= 20 AND organization_id = get_my_org_id()))
  WITH CHECK (is_superadmin() OR (my_role_rank() >= 20 AND organization_id = get_my_org_id()));

NOTIFY pgrst, 'reload schema';
