# Planuj Směny App

A modern, cross-platform shift management application built for employees and managers. This app provides real-time updates on active shifts, colleague presence, and location-based check-ins.

> **⚠️ Project Status: Under Active Development**  
> This application is currently in its prototype/beta phase. Features and UI are subject to frequent updates.  
> *Last updated: March 5, 2026*

## 🚀 Key Features

- **Real-time Sync**: Instant updates when colleagues start or end their shifts via Supabase Realtime.
- **Cross-Platform**: Works as a high-performance web app and as native Android/iOS applications (via Capacitor).
- **Dark Mode Support**: Seamlessly switch between Light, Dark, and System themes with native Status Bar integration.
- **Mobile-First Design**: Full-screen animated menus, glassmorphism UI, and horizontal location selection grid.
- **Haptic Feedback**: Tactile vibrations on native devices for important actions like starting or ending a shift.
- **Location Management**: Search and filter through 20+ workplace locations with ease.

## 🛠 Tech Stack

- **Frontend**: React 19 (TypeScript), Vite
- **Styling**: Tailwind CSS v4 (Glassmorphism, Background Gradients)
- **Animations**: Framer Motion
- **Backend/Database**: Supabase (PostgreSQL, Realtime, Auth)
- **Native Wrapper**: Capacitor (Android & iOS)

## 📱 Mobile Native Integration

The app is wrapped using **Capacitor**, providing:
- Full-screen display with Safe Area support.
- Native Status Bar theme synchronization.
- Haptic feedback (Impact Heavy) on interaction.
- App lifecycle listeners to prevent data duplication on resume.

## 📦 Getting Started

This project uses **npm** (single lockfile: `package-lock.json`). Do not add `yarn.lock`.

### Development
1. Clone the repository.
2. Install dependencies: `npm install`.
3. Copy env: `cp .env.example .env` and fill in the values (see below).
4. Start the dev server: `npm run dev` (local only) or `npm run dev:lan` (exposed on your LAN, e.g. for testing on a phone).

### Environment variables
Create a `.env` (see [`.env.example`](.env.example)):

| Variable | Description |
| --- | --- |
| `VITE_SUPABASE_URL` | Supabase project URL, e.g. `https://<ref>.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable (anon) key — public client key. **Never** put the `service_role` key in the client. |

On Vercel, set these under **Project → Settings → Environment Variables** (per environment: Production / Preview / Development).

### Local Supabase workflow
```bash
supabase start              # boot the local stack (Docker)
supabase db reset           # apply migrations + seed (supabase/seed.sql)
supabase functions serve    # run Edge Functions locally
```
Remote DB changes go through migrations in `supabase/migrations/` (`supabase db push`).

### Build for Native
1. Build the web project: `npm run build`.
2. Sync with native platforms: `npx cap sync`.
3. Open in IDE:
   - Android: `npx cap open android`
   - iOS: `npx cap open ios`

## 🧰 Scripts
| Script | What it does |
| --- | --- |
| `npm run dev` / `dev:lan` | Vite dev server (local / LAN-exposed) |
| `npm run build` | Type-check + production build |
| `npm run typecheck` | Type-check only (`tsc -b`) |
| `npm run lint` | ESLint |
| `npm run format` | Prettier write |
| `npm test` / `test:watch` | Vitest (run / watch) |

## 🔒 Security note
Do **not** use default/demo credentials (e.g. `admin / admin`) in any shared or
public environment. Rotate the seeded admin account's password and prefer a
non-obvious username before exposing an instance. Access is role-based (rank
hierarchy) and enforced by Supabase RLS.

---
*Created by Anuar Kairulla*
