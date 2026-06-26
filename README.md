# Planuj Směny

A modern, cross-platform **shift-management** app for teams. Employees clock in
and out by location in real time; managers and admins oversee organizations,
locations, people and requests — on the web or as a native Android/iOS app.

> **Status: active development (beta).** Features and UI change frequently.
> _Last updated: June 26, 2026._

---

## ✨ Features

### Shift tracking
- **Clock in / out by location**, with mid-shift location switching and a
  confirm/switch popup.
- **Live board** — see who's on shift right now, updating instantly via Supabase
  Realtime (no refresh).
- **Auto-end at midnight** — shifts left open overnight are closed automatically
  at Europe/Prague midnight by a scheduled job (`ended_at` is stamped to the
  exact midnight regardless of when the job runs).

### Analytics (Overview)
- Monthly analytics: total/avg hours, shift count, busiest days, share-of-time
  per location.
- **Mandatory-break math** baked in (−30 min from 6 h, −1 h from 12 h).
- **PDF export** of the monthly report (jsPDF).

### Admin & roles
- **Admin Panel** for Organizations (Superadmin), Locations (owners), and
  Employees (admins): create / edit / delete, with search.
- **Ranked role hierarchy** enforced in the database (RLS), not just the UI.
- **Invite by email** — new members are provisioned into the right organization
  and role atomically, and finish onboarding on a branded `/accept-invite` page
  (set username + password).

### Requests
- Dedicated **Requests** hub (sidebar on desktop, "More" menu on mobile).
- **Name-change requests**: staff can't rename themselves — they file a request
  an admin approves; approval applies the new name automatically.
- **Username** is self-service but rate-limited to **once every 7 days**.

### Multi-tenant & realtime
- Strict **organization isolation** via Row Level Security: users only see their
  own org's data; **Superadmin** sees everything (incl. live updates across all
  organizations).

### Mobile & theming
- **Mobile-first**: native-style bottom tab bar + a Google-style "More" sheet
  (profile, settings, requests, logout) that floats above the app.
- **Light / Dark / System** themes with native status-bar sync.
- **Capacitor** native wrapper: safe-area handling, haptics, app-lifecycle
  listeners, keyboard/splash/status-bar plugins.
- **PWA-ready**: installable directly from browsers via web app manifest (Add to Home Screen on mobile/desktop).

---

## 🛠 Tech stack

| Layer | Tech |
| --- | --- |
| Frontend | React 19 + TypeScript, Vite 7 |
| Routing / state | React Router 7, TanStack Query 5 |
| Styling / motion | Tailwind CSS v4, Framer Motion, Phosphor icons |
| Validation | Zod |
| Reports | jsPDF + jspdf-autotable |
| Backend | Supabase — Postgres, Auth, Realtime, Edge Functions, pg_cron |
| Native | Capacitor 8 (Android & iOS) |
| Tooling | ESLint 9, Prettier, Vitest, Yarn 4 (Corepack) |

---

## 🧱 Architecture

```
src/
├─ app/            # shell, layout (AppShell, BottomNav), providers, router guards
├─ features/
│  ├─ auth/        # login, accept-invite, AuthContext, route guards
│  ├─ shifts/      # clock in/out, realtime, Overview + PDF export
│  ├─ locations/   # location picker + confirm/switch popup
│  ├─ admin/       # Admin Panel: orgs / locations / employees / roles
│  ├─ requests/    # Requests hub (name-change approvals)
│  └─ settings/    # profile (username/name), appearance
└─ shared/         # api client, types (zod), UI components, utils
supabase/
├─ migrations/     # SQL schema, RLS policies, triggers, cron
└─ functions/      # Edge Functions (Deno)
```

### Roles & permissions

| Role | Rank | Can |
| --- | --- | --- |
| Superadmin | 100 | Everything, across all organizations |
| Head Admin | 40 | Manage own org incl. locations ("owner") |
| Admin | 30 | Invite & manage members below them |
| Manager | 20 | View the admin panel (read-only) |
| Supervisor | 10 | Shift control |
| Employee | 0 | Own shifts only |

Capability rules (assigning roles below your own, no self-escalation, org
scoping) are enforced by **RLS policies + triggers** in the database, so they
hold even for direct API calls — the UI just mirrors them.

### Edge Functions (`supabase/functions/`)
- **`invite-employee`** — invites a user and provisions org + role from the
  caller's privileges (service-role, server-side).
- **`delete-employee`** — removes a member with rank/org checks.
- **`username-login`** — resolves a username to an email for sign-in.

---

## 📦 Getting started

This project uses **Yarn (Berry v4, via Corepack)** — single lockfile
(`yarn.lock`); the version is pinned in `package.json` (`packageManager`).
Don't add `package-lock.json`.

```bash
corepack enable          # once (ships with Node 18+)
yarn install
cp .env.example .env      # then fill in the values below
yarn dev                 # Vite dev server, exposed on your LAN (--host)
```

### Environment variables
| Variable | Description |
| --- | --- |
| `VITE_SUPABASE_URL` | Supabase project URL, e.g. `https://<ref>.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable (anon) key. **Never** ship the `service_role` key to the client. |

On Vercel, set these under **Project → Settings → Environment Variables** per
environment (Production / Preview / Development).

### Local Supabase
```bash
supabase start            # boot local stack (Docker)
supabase db reset         # apply migrations + seed (supabase/seed.sql)
supabase functions serve  # run Edge Functions locally
```
Remote schema changes go through `supabase/migrations/` (`supabase db push`).

### Build for native
```bash
yarn build
npx cap sync
npx cap open android   # or: npx cap open ios
```

---

## 🧰 Scripts
| Script | What it does |
| --- | --- |
| `yarn dev` | Vite dev server (LAN-exposed) |
| `yarn build` | Type-check + production build (`tsc -b && vite build`) |
| `yarn typecheck` | Type-check only |
| `yarn lint` | ESLint |
| `yarn format` | Prettier write |
| `yarn test` / `test:watch` | Vitest (run / watch) |

---

## 🚢 Deployment

- **Hosting:** Vercel. `master` → **production**; `dev` / `preview` → preview
  deployments. SPA rewrites are configured in `vercel.json`.
- **Database:** two Supabase projects — **prod** and **preprod** — kept in sync
  via the migrations in `supabase/migrations/`. CI (`verify`) runs lint, tests
  and the build on every PR.

---

## 🔒 Security

- **Row Level Security** on every table; organization isolation + the role
  hierarchy are the source of truth (UI only mirrors them).
- Keep the `service_role` key server-side only (Edge Functions / secrets).
- Don't ship default demo credentials (e.g. `admin / admin`) to any shared
  environment — rotate the seeded admin's password and pick a non-obvious
  username first.
- Recommended: enable **Leaked Password Protection** in Supabase Auth settings.

---

_Created by Anuar Kairulla._
