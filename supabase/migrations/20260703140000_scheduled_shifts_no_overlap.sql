-- =============================================================================
-- NO DOUBLE-BOOKING IN THE ROTA  (#92)
-- -----------------------------------------------------------------------------
-- The same person could be added to a day twice. Enforce at the database:
-- a member's planned shifts must not overlap in time. All-day assignments span
-- the whole day, so a second all-day (or any timed shift that day) is rejected,
-- while non-overlapping timed shifts (morning + evening) remain allowed.
-- Existing overlaps are deduped first (earliest row wins).
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS btree_gist;

DELETE FROM public.scheduled_shifts a
USING public.scheduled_shifts b
WHERE a.user_id = b.user_id
  AND a.id <> b.id
  AND tstzrange(a.starts_at, a.ends_at, '[)') && tstzrange(b.starts_at, b.ends_at, '[)')
  AND (a.created_at > b.created_at OR (a.created_at = b.created_at AND a.id > b.id));

ALTER TABLE public.scheduled_shifts
  ADD CONSTRAINT scheduled_shifts_no_overlap
  EXCLUDE USING gist (user_id WITH =, tstzrange(starts_at, ends_at, '[)') WITH &&);
