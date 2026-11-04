-- =============================================================================
-- CZECH PUBLIC HOLIDAYS (státní svátky + ostatní svátky)  — v1.10
-- -----------------------------------------------------------------------------
-- National reference data (not org-scoped): one row per public-holiday date, so
-- the rota can mark státní svátky and surface holiday-pay context. Readable by
-- any signed-in user; only a superadmin can edit (normally it's just seeded).
-- Seeded with the full set of Czech public holidays for 2026 and 2027 (Easter
-- dates: 2026 Easter Sun = 5 Apr → Good Friday 3 Apr, Easter Mon 6 Apr;
-- 2027 Easter Sun = 28 Mar → Good Friday 26 Mar, Easter Mon 29 Mar).
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.public_holidays (
  holiday_date date PRIMARY KEY,
  name_cs      text NOT NULL,
  name_en      text NOT NULL,
  country      text NOT NULL DEFAULT 'CZ'
);

ALTER TABLE public.public_holidays ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_holidays_select" ON public.public_holidays;
CREATE POLICY "public_holidays_select" ON public.public_holidays FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "public_holidays_write" ON public.public_holidays;
CREATE POLICY "public_holidays_write" ON public.public_holidays FOR ALL TO authenticated
  USING (is_superadmin()) WITH CHECK (is_superadmin());

INSERT INTO public.public_holidays (holiday_date, name_cs, name_en) VALUES
  -- 2026
  ('2026-01-01', 'Den obnovy samostatného českého státu / Nový rok', 'Restoration Day of the Independent Czech State / New Year''s Day'),
  ('2026-04-03', 'Velký pátek', 'Good Friday'),
  ('2026-04-06', 'Velikonoční pondělí', 'Easter Monday'),
  ('2026-05-01', 'Svátek práce', 'Labour Day'),
  ('2026-05-08', 'Den vítězství', 'Victory Day'),
  ('2026-07-05', 'Den slovanských věrozvěstů Cyrila a Metoděje', 'Saints Cyril and Methodius Day'),
  ('2026-07-06', 'Den upálení mistra Jana Husa', 'Jan Hus Day'),
  ('2026-09-28', 'Den české státnosti', 'Czech Statehood Day'),
  ('2026-10-28', 'Den vzniku samostatného československého státu', 'Independent Czechoslovak State Day'),
  ('2026-11-17', 'Den boje za svobodu a demokracii', 'Struggle for Freedom and Democracy Day'),
  ('2026-12-24', 'Štědrý den', 'Christmas Eve'),
  ('2026-12-25', '1. svátek vánoční', 'Christmas Day'),
  ('2026-12-26', '2. svátek vánoční', 'St. Stephen''s Day'),
  -- 2027
  ('2027-01-01', 'Den obnovy samostatného českého státu / Nový rok', 'Restoration Day of the Independent Czech State / New Year''s Day'),
  ('2027-03-26', 'Velký pátek', 'Good Friday'),
  ('2027-03-29', 'Velikonoční pondělí', 'Easter Monday'),
  ('2027-05-01', 'Svátek práce', 'Labour Day'),
  ('2027-05-08', 'Den vítězství', 'Victory Day'),
  ('2027-07-05', 'Den slovanských věrozvěstů Cyrila a Metoděje', 'Saints Cyril and Methodius Day'),
  ('2027-07-06', 'Den upálení mistra Jana Husa', 'Jan Hus Day'),
  ('2027-09-28', 'Den české státnosti', 'Czech Statehood Day'),
  ('2027-10-28', 'Den vzniku samostatného československého státu', 'Independent Czechoslovak State Day'),
  ('2027-11-17', 'Den boje za svobodu a demokracii', 'Struggle for Freedom and Democracy Day'),
  ('2027-12-24', 'Štědrý den', 'Christmas Eve'),
  ('2027-12-25', '1. svátek vánoční', 'Christmas Day'),
  ('2027-12-26', '2. svátek vánoční', 'St. Stephen''s Day')
ON CONFLICT (holiday_date) DO NOTHING;

NOTIFY pgrst, 'reload schema';
