# Announcements — your task ladder 📣

Branch: **`feat/announcements`**. The backend plumbing is done and compiles
(types, service, hook, migration). **You build the UI.** Each task is one step
up in skill — do them in order, commit after each (atomic commits), ask me if
stuck on any step. By the end you'll have shipped a whole feature.

> Golden rule you already know: **UI → hook → service → supabase → DB**. You'll
> live mostly in the UI layer and *consume* the `useAnnouncements` hook I wrote.

---

## Task 0 — (together, first thing) make it runnable
I can't apply DB changes to the live database while you sleep, so this one we do
together when you're back:
- Apply `supabase/migrations/20261025120000_announcements.sql` to **preprod**.
- (Optional but recommended) point local `dev` at **preprod** instead of prod so
  you can create test announcements without touching live data.
- Ping me: "давай applying migration" and I'll run it + verify.

---

## Task 1 — render the list  ⭐ (consume a hook, map a list)
**Goal:** a new page that shows the org's announcements.
**New file:** `src/features/announcements/AnnouncementsPage.tsx`
**Concepts:** calling a hook, `.map()` over data, loading / empty states.
**Steps:**
1. Get the current user from `useAuthContext()` (see how `SettingsPage.tsx` does it).
2. `const { list } = useAnnouncements(user);`
3. Render:
   - `list.isLoading` → a loading state (reuse `Skeleton` from `@shared/components`).
   - `list.data.length === 0` → an empty state ("No announcements yet").
   - otherwise `list.data.map(a => ...)` → a card per announcement showing
     `a.title`, `a.body`, and "posted by {a.author?.username}".
**Done when:** you can see the page (even if the list is empty). Copy the page
structure/spacing from an existing page like `SettingsPage.tsx`.

## Task 2 — show it in navigation  (routing + nav)
**Goal:** reach the page from the app.
**Files:** `src/App.tsx` (add a `<Route path="announcements" .../>` next to the
others ~line 108), and the nav config in `src/app/navigation.*` (add an item;
see how `schedule` / `requests` are registered).
**Concepts:** React Router routes, the app's nav config.
**Done when:** tapping the nav item opens your page.

## Task 3 — the composer: post an announcement  (controlled form + mutation)
**Goal:** a form where a manager types a title + body and posts it.
**New file:** `src/features/announcements/AnnouncementComposer.tsx` (or a modal).
**Concepts:** `useState` for inputs (you've done this!), calling a mutation.
**Steps:**
1. `const { create } = useAnnouncements(user);`
2. Local state: `title`, `body`.
3. On submit: `create.mutate({ title, body })`, clear the inputs.
4. Disable the button while `create.isPending`; the hook already shows a toast.
**Done when:** you post one and it appears in the list (realtime refreshes it).

## Task 4 — only managers see the composer  (permissions)
**Goal:** staff see the list; only managers (rank ≥ 20) see the "New" button/form.
**Files:** your page + `src/shared/auth/permissions.ts` (there's a `RANK` map).
**Concepts:** conditional rendering by role — `user.role.rank >= RANK.MANAGER`.
**Done when:** a staff account has no composer; a manager does. (RLS already
blocks staff on the server — this is the UI matching that.)

## Task 5 — localize everything  (i18n, EN + CS)
**Goal:** no hardcoded English strings.
**File:** `src/shared/i18n/translations.ts` — add `announcements.*` keys to BOTH
`en` and `cs` (remember the parity lesson!). Use `t('announcements.title')` etc.
**Done when:** switching language in Settings translates the whole feature.

---

## Stretch tasks (real feature-dev — tackle when ready)
- **Edit & delete** — wire `update` / `remove` from the hook; manager-only, confirm before delete.
- **Pin** — a star toggle that sets `pinned`; pinned rows already sort to the top.
- **Target a location** — a location dropdown in the composer (reuse `LocationPicker`); show a location chip on the card.
- **Home banner** — show the newest *pinned* announcement on the Home page.
- **Tests** — a small test for a pure helper (e.g. "sort pinned first / newest first"); mirror `shiftStats.test.ts`.
- **Push on post** — reuse the `send-push` pipeline so members get a notification. (Backend-ish — pair with me.)

---

### Working rhythm
- Commit after each task: `feat(announcements): <what>` (I can walk you through each).
- Keep `corepack yarn typecheck` and `corepack yarn lint` green before committing.
- We push the whole branch as ONE PR when the feature is ready.
- Stuck anywhere? Tell me the task number — we debug it together.

You've got this. This is the jump from micro-tasks to owning a feature. 🚀
