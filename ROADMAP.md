# Roadmap

Living plan for **Planuj Směny**. Direction, not commitments — dates and scope
change. Concrete work is tracked as **GitHub Issues** grouped into **Milestones**;
this file is the high-level story, plus a large **idea backlog** to draw from.

_Last updated: July 6, 2026 · current version 1.9.0 “Adamov”._

---

## ✅ Shipped (recent highlights)

- **Scheduling / rota (v1.9.0)** — roster grid + month calendar per location,
  day editor with per-member times & busy-locking (DB no-overlap), per-location
  staff rosters, restaurant short/long-week quick-fill, copy last month,
  draft→publish, location letters + Σ hours, time off (vacation/sick/other) with
  approvals that clear the rota, late-for-shift alerts (+15 min / +1 h),
  exports that mirror the on-screen view, next-shift dashboard card.
- **Notifications** — in-app bell + **push (FCM)**; schedule + time-off events;
  **per-recipient localized push** (EN/CS); per-category preferences; deep-link
  on tap; everything logged to the Activity Log.
- **Foundations** — role hierarchy + org isolation enforced in RLS, invite &
  provisioning flow, realtime board with auto-reconnect, midnight auto-end.
- **Timesheets & exports** — admin shift management, per-employee & team exports
  (PDF / Excel / CSV) with native share, **Czech-correct PDF fonts**, Activity Log.
- **Localization & theming** — English / Čeština, 12h/24h, locale-aware dates,
  four colour motifs + light/dark/system.
- **Navigation & mobile** — ⌘K command palette, collapsible icon-rail sidebar,
  searchable location picker, pull-to-refresh, haptics, offline awareness,
  hardware-back handling, control-center “More” menu.
- **Auth & security** — biometric app lock (admin opt-in), consolidated RLS
  policies, trigger-only functions locked out of the REST API.

---

## 🔭 Now / near-term (tracked issues)

- **#96 GDPR** — account self-deletion + personal-data export (P1).
- **#89 iOS push (APNs)** — gated on Apple Developer + Firebase iOS setup; guide
  in [`docs/ios-push.md`](docs/ios-push.md).
- **#97 Test coverage** — the scheduling logic (quick-fill, copy-month, overlap)
  is barely covered; add unit + a few integration tests.
- **#99 Lock down RLS helper functions** — needs a schema-move (not a naive
  revoke, which breaks RLS); do as a dedicated, tested change.
- **#98 Unused-index review** — revisit once prod has real query volume.

## 🛠 Next (near-term polish)

- **Accent contrast pass** — audit on-accent text for the brighter motifs (a11y /
  WCAG AA), especially amber.
- **12h grid cells** — timed roster cells get cramped with “dop./odp.” suffixes;
  tighten the layout or abbreviate.
- **Empty/error states** — a consistent illustration + retry across pages.
- **Accessibility sweep** — focus rings, ARIA on custom controls, keyboard paths
  through the roster grid and modals, reduced-motion support.

---

## 💡 Idea backlog

Drafts to pull from — not commitments. Rough **value (V)** and **effort (E)** on a
1–5 scale to help triage. Grouped by theme.

### A. Scheduling depth
- **Shift swaps / give-away** — a member offers a shift; a teammate claims it;
  manager approves. Closes the loop the rota opens. _(V5 E4)_
- **Open shifts / shift bidding** — post an unassigned shift; eligible members
  claim or express interest; manager confirms. _(V4 E4)_
- **Availability & preferences** — members mark days/times they can’t work;
  quick-fill and the day editor respect it (like time off but recurring). _(V5 E3)_
- **Custom shift templates** — beyond the restaurant short/long week, let each org
  define named patterns (e.g. “Opening 7–15”, “Close 15–23”) and one-tap apply. _(V4 E3)_
- **Shift roles / positions** — assign a role per shift (bar, kitchen, floor) and
  require N of each per day; warn on understaffing. _(V4 E4)_
- **Coverage requirements** — per-location, per-day minimum headcount with a
  visual “understaffed” flag in the grid. _(V4 E3)_
- **Recurring shifts** — “every Monday 9–17 until end of quarter” without
  re-drawing each month. _(V3 E3)_
- **Shift confirmation** — members acknowledge a published shift (“Got it”);
  managers see who hasn’t confirmed. _(V3 E2)_
- **Conflict & fatigue rules** — warn on back-to-back closes/opens (clopening),
  <11 h rest between shifts, >X consecutive days. _(V4 E3)_
- **Budget / labour-cost view** — planned hours × wage per location per week, vs
  a target; live as you draft. _(V4 E4)_

### B. Time & attendance
- **Geofenced / QR clock-in** — only allow clock-in at the location (GPS radius or
  a printed QR at the venue) to stop off-site punches. _(V4 E4)_
- **Break tracking** — start/stop unpaid breaks instead of the flat mandatory-break
  deduction; more accurate net hours. _(V4 E3)_
- **Clock-in reminders** — nudge a member when their shift starts and they haven’t
  clocked in (complements the manager-facing late alert). _(V3 E2)_
- **Missed-clock-out correction** — a lightweight request/approve when auto-end
  midnight isn’t right, instead of admin-only edits. _(V3 E3)_
- **Overtime rules** — configurable daily/weekly overtime thresholds surfaced in
  Overview and exports. _(V3 E3)_

### C. Manager analytics
- **Team dashboard** — who’s in today, understaffed locations, pending approvals,
  late/absent, all on one manager home. _(V5 E3)_
- **Attendance & punctuality report** — late/no-show counts per member over a
  period. _(V3 E3)_
- **Labour-cost & hours trends** — month-over-month hours per location/member,
  export to payroll. _(V4 E3)_
- **Forecast vs actual** — planned hours vs worked hours variance. _(V3 E4)_

### D. Payroll & compliance (Czech-specific)
- **Payroll export** — a period export shaped for Czech payroll (net hours,
  overtime, weekend/holiday premiums) as CSV/XLSX. _(V5 E3)_
- **Czech public holidays** — auto-mark státní svátky in the rota + holiday-pay
  flags. _(V4 E2)_
- **DPP/DPČ hour caps** — warn when a member on a Dohoda approaches the legal
  monthly/annual hour limit. _(V4 E3)_
- **Rest-period compliance report** — flag legal rest/break violations for audit. _(V3 E3)_

### E. Employee experience
- **My hours & pay estimate** — a member’s running month total + estimated pay
  (if wage is stored). _(V4 E2)_
- **Wallet-style shift widget / calendar sync** — subscribe to your rota as an
  ICS feed or add to Google/Apple Calendar. _(V4 E3)_
- **In-app announcements** — managers post a note to a location/team; shows on
  home with read receipts. _(V3 E3)_
- **Document sharing** — payslips / contracts / training docs per member. _(V3 E4)_
- **Onboarding checklist** — guided first-run for new employees. _(V2 E2)_

### F. Communication
- **Direct + group messaging** — lightweight team chat scoped to org/location
  (or integrate rather than build). _(V3 E5)_
- **Broadcast + acknowledge** — “Shift covered tonight?” with quick replies. _(V3 E3)_
- **Email digests** — weekly rota email to each member; daily manager summary. _(V3 E2)_

### G. Multi-location & org
- **Cross-location staff pool** — share staff between sister venues; see who’s
  free org-wide. _(V4 E4)_
- **Location groups / regions** — roll up analytics for a manager over several
  venues. _(V3 E3)_
- **Per-location settings** — open hours, timezone, break rules, wage bands. _(V3 E3)_

### H. Platform & technical
- **Automated tests + E2E** — Playwright happy-paths in CI (login, clock-in,
  publish, request time off). Pairs with #97. _(V5 E3)_
- **Error monitoring** — Sentry (or similar) for web + native crash reporting. _(V4 E2)_
- **Analytics / product metrics** — privacy-respecting usage analytics to guide
  the roadmap. _(V3 E2)_
- **Offline queue** — queue clock-in/out offline and sync on reconnect. _(V4 E4)_
- **Performance budget** — code-split the heavy export libs further; lazy-load
  the schedule grid; track bundle size in CI. _(V3 E3)_
- **Design-system pass** — extract the ad-hoc Tailwind patterns into documented
  primitives (Button/Card/Modal/Table) for consistency. _(V3 E3)_
- **Backup/restore & audit retention** — scheduled DB backups + an audit-log
  retention policy. _(V3 E2)_

### I. Growth & product
- **Self-serve org signup** — create an organization without manual provisioning;
  onboarding flow. _(V4 E4)_
- **Billing / plans** — tiered plans (seats/locations) if this becomes a product. _(V3 E5)_
- **Templates by venue type** — starter rosters for café / restaurant / retail. _(V2 E2)_
- **Referral / multi-tenant admin** — a super-console for managing many orgs. _(V2 E3)_

### J. Trust & security
- **2FA / stronger auth** for admins (TOTP). _(V4 E3)_
- **Session management** — see & revoke active devices; force-logout. _(V3 E3)_
- **Audit export** — download the Activity Log for a period (compliance). _(V3 E2)_
- **Granular permissions** — beyond ranks, per-capability toggles for edge orgs. _(V2 E4)_

---

## 🧭 Recommendations & advice

Opinionated guidance for where to invest next.

1. **Close the scheduling loop before adding new surfaces.** The rota is the
   crown jewel; the highest-leverage follow-ups are **availability/preferences**
   (A) and **shift swaps** (A) — they make the schedule self-maintaining and are
   what staff ask for first. Ship those before breadth.
2. **Make attendance trustworthy.** **Geofenced/QR clock-in** (B) is the single
   feature that turns “nice rota app” into “system of record” for a restaurant —
   it stops buddy-punching and off-site clock-ins. High ROI.
3. **Own the Czech-payroll last mile.** A **payroll-shaped export** + **public
   holidays** + **DPP/DPČ caps** (D) is a strong, defensible wedge for the local
   market and turns hours into money — the reason owners keep using it.
4. **Invest in tests now, not later.** The scheduling logic (quick-fill parity,
   copy-month week-matching, overlap guard) is intricate and under-tested (#97).
   Add unit tests + a handful of Playwright E2E happy-paths in CI before the code
   grows further — cheaper than debugging regressions in production.
5. **Add error monitoring early.** Sentry (web + native) will surface real
   user-facing failures you can’t see from here — especially on iOS once push
   lands. Two hours of setup, outsized payoff.
6. **Guard the roadmap with product metrics.** Lightweight, privacy-respecting
   analytics (which features are used, where people drop off) will tell you which
   of the 40+ ideas above are worth building. Decide with data.
7. **Keep the bundle lean.** Exports already lazy-load; do the same for the
   schedule grid and any future heavy view, and track bundle size in CI so it
   doesn’t creep.
8. **Accessibility is close — finish it.** The UI is polished; a focused a11y
   pass (contrast on bright motifs, focus rings, ARIA, keyboard through the grid)
   gets you to WCAG AA and widens who can use it.

---

## 📌 How work is tracked

- **Issues** — one per concrete task, labelled by `area:*` and `priority:*`.
- **Milestones** — group issues into shippable chunks.
- **Releases** — semver tags (`vX.Y.Z`) + GitHub Releases with changelogs; notable
  releases carry a Czech-town codename A→Z (v1.9.0 = _Adamov_; next = _B_).

Have an idea or found a bug? Open an issue.
