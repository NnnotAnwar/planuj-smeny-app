-- =============================================================================
-- LOCK DOWN NEW SCHEDULE/TIME-OFF TRIGGER FUNCTIONS FROM THE REST API
-- -----------------------------------------------------------------------------
-- The statement-level logging triggers and the time-off notifier are SECURITY
-- DEFINER functions in the `public` schema, so PostgREST exposes them at
-- /rest/v1/rpc/<name> to anon + authenticated (Supabase security advisor 0028/
-- 0029). They're trigger-only — calling them directly does nothing useful — so
-- revoke EXECUTE, matching the convention in 20260702120000. `publish_schedule`
-- IS meant to be called by managers from the client, so it keeps EXECUTE for
-- authenticated (it self-guards with my_role_rank() < 20) but is closed to anon.
-- =============================================================================

REVOKE EXECUTE ON FUNCTION public.log_schedule_created()      FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_schedule_updated()      FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_schedule_removed()      FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_time_off()           FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.clear_shifts_for_time_off() FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.publish_schedule(timestamptz, timestamptz) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.publish_schedule(timestamptz, timestamptz) TO authenticated;
