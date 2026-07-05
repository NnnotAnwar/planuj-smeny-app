-- =============================================================================
-- LATE-FOR-SHIFT ALERTS (15 min / 1 hour)  (#92)
-- -----------------------------------------------------------------------------
-- Every 5 minutes pg_cron checks published, timed rota shifts whose start has
-- passed without the member clocking in. At +15 min and again at +60 min it
-- writes `late_15` / `late_60` audit rows for BOTH the member and their
-- manager (or all org admins when unassigned) — the existing audit webhook
-- then fans out push notifications and the in-app bell picks them up.
-- =============================================================================

ALTER TABLE public.scheduled_shifts
  ADD COLUMN IF NOT EXISTS late15_notified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS late60_notified boolean NOT NULL DEFAULT false;

ALTER TABLE public.shift_audit_log DROP CONSTRAINT IF EXISTS shift_audit_log_action_check;
ALTER TABLE public.shift_audit_log ADD CONSTRAINT shift_audit_log_action_check
  CHECK (action IN (
    'create', 'update', 'delete',
    'username_change', 'name_request_approved', 'name_request_rejected',
    'profile_updated', 'late_15', 'late_60'
  ));

-- One alert = audit rows to the member + their manager (or org admins).
CREATE OR REPLACE FUNCTION public._notify_late(
  p_user uuid, p_manager uuid, p_org uuid, p_action text,
  p_name text, p_loc text, p_start timestamptz, p_minutes int
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_details jsonb := jsonb_build_object(
    'target_name', p_name, 'location_name', p_loc,
    'scheduled_start', p_start, 'minutes', p_minutes
  );
  v_admin uuid;
BEGIN
  -- the member themselves
  INSERT INTO public.shift_audit_log (organization_id, shift_id, actor_id, target_user_id, action, details)
  VALUES (p_org, NULL, NULL, p_user, p_action, v_details);

  IF p_manager IS NOT NULL THEN
    INSERT INTO public.shift_audit_log (organization_id, shift_id, actor_id, target_user_id, action, details)
    VALUES (p_org, NULL, NULL, p_manager, p_action, v_details);
  ELSE
    FOR v_admin IN
      SELECT id FROM public.profiles
      WHERE organization_id = p_org AND role_rank(role) >= 30 AND id <> p_user
    LOOP
      INSERT INTO public.shift_audit_log (organization_id, shift_id, actor_id, target_user_id, action, details)
      VALUES (p_org, NULL, NULL, v_admin, p_action, v_details);
    END LOOP;
  END IF;
END;
$$;
REVOKE EXECUTE ON FUNCTION public._notify_late(uuid, uuid, uuid, text, text, text, timestamptz, int) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.check_late_shifts()
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r RECORD;
  v_min int;
BEGIN
  FOR r IN
    SELECT ss.id, ss.user_id, ss.organization_id, ss.starts_at,
           ss.late15_notified, ss.late60_notified,
           p.manager_id, l.name AS location_name
    FROM public.scheduled_shifts ss
    JOIN public.profiles p ON p.id = ss.user_id
    LEFT JOIN public.locations l ON l.id = ss.location_id
    WHERE ss.published
      AND NOT ss.all_day
      AND ss.starts_at <= now() - interval '15 minutes'
      AND ss.starts_at >  now() - interval '3 hours'     -- stop chasing old shifts
      AND (NOT ss.late15_notified OR NOT ss.late60_notified)
      AND NOT EXISTS (                                    -- clocked in around the start?
        SELECT 1 FROM public.shifts s
        WHERE s.user_id = ss.user_id
          AND s.started_at <= now()
          AND s.started_at >= ss.starts_at - interval '3 hours'
          AND COALESCE(s.ended_at, 'infinity'::timestamptz) > ss.starts_at
      )
  LOOP
    v_min := FLOOR(EXTRACT(EPOCH FROM (now() - r.starts_at)) / 60);
    IF v_min >= 60 AND NOT r.late60_notified THEN
      PERFORM public._notify_late(r.user_id, r.manager_id, r.organization_id, 'late_60',
        public._display_name(r.user_id), r.location_name, r.starts_at, v_min);
      UPDATE public.scheduled_shifts SET late60_notified = true, late15_notified = true WHERE id = r.id;
    ELSIF v_min >= 15 AND v_min < 60 AND NOT r.late15_notified THEN
      PERFORM public._notify_late(r.user_id, r.manager_id, r.organization_id, 'late_15',
        public._display_name(r.user_id), r.location_name, r.starts_at, v_min);
      UPDATE public.scheduled_shifts SET late15_notified = true WHERE id = r.id;
    END IF;
  END LOOP;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.check_late_shifts() FROM PUBLIC, anon, authenticated;

-- Every 5 minutes (idempotent re-schedule).
DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'late-shift-alerts') THEN
    PERFORM cron.unschedule('late-shift-alerts');
  END IF;
END
$do$;
SELECT cron.schedule('late-shift-alerts', '*/5 * * * *', 'SELECT public.check_late_shifts();');
