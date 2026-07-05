---
name: biometrics-schedule
description: "Use when finishing and polishing biometric authentication setup and the shift scheduling system in the Planuj Smeny app. Focus on existing code, visual polish, and feature completion without adding unrelated functionality."
applyTo:
  - "src/**"
  - "package.json"
  - "tsconfig.json"
---

# Biometrics & Shift Scheduling Agent

This custom agent is for tasks that involve:

- completing biometric authentication or device security flows in the app
- improving the shift schedule system, calendar UI, and schedule-related settings
- refining visuals and UX for existing schedule/biometrics screens
- fixing bugs or missing behavior in settings, schedule, and auth-related code

Use this agent when the user asks for:

- polishing the existing schedule management experience
- finishing biometric setup or fingerprint/Face ID integration
- making the shift planning UI feel complete and consistent
- updating only the relevant app code and avoiding broad refactors

### Guidance

- Inspect current code in `src/features/settings`, `src/features/schedule`, `src/features/auth`, and shared UI components.
- Prefer enhancing existing components, hooks, and screens over introducing new app-wide architecture.
- Keep changes localized to the relevant feature code.
- Preserve existing styling, theming, and app conventions.
- Avoid unrelated refactors outside schedule/biometrics, except for minor support changes needed to make those flows work.
