-- =============================================================================
-- LOCK DOWN get_email_by_username  (S1 — close the username/email enumeration)
-- -----------------------------------------------------------------------------
-- This RPC returned an email for any username and was granted to `anon`, letting
-- anyone enumerate usernames and harvest emails (PII). Username login now goes
-- through the `username-login` Edge Function (service_role lookup + sign-in,
-- generic errors), so no client needs this RPC. Revoke all caller access.
--
-- Apply ONLY after the Edge-Function login is confirmed working, so username
-- sign-in never has a window where neither path works.
-- =============================================================================

REVOKE EXECUTE ON FUNCTION public.get_email_by_username(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_email_by_username(text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.get_email_by_username(text) FROM public;
