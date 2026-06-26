-- DB hygiene from Supabase advisors (behaviour-preserving):
--   #2 revoke a trigger function that is wrongly exposed as an RPC,
--   #5 add covering indexes for unindexed foreign keys,
--   #4 wrap auth.uid()/stable helpers in scalar sub-selects so RLS policies
--      evaluate them once per statement instead of once per row.

-- ---------------------------------------------------------------------------
-- #2: log_username_change() is a trigger function and must not be callable via
-- /rest/v1/rpc. Revoke EXECUTE from the API roles — the trigger still fires
-- internally regardless of these grants.
-- ---------------------------------------------------------------------------
revoke execute on function public.log_username_change() from anon, authenticated, public;

-- ---------------------------------------------------------------------------
-- #5: covering indexes for foreign keys (unindexed_foreign_keys).
-- ---------------------------------------------------------------------------
create index if not exists idx_locations_organization_id
  on public.locations (organization_id);
create index if not exists idx_name_change_requests_reviewed_by
  on public.name_change_requests (reviewed_by);
create index if not exists idx_profiles_role
  on public.profiles (role);
create index if not exists idx_shift_audit_log_actor_id
  on public.shift_audit_log (actor_id);
create index if not exists idx_shift_audit_log_target_user_id
  on public.shift_audit_log (target_user_id);
create index if not exists idx_shifts_location_id
  on public.shifts (location_id);
create index if not exists idx_shifts_previous_location_id
  on public.shifts (previous_location_id);

-- ---------------------------------------------------------------------------
-- #4: RLS init-plan optimisation (auth_rls_initplan). Policies are dropped and
-- recreated with identical logic/roles; only the function calls are wrapped in
-- (select ...) so the planner evaluates them once per statement.
-- ---------------------------------------------------------------------------

-- organizations: view own organization
drop policy if exists "Allow users to view their own organization" on public.organizations;
create policy "Allow users to view their own organization" on public.organizations
  for select to authenticated
  using (id = (select organization_id from public.profiles where id = (select auth.uid())));

-- shift_audit_log: read own entries (role public, matching production)
drop policy if exists "Users read their own audit entries" on public.shift_audit_log;
create policy "Users read their own audit entries" on public.shift_audit_log
  for select to public
  using (target_user_id = (select auth.uid()));

-- profiles: update own profile
drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile" on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- profiles: admins delete strictly-lower members in their org
drop policy if exists "Admins delete lower members" on public.profiles;
create policy "Admins delete lower members" on public.profiles
  for delete to authenticated
  using (
    (select public.my_role_rank()) >= 30
    and organization_id = (select public.get_my_org_id())
    and public.role_rank(role) < (select public.my_role_rank())
    and id <> (select auth.uid())
  );

-- name_change_requests: view own requests
drop policy if exists "View own name change requests" on public.name_change_requests;
create policy "View own name change requests" on public.name_change_requests
  for select to authenticated
  using (user_id = (select auth.uid()));

-- shifts: insert own
drop policy if exists "Shifts are insertable by own user" on public.shifts;
create policy "Shifts are insertable by own user" on public.shifts
  for insert to authenticated
  with check ((select auth.uid()) = user_id and organization_id = (select public.get_my_org_id()));

-- shifts: update own
drop policy if exists "Shifts are updatable by own user" on public.shifts;
create policy "Shifts are updatable by own user" on public.shifts
  for update to authenticated
  using ((select auth.uid()) = user_id and organization_id = (select public.get_my_org_id()));
