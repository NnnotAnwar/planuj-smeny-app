-- =============================================================================
-- LOCATION CODE LETTER  (#92)
-- -----------------------------------------------------------------------------
-- Short code shown in the rota grid cells instead of a ✓ (like the paper rota:
-- "D" = Dittrichova, "M" = Malá Strana). Admins set it by hand; when empty the
-- grid keeps the checkmark. Kept short (1–2 chars) so it fits a day cell.
-- =============================================================================

ALTER TABLE public.locations
  ADD COLUMN IF NOT EXISTS code text CHECK (code IS NULL OR char_length(code) <= 2);
