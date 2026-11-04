-- =============================================================================
-- PER-LOCATION SETTINGS (open hours, break rule, timezone)  — v1.10
-- -----------------------------------------------------------------------------
-- Optional operational settings per location: default open/close times, the
-- unpaid-break rule, and timezone. One row per location. Org-scoped; managers
-- manage, members read (the rota/clock surfaces them). Extend to per-weekday
-- hours later if needed.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.location_settings (
  location_id     uuid PRIMARY KEY REFERENCES public.locations(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  open_time       time,
  close_time      time,
  timezone        text NOT NULL DEFAULT 'Europe/Prague',
  break_minutes   smallint NOT NULL DEFAULT 0 CHECK (break_minutes >= 0),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS location_settings_org_idx ON public.location_settings (organization_id);

ALTER TABLE public.location_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "location_settings_select" ON public.location_settings;
CREATE POLICY "location_settings_select" ON public.location_settings FOR SELECT TO authenticated
  USING (is_superadmin() OR organization_id = get_my_org_id());

DROP POLICY IF EXISTS "location_settings_write" ON public.location_settings;
CREATE POLICY "location_settings_write" ON public.location_settings FOR ALL TO authenticated
  USING (is_superadmin() OR (my_role_rank() >= 20 AND organization_id = get_my_org_id()))
  WITH CHECK (is_superadmin() OR (my_role_rank() >= 20 AND organization_id = get_my_org_id()));

NOTIFY pgrst, 'reload schema';
