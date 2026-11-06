-- =============================================================================
-- AVAILABILITY & PREFERENCES  — v1.10
-- -----------------------------------------------------------------------------
-- Members mark when they CAN'T work ('unavailable') or would PREFER not to
-- ('preferred'). An entry is either recurring (a weekday, day_of_week 0=Sun..6)
-- or a one-off (specific_date) — exactly one of the two. Optionally time-bounded
-- (all_day = false + start/end). Members manage their own; managers (rank >= 20)
-- read them to plan the rota. This is advisory input for planning, not a hard
-- lock like approved time_off.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.availability (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  kind            text NOT NULL DEFAULT 'unavailable' CHECK (kind IN ('unavailable', 'preferred')),
  day_of_week     smallint CHECK (day_of_week BETWEEN 0 AND 6),
  specific_date   date,
  all_day         boolean NOT NULL DEFAULT true,
  start_time      time,
  end_time        time,
  note            text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  -- Exactly one of recurring (day_of_week) / one-off (specific_date).
  CONSTRAINT availability_one_target CHECK (
    (day_of_week IS NOT NULL AND specific_date IS NULL)
    OR (day_of_week IS NULL AND specific_date IS NOT NULL)
  ),
  -- If time-bounded, both ends are required and ordered.
  CONSTRAINT availability_time_bounds CHECK (
    all_day = true
    OR (start_time IS NOT NULL AND end_time IS NOT NULL AND end_time > start_time)
  )
);

CREATE INDEX IF NOT EXISTS availability_user_idx ON public.availability (user_id);
CREATE INDEX IF NOT EXISTS availability_org_idx  ON public.availability (organization_id);
CREATE INDEX IF NOT EXISTS availability_date_idx ON public.availability (specific_date);

ALTER TABLE public.availability ENABLE ROW LEVEL SECURITY;

-- Read: the member, or a manager (rank >= 20) in the same org (to plan).
DROP POLICY IF EXISTS "availability_select" ON public.availability;
CREATE POLICY "availability_select" ON public.availability FOR SELECT TO authenticated
  USING (
    is_superadmin()
    OR user_id = (SELECT auth.uid())
    OR (my_role_rank() >= 20 AND organization_id = get_my_org_id())
  );

-- Members manage their OWN entries.
DROP POLICY IF EXISTS "availability_insert" ON public.availability;
CREATE POLICY "availability_insert" ON public.availability FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()) AND organization_id = get_my_org_id());

DROP POLICY IF EXISTS "availability_update" ON public.availability;
CREATE POLICY "availability_update" ON public.availability FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "availability_delete" ON public.availability;
CREATE POLICY "availability_delete" ON public.availability FOR DELETE TO authenticated
  USING (user_id = (SELECT auth.uid()));

ALTER TABLE public.availability REPLICA IDENTITY FULL;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'availability'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.availability;
  END IF;
END$$;

NOTIFY pgrst, 'reload schema';
