-- =============================================================================
-- APPROVED TIME OFF CLEARS THE ROTA  (#92)
-- -----------------------------------------------------------------------------
-- When leave becomes approved (a manager approves a request, or enters leave
-- directly — which inserts pre-approved), the member's scheduled rota shifts
-- on those days are deleted automatically: the days turn into days off.
-- Day matching uses Europe/Prague, same as the rest of the scheduling stack.
-- Declining/withdrawing leave does NOT restore deleted shifts.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.clear_shifts_for_time_off()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  DELETE FROM public.scheduled_shifts
  WHERE user_id = NEW.user_id
    AND (starts_at AT TIME ZONE 'Europe/Prague')::date BETWEEN NEW.starts_on AND NEW.ends_on;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS time_off_clears_shifts ON public.time_off;
CREATE TRIGGER time_off_clears_shifts
  AFTER INSERT OR UPDATE OF status ON public.time_off
  FOR EACH ROW
  WHEN (NEW.status = 'approved')
  EXECUTE FUNCTION public.clear_shifts_for_time_off();

-- One-time catch-up: clear rota days already covered by previously approved leave.
DELETE FROM public.scheduled_shifts ss
USING public.time_off toff
WHERE toff.status = 'approved'
  AND ss.user_id = toff.user_id
  AND (ss.starts_at AT TIME ZONE 'Europe/Prague')::date BETWEEN toff.starts_on AND toff.ends_on;
