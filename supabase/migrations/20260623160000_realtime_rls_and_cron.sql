-- =============================================================================
-- REALTIME-FRIENDLY RLS + ONCE-A-DAY CRON
-- -----------------------------------------------------------------------------
-- 1) Realtime (postgres_changes) authorizes each subscriber against the table's
--    RLS. The org-scoped policies on shifts/locations used an inline subquery to
--    `profiles`; Realtime's per-row RLS check does not evaluate such cross-table
--    subqueries reliably and was silently dropping events (live updates stopped
--    after the permissive policies were removed). Swap the subquery for the
--    existing SECURITY DEFINER helper get_my_org_id() — logically identical, but
--    a stable function call Realtime can evaluate. (profiles' own policy already
--    uses this helper.)
--
-- 2) auto_end_open_shifts was scheduled every 30 minutes; it only needs to run
--    once a day around midnight (it stamps ended_at to the computed Prague
--    midnight regardless of when it runs). Reschedule to 23:00 UTC, which is at
--    or just after midnight in Europe/Prague year-round (CET 00:00 / CEST 01:00).
-- =============================================================================

-- 1. Realtime-friendly policies -------------------------------------------------
DROP POLICY IF EXISTS "Allow users to view their organization locations" ON public.locations;
CREATE POLICY "Allow users to view their organization locations" ON public.locations
  FOR SELECT TO authenticated
  USING (organization_id = public.get_my_org_id());

DROP POLICY IF EXISTS "Shifts are viewable by organization" ON public.shifts;
CREATE POLICY "Shifts are viewable by organization" ON public.shifts
  FOR SELECT TO authenticated
  USING (organization_id = public.get_my_org_id());

DROP POLICY IF EXISTS "Shifts are insertable by own user" ON public.shifts;
CREATE POLICY "Shifts are insertable by own user" ON public.shifts
  FOR INSERT TO authenticated
  WITH CHECK ((auth.uid() = user_id) AND (organization_id = public.get_my_org_id()));

DROP POLICY IF EXISTS "Shifts are updatable by own user" ON public.shifts;
CREATE POLICY "Shifts are updatable by own user" ON public.shifts
  FOR UPDATE TO authenticated
  USING ((auth.uid() = user_id) AND (organization_id = public.get_my_org_id()));

-- 2. Cron: once a day instead of every 30 minutes ------------------------------
SELECT cron.alter_job(jobid, schedule => '0 23 * * *')
FROM cron.job
WHERE command LIKE '%auto_end_open_shifts%';
