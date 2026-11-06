-- =============================================================================
-- DB QUICK-WINS — covering indexes for unindexed FKs + STABLE helpers  (v1.9.1)
-- -----------------------------------------------------------------------------
-- From the performance advisor: five foreign keys had no covering index, which
-- slows joins and cascade checks as volume grows. Also mark the two RLS helper
-- functions STABLE so the planner can cache them within a statement instead of
-- re-evaluating per row (they only read, never write).
-- =============================================================================

-- Covering indexes for the flagged foreign keys.
CREATE INDEX IF NOT EXISTS location_roster_added_by_idx    ON public.location_roster (added_by);
CREATE INDEX IF NOT EXISTS location_roster_user_id_idx     ON public.location_roster (user_id);
CREATE INDEX IF NOT EXISTS scheduled_shifts_created_by_idx ON public.scheduled_shifts (created_by);
CREATE INDEX IF NOT EXISTS scheduled_shifts_location_idx   ON public.scheduled_shifts (location_id);
CREATE INDEX IF NOT EXISTS time_off_reviewed_by_idx        ON public.time_off (reviewed_by);

-- RLS helpers only read — STABLE lets the planner cache them per statement.
ALTER FUNCTION public.get_my_org_id() STABLE;
ALTER FUNCTION public.is_superadmin() STABLE;
