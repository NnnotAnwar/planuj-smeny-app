-- =============================================================================
-- LOCK DOWN TRIGGER-ONLY FUNCTION FROM THE REST API
-- -----------------------------------------------------------------------------
-- `audit_profile_admin_change()` is a trigger function (fires AFTER UPDATE on
-- profiles). It was never meant to be callable directly, but as a SECURITY
-- DEFINER function in the `public` schema it is exposed via PostgREST at
-- /rest/v1/rpc/audit_profile_admin_change to both anon and authenticated roles
-- (flagged by the Supabase security advisor). Calling it directly does nothing
-- useful, but revoke EXECUTE so it isn't part of the public API surface.
-- =============================================================================

REVOKE EXECUTE ON FUNCTION public.audit_profile_admin_change() FROM PUBLIC, anon, authenticated;
