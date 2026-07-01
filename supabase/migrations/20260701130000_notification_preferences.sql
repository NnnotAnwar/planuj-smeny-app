-- Per-user push notification preferences. The send-push Edge Function checks
-- these before delivering (a missing row means "all on"). Only gates push —
-- the in-app feed always shows every audit entry.
--   push_enabled — master switch
--   shifts       — shift added / changed / removed on my schedule
--   account      — name-change decisions + admin edits to my profile
--   requests     — new name-change requests to review (admins/reviewers)

create table if not exists public.notification_preferences (
    user_id      uuid primary key references auth.users(id) on delete cascade,
    push_enabled boolean not null default true,
    shifts       boolean not null default true,
    account      boolean not null default true,
    requests     boolean not null default true,
    updated_at   timestamptz not null default now()
);

alter table public.notification_preferences enable row level security;

drop policy if exists "Users manage own notification prefs" on public.notification_preferences;
create policy "Users manage own notification prefs" on public.notification_preferences
    for all to authenticated
    using (user_id = (select auth.uid()))
    with check (user_id = (select auth.uid()));
