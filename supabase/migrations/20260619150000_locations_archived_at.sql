-- =============================================================================
-- SOFT-DELETE (ARCHIVE) FOR LOCATIONS
-- -----------------------------------------------------------------------------
-- Hard-deleting a location CASCADE-removes every shift there (shifts.location_id
-- ON DELETE CASCADE) — wiping active shifts and payroll/Overview history. Instead
-- the admin "delete" now archives: set archived_at. Archived locations are hidden
-- from pickers + the admin list but keep all history (names still resolve in
-- Overview). The realtime UPDATE on this column propagates the change live.
-- =============================================================================

ALTER TABLE public.locations ADD COLUMN IF NOT EXISTS archived_at timestamptz;
