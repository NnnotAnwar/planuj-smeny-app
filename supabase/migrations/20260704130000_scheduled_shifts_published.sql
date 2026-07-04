-- =============================================================================
-- ROTA DRAFT → PUBLISH  (#92)
-- -----------------------------------------------------------------------------
-- Managers plan in peace: new assignments are DRAFTS (published = false) that
-- members can't see. "Publish month" flips them visible. Existing rows are
-- marked published so nothing disappears for members on migration.
-- =============================================================================

ALTER TABLE public.scheduled_shifts
  ADD COLUMN IF NOT EXISTS published boolean NOT NULL DEFAULT false;

UPDATE public.scheduled_shifts SET published = true WHERE published = false;

-- Members only see their PUBLISHED assignments; planners see everything in org.
DROP POLICY IF EXISTS "scheduled_select" ON public.scheduled_shifts;
CREATE POLICY "scheduled_select" ON public.scheduled_shifts FOR SELECT TO authenticated
  USING (
    is_superadmin()
    OR (my_role_rank() >= 20 AND organization_id = get_my_org_id())
    OR (user_id = (SELECT auth.uid()) AND published)
  );
