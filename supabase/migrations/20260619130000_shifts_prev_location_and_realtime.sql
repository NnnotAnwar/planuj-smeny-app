-- =============================================================================
-- FIX: shift location change + live locations
-- -----------------------------------------------------------------------------
-- 1. The prod `shifts` table was created from an older schema and is missing the
--    `previous_location_id` column the base dump defines. changeShiftLocation
--    writes to it, so location changes failed with PGRST204 ("Could not find
--    the 'previous_location_id' column"). Add it idempotently (+ FK).
-- 2. Only `shifts` was in the `supabase_realtime` publication, so newly added
--    locations didn't appear on other clients' dashboards in real time. Add
--    `locations` to the publication.
-- =============================================================================

-- 1. previous_location_id ----------------------------------------------------
ALTER TABLE public.shifts ADD COLUMN IF NOT EXISTS previous_location_id uuid;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'shifts_previous_location_id_fkey'
  ) THEN
    ALTER TABLE public.shifts
      ADD CONSTRAINT shifts_previous_location_id_fkey
      FOREIGN KEY (previous_location_id) REFERENCES public.locations(id);
  END IF;
END $$;

-- 2. Realtime for locations --------------------------------------------------
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'locations'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.locations;
  END IF;
END $$;

-- Refresh PostgREST's schema cache so the new column is immediately usable.
NOTIFY pgrst, 'reload schema';
