-- =============================================================================
-- ALL-DAY PLANNED SHIFTS  (#92)
-- -----------------------------------------------------------------------------
-- The rota often just marks "this person works at this location that day"
-- without exact times. `all_day = true` flags such assignments; starts_at /
-- ends_at still hold the local day bounds so range queries and ordering keep
-- working unchanged.
-- =============================================================================

ALTER TABLE public.scheduled_shifts
  ADD COLUMN IF NOT EXISTS all_day boolean NOT NULL DEFAULT false;
