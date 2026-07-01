# Roadmap

Living plan for **Planuj Směny**. Direction, not commitments — dates and scope
change. Concrete work is tracked as **GitHub Issues** grouped into **Milestones**;
this file is the high-level story.

_Last updated: July 1, 2026 · current version 1.8.0._

---

## ✅ Shipped (recent highlights)

- **Foundations** — role hierarchy + org isolation enforced in RLS, invite &
  provisioning flow, realtime board with auto-reconnect, midnight auto-end.
- **Timesheets & exports** — admin shift management, per-employee & team
  exports (PDF / Excel / CSV) with native share, Activity Log.
- **Localization & theming** — English / Čeština, 12h/24h, locale-aware dates,
  four colour motifs + light/dark/system.
- **Navigation** — single source of truth for sidebar + bottom nav, grouped
  sections, **⌘K command palette**, searchable location picker (recent posts).
- **Mobile UX** — pull-to-refresh, haptics, skeleton loaders, hardware-back
  dismisses overlays, control-center "More" menu, app version from build.
- **Notifications** — in-app bell + **push (FCM)**, admin profile-change events,
  per-category preferences, token lifecycle, deep-link on tap.
- **DB & security hygiene** — FK indexes, RLS init-plan tuning, seed sanitized,
  local-timezone month bucketing.

---

## 🔭 Now / near-term

- **iOS push (APNs)** — Android push is live; wire the Apple side (capability,
  APNs key) and verify end-to-end.
- **Localized push content** — push bodies are English; persist the user's
  language (DB) so the server can localize.
- **Localized export documents** — PDF/CSV/Excel labels are English; localize.

## 🛠 Next

- **Offline awareness** — network status banner + guard clock-in when offline
  (`@capacitor/network`).
- **Scheduling ahead** — plan future shifts, with **shift-start reminders** via
  push.
- **Accent contrast pass** — tune on-accent text for the brighter motifs (a11y).
- **RLS performance** — consolidate multiple permissive policies flagged by the
  advisor.

## 🧪 Later / exploration

- **Biometric app lock** for admins (employee data at rest).
- **Collapsible icon-rail** sidebar as an optional compact mode.
- **Command palette actions** — quick actions (toggle theme, log out, export).
- **2FA / stronger auth** for admin accounts.

---

## 📌 How work is tracked

- **Issues** — one per concrete task, labelled by `area:*` and `priority:*`.
- **Milestones** — group issues into shippable chunks (e.g. `v1.9 Notifications`,
  `v2.0 Scheduling`).
- **Releases** — semver tags (`vX.Y.Z`) + GitHub Releases with changelogs.

Have an idea or found a bug? Open an issue.
