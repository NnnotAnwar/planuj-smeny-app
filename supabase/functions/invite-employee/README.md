# invite-employee

Edge Function that invites a new user by email and provisions them into an
organization with a role. Runs with the `service_role` key (server-side only).

Authorization is derived from the **caller's** JWT:

| Caller        | Organization              | Role                          |
| ------------- | ------------------------- | ----------------------------- |
| Superadmin    | any (chosen in the UI)    | any (incl. Admin)             |
| Org admin     | forced to their own org   | any except `Superadmin`       |
| anyone else   | — (rejected)              | —                             |

The chosen `organization_id` + `role` are passed as invite metadata and applied
by the `handle_new_user` trigger (see migration `*_invite_aware_provisioning.sql`).

## Deploy

```bash
# 1. Apply the migrations (trigger + RLS for org admins)
supabase db push

# 2. Deploy the function
supabase functions deploy invite-employee
```

## Requirements

- **SMTP** must be configured in the Supabase dashboard (Auth → Email) for invite
  emails to actually be delivered. Without it, invites are created but no email
  is sent (locally they are captured by Inbucket).
- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` are injected
  automatically by the platform. Optionally set `SITE_URL` (the invite redirect
  target) via `supabase secrets set SITE_URL=https://your-app`.
