-- =============================================================================
-- PER-USER LANGUAGE FOR PUSH NOTIFICATIONS  (#90)
-- -----------------------------------------------------------------------------
-- Push bodies are built server-side in `send-push`, which had no way to know the
-- recipient's language (the UI keeps it in localStorage only). Persist it on the
-- per-user notification_preferences row — the function already reads that row to
-- gate delivery — so pushes can be localized. Defaults to English; the client
-- upserts the current language on load and whenever it changes.
-- =============================================================================

ALTER TABLE public.notification_preferences
  ADD COLUMN IF NOT EXISTS language text NOT NULL DEFAULT 'en'
    CHECK (language IN ('en', 'cs'));
