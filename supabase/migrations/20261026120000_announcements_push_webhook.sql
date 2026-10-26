-- =============================================================================
-- PUSH ON NEW ANNOUNCEMENT  — v1.10
-- -----------------------------------------------------------------------------
-- Database Webhook: on INSERT into announcements, call the send-push edge
-- function, which notifies every member of the org (except the author).
-- Mirrors notify_shift_updates (supabase_functions.http_request AFTER INSERT).
-- NOTE: the Authorization bearer below is the project's service_role webhook
-- token; it differs per project, so this exact DDL is preprod's. On prod, create
-- the equivalent webhook via the dashboard or with prod's own service_role token.
-- =============================================================================

DROP TRIGGER IF EXISTS notify_new_announcement ON public.announcements;
CREATE TRIGGER notify_new_announcement
  AFTER INSERT ON public.announcements
  FOR EACH ROW
  EXECUTE FUNCTION supabase_functions.http_request(
    'https://fusnqxykhdzcvhqbsevb.supabase.co/functions/v1/send-push',
    'POST',
    '{"Content-type":"application/json","Authorization":"Bearer <service_role_webhook_token>"}',
    '{}',
    '5000'
  );
