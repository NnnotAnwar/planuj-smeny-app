-- =============================================================================
-- TIME OFF: ONE ENTRY PER PERSON PER PERIOD  (#92)
-- -----------------------------------------------------------------------------
-- A member can't request (and a manager can't enter) leave that overlaps an
-- existing pending or approved entry for the same person. Declined entries
-- don't block — the person may ask again for those days.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE public.time_off DROP CONSTRAINT IF EXISTS time_off_no_overlap;
ALTER TABLE public.time_off ADD CONSTRAINT time_off_no_overlap
  EXCLUDE USING gist (
    user_id WITH =,
    daterange(starts_on, ends_on, '[]') WITH &&
  )
  WHERE (status <> 'declined');
