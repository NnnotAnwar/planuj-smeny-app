-- =============================================================================
-- RICHER SCHEDULE + TIME-OFF NOTIFICATIONS & LOGGING  (#92)
-- -----------------------------------------------------------------------------
-- Everything schedule-related now lands in shift_audit_log (Activity Log), and
-- the rows double as notifications (push + bell) via the existing webhook:
--   • schedule_published — Publish targets every member whose drafts went live.
--   • schedule_updated / schedule_removed — editing or deleting a PUBLISHED
--     shift notifies the member; draft changes are logged only (target NULL).
--   • schedule_created — logged only (drafts are invisible to members).
--   • timeoff_requested — a pending request notifies the member's manager
--     (or all org admins when unassigned).
--   • timeoff_approved / timeoff_declined — the decision notifies the member;
--     manager-entered leave counts as an approval.
-- Statement-level triggers with transition tables group bulk operations
-- (quick-fill, clear month, copy month) into ONE row per member, not one per
-- shift.
-- =============================================================================

ALTER TABLE public.shift_audit_log DROP CONSTRAINT IF EXISTS shift_audit_log_action_check;
ALTER TABLE public.shift_audit_log ADD CONSTRAINT shift_audit_log_action_check
  CHECK (action IN (
    'create', 'update', 'delete',
    'username_change', 'name_request_approved', 'name_request_rejected',
    'profile_updated', 'late_15', 'late_60',
    'schedule_created', 'schedule_updated', 'schedule_removed', 'schedule_published',
    'timeoff_requested', 'timeoff_approved', 'timeoff_declined'
  ));

-- --- scheduled_shifts: log every change, notify only about published ones ---

CREATE OR REPLACE FUNCTION public.log_schedule_created()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.shift_audit_log (organization_id, shift_id, actor_id, target_user_id, action, details)
  SELECT g.organization_id, NULL, auth.uid(),
         NULL,                                   -- drafts: log only, never notify
         'schedule_created',
         jsonb_build_object(
           'actor_name', COALESCE(public._display_name(auth.uid()), 'System'),
           'target_name', public._display_name(g.user_id),
           'count', g.cnt,
           'scheduled_start', g.first_start,
           'location_name', g.loc_name
         )
  FROM (
    SELECT n.organization_id, n.user_id, count(*) AS cnt, min(n.starts_at) AS first_start,
           CASE WHEN count(DISTINCT n.location_id) = 1 THEN min(l.name) END AS loc_name
    FROM new_rows n
    LEFT JOIN public.locations l ON l.id = n.location_id
    GROUP BY n.organization_id, n.user_id
  ) g;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.log_schedule_updated()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.shift_audit_log (organization_id, shift_id, actor_id, target_user_id, action, details)
  SELECT g.organization_id, NULL, auth.uid(),
         -- Notify only about published shifts, and never the actor themself.
         CASE WHEN g.published AND g.user_id IS DISTINCT FROM auth.uid() THEN g.user_id END,
         'schedule_updated',
         jsonb_build_object(
           'actor_name', COALESCE(public._display_name(auth.uid()), 'System'),
           'target_name', public._display_name(g.user_id),
           'count', g.cnt,
           'scheduled_start', g.first_start,
           'location_name', g.loc_name
         )
  FROM (
    SELECT n.organization_id, n.user_id, bool_and(o.published AND n.published) AS published,
           count(*) AS cnt, min(n.starts_at) AS first_start,
           CASE WHEN count(DISTINCT n.location_id) = 1 THEN min(l.name) END AS loc_name
    FROM new_rows n
    JOIN old_rows o ON o.id = n.id
    LEFT JOIN public.locations l ON l.id = n.location_id
    WHERE n.starts_at <> o.starts_at
       OR n.ends_at <> o.ends_at
       OR n.all_day <> o.all_day
       OR n.location_id IS DISTINCT FROM o.location_id
       OR n.user_id IS DISTINCT FROM o.user_id
    GROUP BY n.organization_id, n.user_id
  ) g;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.log_schedule_removed()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.shift_audit_log (organization_id, shift_id, actor_id, target_user_id, action, details)
  SELECT g.organization_id, NULL, auth.uid(),
         CASE WHEN g.any_published AND g.user_id IS DISTINCT FROM auth.uid() THEN g.user_id END,
         'schedule_removed',
         jsonb_build_object(
           'actor_name', COALESCE(public._display_name(auth.uid()), 'System'),
           'target_name', public._display_name(g.user_id),
           'count', g.cnt,
           'scheduled_start', g.first_start,
           'location_name', g.loc_name
         )
  FROM (
    SELECT o.organization_id, o.user_id, bool_or(o.published) AS any_published,
           count(*) AS cnt, min(o.starts_at) AS first_start,
           CASE WHEN count(DISTINCT o.location_id) = 1 THEN min(l.name) END AS loc_name
    FROM old_rows o
    LEFT JOIN public.locations l ON l.id = o.location_id
    GROUP BY o.organization_id, o.user_id
  ) g;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS schedule_log_insert ON public.scheduled_shifts;
CREATE TRIGGER schedule_log_insert
  AFTER INSERT ON public.scheduled_shifts
  REFERENCING NEW TABLE AS new_rows
  FOR EACH STATEMENT EXECUTE FUNCTION public.log_schedule_created();

DROP TRIGGER IF EXISTS schedule_log_update ON public.scheduled_shifts;
CREATE TRIGGER schedule_log_update
  AFTER UPDATE ON public.scheduled_shifts
  REFERENCING OLD TABLE AS old_rows NEW TABLE AS new_rows
  FOR EACH STATEMENT EXECUTE FUNCTION public.log_schedule_updated();

DROP TRIGGER IF EXISTS schedule_log_delete ON public.scheduled_shifts;
CREATE TRIGGER schedule_log_delete
  AFTER DELETE ON public.scheduled_shifts
  REFERENCING OLD TABLE AS old_rows
  FOR EACH STATEMENT EXECUTE FUNCTION public.log_schedule_removed();

-- --- Publish: flips drafts live and notifies every member involved ----------
-- The publish UPDATE itself is excluded from schedule_updated (it requires
-- old.published AND new.published), so members get exactly one notification.

CREATE OR REPLACE FUNCTION public.publish_schedule(p_from timestamptz, p_to timestamptz)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_total integer;
BEGIN
  IF my_role_rank() < 20 THEN
    RAISE EXCEPTION 'not allowed';
  END IF;

  WITH upd AS (
    UPDATE public.scheduled_shifts
    SET published = true
    WHERE published = false
      AND starts_at >= p_from AND starts_at < p_to
      AND (organization_id = get_my_org_id() OR is_superadmin())
    RETURNING organization_id, user_id
  ), notif AS (
    INSERT INTO public.shift_audit_log (organization_id, shift_id, actor_id, target_user_id, action, details)
    SELECT organization_id, NULL, auth.uid(),
           CASE WHEN user_id IS DISTINCT FROM auth.uid() THEN user_id END,
           'schedule_published',
           jsonb_build_object(
             'actor_name', COALESCE(public._display_name(auth.uid()), 'System'),
             'target_name', public._display_name(user_id),
             'count', count(*),
             'month_start', p_from
           )
    FROM upd
    GROUP BY organization_id, user_id
    RETURNING 1
  )
  SELECT count(*) INTO v_total FROM upd;
  RETURN COALESCE(v_total, 0);
END;
$$;

-- --- time_off: request -> manager/admins; decision -> the member ------------

CREATE OR REPLACE FUNCTION public.notify_time_off()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_details jsonb := jsonb_build_object(
    'actor_name', COALESCE(public._display_name(auth.uid()), 'System'),
    'target_name', public._display_name(NEW.user_id),
    'kind', NEW.kind,
    'starts_on', NEW.starts_on,
    'ends_on', NEW.ends_on
  );
  v_manager uuid;
  v_recipient uuid;
BEGIN
  IF TG_OP = 'INSERT' AND NEW.status = 'pending' THEN
    -- New request: notify the member's manager, or all org admins when unset.
    SELECT manager_id INTO v_manager FROM public.profiles WHERE id = NEW.user_id;
    IF v_manager IS NOT NULL AND v_manager <> NEW.user_id THEN
      INSERT INTO public.shift_audit_log (organization_id, shift_id, actor_id, target_user_id, action, details)
      VALUES (NEW.organization_id, NULL, NEW.user_id, v_manager, 'timeoff_requested', v_details);
    ELSE
      FOR v_recipient IN
        SELECT id FROM public.profiles
        WHERE organization_id = NEW.organization_id AND role_rank(role) >= 30 AND id <> NEW.user_id
      LOOP
        INSERT INTO public.shift_audit_log (organization_id, shift_id, actor_id, target_user_id, action, details)
        VALUES (NEW.organization_id, NULL, NEW.user_id, v_recipient, 'timeoff_requested', v_details);
      END LOOP;
    END IF;
  ELSIF NEW.status IN ('approved', 'declined')
        AND (TG_OP = 'INSERT' OR OLD.status = 'pending') THEN
    -- Decision (or manager-entered leave, which arrives pre-approved).
    INSERT INTO public.shift_audit_log (organization_id, shift_id, actor_id, target_user_id, action, details)
    VALUES (
      NEW.organization_id, NULL, auth.uid(),
      CASE WHEN NEW.user_id IS DISTINCT FROM auth.uid() THEN NEW.user_id END,
      CASE WHEN NEW.status = 'approved' THEN 'timeoff_approved' ELSE 'timeoff_declined' END,
      v_details
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS time_off_notify ON public.time_off;
CREATE TRIGGER time_off_notify
  AFTER INSERT OR UPDATE OF status ON public.time_off
  FOR EACH ROW EXECUTE FUNCTION public.notify_time_off();
