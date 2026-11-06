-- =============================================================================
-- MEMBER WAGES (hourly rate per member)  — v1.10 (payroll groundwork)
-- -----------------------------------------------------------------------------
-- Sensitive data: a member may read ONLY their own rate; managers (rank >= 20)
-- read/manage rates across their org. Unlocks pay-estimate / labour-cost views.
-- One current rate per member (user_id unique); history can come later.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.member_wages (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  hourly_rate     numeric(10,2) NOT NULL CHECK (hourly_rate >= 0),
  currency        text NOT NULL DEFAULT 'CZK',
  effective_from  date NOT NULL DEFAULT current_date,
  created_by      uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS member_wages_org_idx ON public.member_wages (organization_id);

ALTER TABLE public.member_wages ENABLE ROW LEVEL SECURITY;

-- Read: your OWN rate, or a manager reading their org. (Members never see peers'.)
DROP POLICY IF EXISTS "member_wages_select" ON public.member_wages;
CREATE POLICY "member_wages_select" ON public.member_wages FOR SELECT TO authenticated
  USING (
    is_superadmin()
    OR user_id = (SELECT auth.uid())
    OR (my_role_rank() >= 20 AND organization_id = get_my_org_id())
  );

-- Only managers set/change rates (members cannot edit their own pay).
DROP POLICY IF EXISTS "member_wages_write" ON public.member_wages;
CREATE POLICY "member_wages_write" ON public.member_wages FOR ALL TO authenticated
  USING (is_superadmin() OR (my_role_rank() >= 20 AND organization_id = get_my_org_id()))
  WITH CHECK (is_superadmin() OR (my_role_rank() >= 20 AND organization_id = get_my_org_id()));

NOTIFY pgrst, 'reload schema';
