-- Push-notification device tokens. Each row is one device's FCM/APNs token for a
-- user; the send-push Edge Function (service role) looks these up by user_id.

create table if not exists public.device_tokens (
    id          uuid primary key default gen_random_uuid(),
    user_id     uuid not null references auth.users(id) on delete cascade,
    token       text not null unique,
    platform    text not null check (platform in ('android', 'ios', 'web')),
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now()
);

create index if not exists idx_device_tokens_user on public.device_tokens (user_id);

alter table public.device_tokens enable row level security;

-- A user may only see / register / remove their own device tokens. The push
-- sender runs with the service role, which bypasses RLS.
drop policy if exists "Users manage own device tokens" on public.device_tokens;
create policy "Users manage own device tokens" on public.device_tokens
    for all to authenticated
    using (user_id = (select auth.uid()))
    with check (user_id = (select auth.uid()));
