# Task: warn when assigning a shift on a public holiday

**Requirement (from the user):** a manager CAN schedule a shift on a public
holiday, but when they do, show a warning dialog first. The dialog has a
"Don't show this again" checkbox; ticking it + confirming ("Got it") dismisses
the warning and suppresses it for future holiday assignments.

**Already built for this:**
- `useHolidays()` (`src/features/schedule/holidays/`) → `holidaysByDate.get(date)` /
  `holidayName(date, lang)` to detect a holiday for a given day.
- `useDismissibleWarning('assign-on-holiday')` (`src/shared/hooks/`) → `{ dismissed,
  dismissForever, reset }`, remembers the "don't show again" choice per device.

**UI to build (together):** in the rota day/shift editor
(`src/features/schedule/components/ScheduledShiftEditor.tsx`), when the chosen
date is a holiday and `!holidayWarn.dismissed`, open a confirm dialog:
> "{date} is a public holiday ({holidayName}). Assign a shift anyway?"
> [ ] Don't show this again      (Cancel) (Got it)
On "Got it": if the box is checked → `holidayWarn.dismissForever()`, then proceed
with the assignment. Offer a "reset holiday warnings" action in Settings later.
