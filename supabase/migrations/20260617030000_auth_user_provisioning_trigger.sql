-- =============================================================================
-- AUTH USER PROVISIONING TRIGGER
-- -----------------------------------------------------------------------------
-- The handle_new_user() function (see 20260617010000) provisions a profile for
-- every new auth user, reading the target org + role from invite metadata. It is
-- only useful if a trigger actually calls it.
--
-- On the original project this trigger was created by hand in the dashboard and
-- never captured in a migration (Supabase's `db dump` omits triggers on the
-- `auth` schema). Projects bootstrapped purely from migrations (e.g. preprod,
-- where the base dump was marked applied via `migration repair` rather than run)
-- therefore had the function but no trigger — so no profile rows were ever
-- created, and invitees hit "invitation invalid" after a successful verifyOtp.
--
-- Create it idempotently so every environment provisions profiles consistently.
-- =============================================================================

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
