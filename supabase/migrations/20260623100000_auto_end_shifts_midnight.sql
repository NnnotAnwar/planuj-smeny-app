-- =============================================================================
-- AUTO-END FORGOTTEN SHIFTS AT PRAGUE MIDNIGHT
-- -----------------------------------------------------------------------------
-- If an employee forgets to end their shift, cap it at 00:00 Europe/Prague.
-- A pg_cron job runs every 30 min and closes any still-open shift that started
-- before the most recent Prague midnight, stamping ended_at = that midnight
-- (so the recorded end is exactly 00:00 local, regardless of when cron fires;
-- the Prague-midnight calc is DST-safe). The shifts realtime publication makes
-- the change show up on dashboards live.
--
-- Note: genuine overnight shifts are also capped at midnight — the system can't
-- tell "forgot to clock out" from "still working past midnight".
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pg_cron;

CREATE OR REPLACE FUNCTION public.auto_end_open_shifts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_midnight timestamptz := date_trunc('day', now() AT TIME ZONE 'Europe/Prague') AT TIME ZONE 'Europe/Prague';
BEGIN
  UPDATE public.shifts
     SET ended_at = v_midnight
   WHERE ended_at IS NULL
     AND started_at < v_midnight;
END;
$fn$;

-- (Re)schedule idempotently.
DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'auto-end-open-shifts') THEN
    PERFORM cron.unschedule('auto-end-open-shifts');
  END IF;
END
$do$;

SELECT cron.schedule('auto-end-open-shifts', '*/30 * * * *', 'SELECT public.auto_end_open_shifts();');
