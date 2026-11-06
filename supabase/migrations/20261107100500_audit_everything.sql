-- =============================================================================
-- ACTIVITY LOG: EVERY ACTION
-- Until now the log held admin shift edits, the rota, time off, name/username
-- changes, late alerts, swaps and roles. This adds everything else people do:
-- clocking in/out, requests (made, cancelled), announcements, open shifts,
-- confirmations, availability, templates, coverage, wages (no amounts),
-- locations + their hours, the organization, location rosters and managers.
--
-- • `subject_id` — who an entry is ABOUT (filter by employee), separate from
--   `target_user_id`, which is who gets NOTIFIED (bell + push). New entries
--   are activity-only: they set subject_id, not target_user_id.
-- • `action` is no longer a closed list (it grew with every feature); any
--   snake_case name is accepted.
-- • Deletes that cascade from removing a person run without a signed-in user
--   (service role) and are skipped, so deleting someone doesn't flood the log.
-- =============================================================================

ALTER TABLE public.shift_audit_log
  ADD COLUMN IF NOT EXISTS subject_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS shift_audit_log_subject_idx ON public.shift_audit_log (subject_id);
CREATE INDEX IF NOT EXISTS shift_audit_log_org_action_idx ON public.shift_audit_log (organization_id, action, created_at DESC);

DO $$
DECLARE c text;
BEGIN
  SELECT conname INTO c FROM pg_constraint
  WHERE conrelid = 'public.shift_audit_log'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) ILIKE '%action%';
  IF c IS NOT NULL THEN EXECUTE format('ALTER TABLE public.shift_audit_log DROP CONSTRAINT %I', c); END IF;
END $$;
ALTER TABLE public.shift_audit_log
  ADD CONSTRAINT shift_audit_log_action_check CHECK (action ~ '^[a-z0-9_]{2,40}$');

-- ---------------------------------------------------------------------------
-- Helper: one activity entry by the signed-in user (or "System").
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._audit(p_org uuid, p_action text, p_subject uuid, p_details jsonb DEFAULT '{}'::jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_org IS NULL OR NOT EXISTS (SELECT 1 FROM public.organizations WHERE id = p_org) THEN RETURN; END IF;
  IF p_subject IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_subject) THEN p_subject := NULL; END IF;
  INSERT INTO public.shift_audit_log (organization_id, shift_id, actor_id, target_user_id, subject_id, action, details)
  VALUES (p_org, NULL, auth.uid(), NULL, p_subject, p_action,
          jsonb_strip_nulls(jsonb_build_object(
            'actor_name', COALESCE(public._display_name(auth.uid()), 'System'),
            'target_name', CASE WHEN p_subject IS NOT NULL THEN public._display_name(p_subject) END))
          || jsonb_strip_nulls(COALESCE(p_details, '{}'::jsonb)));
END;
$$;
REVOKE EXECUTE ON FUNCTION public._audit(uuid, text, uuid, jsonb) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public._loc_name(p_loc uuid) RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT name FROM public.locations WHERE id = p_loc
$$;
REVOKE EXECUTE ON FUNCTION public._loc_name(uuid) FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Clock in / out / switch location (self). Admin edits log via admin_* RPCs.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.audit_clock() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF auth.uid() IS DISTINCT FROM NEW.user_id THEN RETURN NULL; END IF;
    PERFORM public._audit(NEW.organization_id, 'clock_in', NEW.user_id,
      jsonb_build_object('starts_at', NEW.started_at, 'location_name', public._loc_name(NEW.location_id)));
  ELSE
    -- Signed-in someone else = an admin RPC, which logs itself.
    IF auth.uid() IS NOT NULL AND auth.uid() <> NEW.user_id THEN RETURN NULL; END IF;
    IF OLD.ended_at IS NULL AND NEW.ended_at IS NOT NULL THEN
      PERFORM public._audit(NEW.organization_id, 'clock_out', NEW.user_id,
        jsonb_build_object('starts_at', NEW.started_at, 'ends_at', NEW.ended_at,
                           'location_name', public._loc_name(NEW.location_id),
                           'auto', CASE WHEN auth.uid() IS NULL THEN true END));
    ELSIF NEW.ended_at IS NULL AND NEW.location_id IS DISTINCT FROM OLD.location_id THEN
      PERFORM public._audit(NEW.organization_id, 'clock_switched', NEW.user_id,
        jsonb_build_object('changes', jsonb_build_array(jsonb_build_object('field', 'location',
          'old', public._loc_name(OLD.location_id), 'new', public._loc_name(NEW.location_id)))));
    END IF;
  END IF;
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS audit_clock ON public.shifts;
CREATE TRIGGER audit_clock AFTER INSERT OR UPDATE OF ended_at, location_id ON public.shifts
  FOR EACH ROW EXECUTE FUNCTION public.audit_clock();

-- ---------------------------------------------------------------------------
-- Time off withdrawn / removed.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.audit_time_off_delete() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN NULL; END IF;
  PERFORM public._audit(OLD.organization_id, 'timeoff_cancelled', OLD.user_id,
    jsonb_build_object('kind', OLD.kind, 'starts_on', OLD.starts_on, 'ends_on', OLD.ends_on, 'status', OLD.status));
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS audit_time_off_delete ON public.time_off;
CREATE TRIGGER audit_time_off_delete AFTER DELETE ON public.time_off
  FOR EACH ROW EXECUTE FUNCTION public.audit_time_off_delete();

-- ---------------------------------------------------------------------------
-- Name change requested / cancelled (decisions already log).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.audit_name_request() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public._audit(NEW.organization_id, 'name_requested', NEW.user_id, jsonb_build_object(
      'old_name', NULLIF(btrim(concat_ws(' ', NEW.current_first_name, NEW.current_last_name)), ''),
      'new_name', NULLIF(btrim(concat_ws(' ', NEW.requested_first_name, NEW.requested_last_name)), ''),
      'note', NEW.note));
  ELSIF OLD.status = 'pending' AND auth.uid() IS NOT NULL THEN
    PERFORM public._audit(OLD.organization_id, 'name_request_cancelled', OLD.user_id, jsonb_build_object(
      'new_name', NULLIF(btrim(concat_ws(' ', OLD.requested_first_name, OLD.requested_last_name)), '')));
  END IF;
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS audit_name_request ON public.name_change_requests;
CREATE TRIGGER audit_name_request AFTER INSERT OR DELETE ON public.name_change_requests
  FOR EACH ROW EXECUTE FUNCTION public.audit_name_request();

-- ---------------------------------------------------------------------------
-- Swaps: offered / withdrawn / taker backed out (taken + decisions already log).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.audit_swap() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_shift public.scheduled_shifts;
  v_det jsonb;
BEGIN
  SELECT * INTO v_shift FROM public.scheduled_shifts WHERE id = NEW.shift_id;
  v_det := jsonb_build_object('starts_at', v_shift.starts_at, 'ends_at', v_shift.ends_at, 'all_day', v_shift.all_day,
                              'location_name', public._loc_name(v_shift.location_id),
                              'to_name', public._display_name(NEW.to_user), 'note', NEW.note);
  IF TG_OP = 'INSERT' THEN
    PERFORM public._audit(NEW.organization_id, 'swap_offered', NEW.from_user, v_det);
  ELSIF NEW.status = 'withdrawn' AND OLD.status <> 'withdrawn' THEN
    PERFORM public._audit(NEW.organization_id, 'swap_withdrawn', NEW.from_user, v_det);
  ELSIF OLD.status = 'taken' AND NEW.status = 'open' THEN
    PERFORM public._audit(NEW.organization_id, 'swap_released', OLD.taker_id, v_det);
  END IF;
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS audit_swap ON public.shift_swaps;
CREATE TRIGGER audit_swap AFTER INSERT OR UPDATE OF status ON public.shift_swaps
  FOR EACH ROW EXECUTE FUNCTION public.audit_swap();

-- ---------------------------------------------------------------------------
-- Announcements.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.audit_announcement() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public._audit(NEW.organization_id, 'announcement_posted', NULL,
      jsonb_build_object('subject_name', NEW.title, 'location_name', public._loc_name(NEW.location_id), 'pinned', NULLIF(NEW.pinned, false)));
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.title IS DISTINCT FROM OLD.title OR NEW.body IS DISTINCT FROM OLD.body
       OR NEW.pinned IS DISTINCT FROM OLD.pinned OR NEW.location_id IS DISTINCT FROM OLD.location_id THEN
      PERFORM public._audit(NEW.organization_id, 'announcement_edited', NULL, jsonb_build_object(
        'subject_name', NEW.title,
        'changes', (SELECT COALESCE(jsonb_agg(x), '[]'::jsonb) FROM (
          SELECT jsonb_build_object('field', 'title', 'old', OLD.title, 'new', NEW.title) x WHERE NEW.title IS DISTINCT FROM OLD.title
          UNION ALL SELECT jsonb_build_object('field', 'text') WHERE NEW.body IS DISTINCT FROM OLD.body
          UNION ALL SELECT jsonb_build_object('field', 'pinned', 'old', OLD.pinned::text, 'new', NEW.pinned::text) WHERE NEW.pinned IS DISTINCT FROM OLD.pinned
          UNION ALL SELECT jsonb_build_object('field', 'location', 'old', public._loc_name(OLD.location_id), 'new', public._loc_name(NEW.location_id)) WHERE NEW.location_id IS DISTINCT FROM OLD.location_id
        ) s)));
    END IF;
  ELSIF auth.uid() IS NOT NULL THEN
    PERFORM public._audit(OLD.organization_id, 'announcement_deleted', NULL, jsonb_build_object('subject_name', OLD.title));
  END IF;
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS audit_announcement ON public.announcements;
CREATE TRIGGER audit_announcement AFTER INSERT OR UPDATE OR DELETE ON public.announcements
  FOR EACH ROW EXECUTE FUNCTION public.audit_announcement();

-- ---------------------------------------------------------------------------
-- Open shifts: posted / claimed / released / edited / removed.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.audit_open_shift() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r public.open_shifts := CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  v_det jsonb := jsonb_build_object('starts_at', r.starts_at, 'ends_at', r.ends_at,
                                    'location_name', public._loc_name(r.location_id), 'shift_role', r.role);
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public._audit(NEW.organization_id, 'open_shift_posted', NULL, v_det);
  ELSIF TG_OP = 'DELETE' THEN
    IF auth.uid() IS NOT NULL THEN PERFORM public._audit(OLD.organization_id, 'open_shift_removed', OLD.claimed_by, v_det); END IF;
  ELSIF OLD.claimed_by IS NULL AND NEW.claimed_by IS NOT NULL THEN
    PERFORM public._audit(NEW.organization_id, 'open_shift_claimed', NEW.claimed_by, v_det);
  ELSIF OLD.claimed_by IS NOT NULL AND NEW.claimed_by IS NULL THEN
    PERFORM public._audit(NEW.organization_id, 'open_shift_released', OLD.claimed_by, v_det);
  ELSIF (NEW.starts_at, NEW.ends_at, NEW.location_id, NEW.role, NEW.note)
        IS DISTINCT FROM (OLD.starts_at, OLD.ends_at, OLD.location_id, OLD.role, OLD.note) THEN
    PERFORM public._audit(NEW.organization_id, 'open_shift_edited', NULL, v_det);
  END IF;
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS audit_open_shift ON public.open_shifts;
CREATE TRIGGER audit_open_shift AFTER INSERT OR UPDATE OR DELETE ON public.open_shifts
  FOR EACH ROW EXECUTE FUNCTION public.audit_open_shift();

-- ---------------------------------------------------------------------------
-- Shift confirmed by the employee.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.audit_confirmation() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_shift public.scheduled_shifts;
BEGIN
  SELECT * INTO v_shift FROM public.scheduled_shifts WHERE id = NEW.scheduled_shift_id;
  PERFORM public._audit(NEW.organization_id, 'shift_confirmed', NEW.user_id, jsonb_build_object(
    'starts_at', v_shift.starts_at, 'ends_at', v_shift.ends_at, 'all_day', v_shift.all_day,
    'location_name', public._loc_name(v_shift.location_id)));
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS audit_confirmation ON public.shift_confirmations;
CREATE TRIGGER audit_confirmation AFTER INSERT ON public.shift_confirmations
  FOR EACH ROW EXECUTE FUNCTION public.audit_confirmation();

-- ---------------------------------------------------------------------------
-- Availability: one entry per person per save (statement level).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.audit_availability() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE g record;
BEGIN
  IF auth.uid() IS NULL THEN RETURN NULL; END IF;
  FOR g IN
    SELECT organization_id, user_id, count(*) AS cnt FROM new_rows GROUP BY 1, 2
  LOOP
    PERFORM public._audit(g.organization_id, 'availability_updated', g.user_id, jsonb_build_object('count', g.cnt));
  END LOOP;
  RETURN NULL;
END;
$$;
CREATE OR REPLACE FUNCTION public.audit_availability_delete() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE g record;
BEGIN
  IF auth.uid() IS NULL THEN RETURN NULL; END IF;
  FOR g IN SELECT organization_id, user_id, count(*) AS cnt FROM old_rows GROUP BY 1, 2 LOOP
    PERFORM public._audit(g.organization_id, 'availability_removed', g.user_id, jsonb_build_object('count', g.cnt));
  END LOOP;
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS audit_availability_ins ON public.availability;
DROP TRIGGER IF EXISTS audit_availability_upd ON public.availability;
DROP TRIGGER IF EXISTS audit_availability_del ON public.availability;
CREATE TRIGGER audit_availability_ins AFTER INSERT ON public.availability
  REFERENCING NEW TABLE AS new_rows FOR EACH STATEMENT EXECUTE FUNCTION public.audit_availability();
CREATE TRIGGER audit_availability_upd AFTER UPDATE ON public.availability
  REFERENCING NEW TABLE AS new_rows FOR EACH STATEMENT EXECUTE FUNCTION public.audit_availability();
CREATE TRIGGER audit_availability_del AFTER DELETE ON public.availability
  REFERENCING OLD TABLE AS old_rows FOR EACH STATEMENT EXECUTE FUNCTION public.audit_availability_delete();

-- ---------------------------------------------------------------------------
-- Shift templates.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.audit_template() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.shift_templates := CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
BEGIN
  IF TG_OP = 'DELETE' AND auth.uid() IS NULL THEN RETURN NULL; END IF;
  IF TG_OP = 'UPDATE' AND (NEW.name, NEW.role, NEW.start_time, NEW.end_time, NEW.color)
                          IS NOT DISTINCT FROM (OLD.name, OLD.role, OLD.start_time, OLD.end_time, OLD.color) THEN
    RETURN NULL;
  END IF;
  PERFORM public._audit(r.organization_id,
    CASE TG_OP WHEN 'INSERT' THEN 'template_created' WHEN 'UPDATE' THEN 'template_updated' ELSE 'template_deleted' END,
    NULL, jsonb_build_object('subject_name', r.name, 'start_time', to_char(r.start_time, 'HH24:MI'),
                             'end_time', to_char(r.end_time, 'HH24:MI'), 'shift_role', r.role));
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS audit_template ON public.shift_templates;
CREATE TRIGGER audit_template AFTER INSERT OR UPDATE OR DELETE ON public.shift_templates
  FOR EACH ROW EXECUTE FUNCTION public.audit_template();

-- ---------------------------------------------------------------------------
-- Coverage (minimum staffing): one entry per location per save.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.audit_coverage() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE g record;
BEGIN
  IF auth.uid() IS NULL THEN RETURN NULL; END IF;
  IF TG_OP = 'DELETE' THEN
    FOR g IN SELECT organization_id, location_id FROM old_rows GROUP BY 1, 2 LOOP
      PERFORM public._audit(g.organization_id, 'coverage_updated', NULL, jsonb_build_object('subject_name', public._loc_name(g.location_id)));
    END LOOP;
  ELSE
    FOR g IN SELECT organization_id, location_id FROM new_rows GROUP BY 1, 2 LOOP
      PERFORM public._audit(g.organization_id, 'coverage_updated', NULL, jsonb_build_object('subject_name', public._loc_name(g.location_id)));
    END LOOP;
  END IF;
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS audit_coverage_ins ON public.coverage_requirements;
DROP TRIGGER IF EXISTS audit_coverage_upd ON public.coverage_requirements;
DROP TRIGGER IF EXISTS audit_coverage_del ON public.coverage_requirements;
CREATE TRIGGER audit_coverage_ins AFTER INSERT ON public.coverage_requirements
  REFERENCING NEW TABLE AS new_rows FOR EACH STATEMENT EXECUTE FUNCTION public.audit_coverage();
CREATE TRIGGER audit_coverage_upd AFTER UPDATE ON public.coverage_requirements
  REFERENCING NEW TABLE AS new_rows FOR EACH STATEMENT EXECUTE FUNCTION public.audit_coverage();
CREATE TRIGGER audit_coverage_del AFTER DELETE ON public.coverage_requirements
  REFERENCING OLD TABLE AS old_rows FOR EACH STATEMENT EXECUTE FUNCTION public.audit_coverage();

-- ---------------------------------------------------------------------------
-- Wages: who changed whose rate and from when — never the amount (the log is
-- readable by people who may not see wages).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.audit_wage() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF auth.uid() IS NOT NULL THEN
      PERFORM public._audit(OLD.organization_id, 'wage_removed', OLD.user_id, '{}'::jsonb);
    END IF;
  ELSIF TG_OP = 'INSERT' OR (NEW.hourly_rate, NEW.currency, NEW.effective_from) IS DISTINCT FROM (OLD.hourly_rate, OLD.currency, OLD.effective_from) THEN
    PERFORM public._audit(NEW.organization_id, 'wage_changed', NEW.user_id, jsonb_build_object('starts_on', NEW.effective_from));
  END IF;
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS audit_wage ON public.member_wages;
CREATE TRIGGER audit_wage AFTER INSERT OR UPDATE OR DELETE ON public.member_wages
  FOR EACH ROW EXECUTE FUNCTION public.audit_wage();

-- ---------------------------------------------------------------------------
-- Locations + their opening hours.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.audit_location() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_changes jsonb := '[]'::jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public._audit(NEW.organization_id, 'location_created', NULL, jsonb_build_object('subject_name', NEW.name));
    RETURN NULL;
  END IF;
  IF OLD.archived_at IS NULL AND NEW.archived_at IS NOT NULL THEN
    PERFORM public._audit(NEW.organization_id, 'location_archived', NULL, jsonb_build_object('subject_name', NEW.name));
  ELSIF OLD.archived_at IS NOT NULL AND NEW.archived_at IS NULL THEN
    PERFORM public._audit(NEW.organization_id, 'location_restored', NULL, jsonb_build_object('subject_name', NEW.name));
  END IF;
  IF NEW.name IS DISTINCT FROM OLD.name THEN
    v_changes := v_changes || jsonb_build_object('field', 'name', 'old', OLD.name, 'new', NEW.name);
  END IF;
  IF NEW.code IS DISTINCT FROM OLD.code THEN
    v_changes := v_changes || jsonb_build_object('field', 'code', 'old', OLD.code, 'new', NEW.code);
  END IF;
  IF NEW.organization_id IS DISTINCT FROM OLD.organization_id THEN
    v_changes := v_changes || jsonb_build_object('field', 'organization',
      'old', (SELECT name FROM public.organizations WHERE id = OLD.organization_id),
      'new', (SELECT name FROM public.organizations WHERE id = NEW.organization_id));
  END IF;
  IF jsonb_array_length(v_changes) > 0 THEN
    PERFORM public._audit(NEW.organization_id, 'location_updated', NULL, jsonb_build_object('subject_name', NEW.name, 'changes', v_changes));
  END IF;
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS audit_location ON public.locations;
CREATE TRIGGER audit_location AFTER INSERT OR UPDATE ON public.locations
  FOR EACH ROW EXECUTE FUNCTION public.audit_location();

CREATE OR REPLACE FUNCTION public.audit_location_settings() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_changes jsonb := '[]'::jsonb;
BEGIN
  IF TG_OP = 'INSERT' OR NEW.open_time IS DISTINCT FROM OLD.open_time OR NEW.close_time IS DISTINCT FROM OLD.close_time THEN
    v_changes := v_changes || jsonb_build_object('field', 'hours',
      'old', CASE WHEN TG_OP = 'UPDATE' AND OLD.open_time IS NOT NULL THEN to_char(OLD.open_time, 'HH24:MI') || '–' || to_char(OLD.close_time, 'HH24:MI') END,
      'new', CASE WHEN NEW.open_time IS NOT NULL THEN to_char(NEW.open_time, 'HH24:MI') || '–' || to_char(NEW.close_time, 'HH24:MI') END);
  END IF;
  IF (TG_OP = 'INSERT' AND COALESCE(NEW.break_minutes, 0) > 0) OR (TG_OP = 'UPDATE' AND NEW.break_minutes IS DISTINCT FROM OLD.break_minutes) THEN
    v_changes := v_changes || jsonb_build_object('field', 'break',
      'old', CASE WHEN TG_OP = 'UPDATE' THEN OLD.break_minutes::text END, 'new', NEW.break_minutes::text);
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.timezone IS DISTINCT FROM OLD.timezone THEN
    v_changes := v_changes || jsonb_build_object('field', 'timezone', 'old', OLD.timezone, 'new', NEW.timezone);
  END IF;
  IF jsonb_array_length(v_changes) > 0 THEN
    PERFORM public._audit(NEW.organization_id, 'location_hours', NULL,
      jsonb_build_object('subject_name', public._loc_name(NEW.location_id), 'changes', v_changes));
  END IF;
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS audit_location_settings ON public.location_settings;
CREATE TRIGGER audit_location_settings AFTER INSERT OR UPDATE ON public.location_settings
  FOR EACH ROW EXECUTE FUNCTION public.audit_location_settings();

-- Who works at which location.
CREATE OR REPLACE FUNCTION public.audit_roster() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public._audit(NEW.organization_id, 'roster_added', NEW.user_id, jsonb_build_object('location_name', public._loc_name(NEW.location_id)));
  ELSIF auth.uid() IS NOT NULL THEN
    PERFORM public._audit(OLD.organization_id, 'roster_removed', OLD.user_id, jsonb_build_object('location_name', public._loc_name(OLD.location_id)));
  END IF;
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS audit_roster ON public.location_roster;
CREATE TRIGGER audit_roster AFTER INSERT OR DELETE ON public.location_roster
  FOR EACH ROW EXECUTE FUNCTION public.audit_roster();

-- ---------------------------------------------------------------------------
-- The organization itself.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.audit_organization() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_changes jsonb := '[]'::jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public._audit(NEW.id, 'org_created', NULL, jsonb_build_object('subject_name', NEW.name));
    RETURN NULL;
  END IF;
  IF NEW.name IS DISTINCT FROM OLD.name THEN
    v_changes := v_changes || jsonb_build_object('field', 'name', 'old', OLD.name, 'new', NEW.name);
  END IF;
  IF NEW.slug IS DISTINCT FROM OLD.slug THEN
    v_changes := v_changes || jsonb_build_object('field', 'slug', 'old', OLD.slug, 'new', NEW.slug);
  END IF;
  IF jsonb_array_length(v_changes) > 0 THEN
    PERFORM public._audit(NEW.id, 'org_updated', NULL, jsonb_build_object('subject_name', NEW.name, 'changes', v_changes));
  END IF;
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS audit_organization ON public.organizations;
CREATE TRIGGER audit_organization AFTER INSERT OR UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.audit_organization();

-- ---------------------------------------------------------------------------
-- Member changes by someone else now also cover the manager (team) and set
-- subject_id. Unchanged otherwise.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.audit_profile_admin_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_actor   uuid := auth.uid();
  v_changes jsonb := '[]'::jsonb;
BEGIN
  IF v_actor IS NULL OR v_actor = NEW.id THEN RETURN NEW; END IF;
  IF COALESCE(current_setting('app.suppress_profile_audit', true), '') = 'on' THEN RETURN NEW; END IF;
  IF COALESCE(current_setting('app.role_sync', true), '') = 'on' THEN RETURN NEW; END IF;
  IF NEW.first_name IS DISTINCT FROM OLD.first_name OR NEW.last_name IS DISTINCT FROM OLD.last_name THEN
    v_changes := v_changes || jsonb_build_object('field', 'name',
      'old', NULLIF(btrim(concat_ws(' ', OLD.first_name, OLD.last_name)), ''),
      'new', NULLIF(btrim(concat_ws(' ', NEW.first_name, NEW.last_name)), ''));
  END IF;
  IF NEW.org_role_id IS DISTINCT FROM OLD.org_role_id OR NEW.role IS DISTINCT FROM OLD.role THEN
    v_changes := v_changes || jsonb_build_object('field', 'role',
      'old', COALESCE((SELECT name FROM public.org_roles WHERE id = OLD.org_role_id), OLD.role),
      'new', COALESCE((SELECT name FROM public.org_roles WHERE id = NEW.org_role_id), NEW.role));
  END IF;
  IF NEW.organization_id IS DISTINCT FROM OLD.organization_id THEN
    v_changes := v_changes || jsonb_build_object('field', 'organization',
      'old', (SELECT name FROM public.organizations WHERE id = OLD.organization_id),
      'new', (SELECT name FROM public.organizations WHERE id = NEW.organization_id));
  END IF;
  IF NEW.manager_id IS DISTINCT FROM OLD.manager_id THEN
    v_changes := v_changes || jsonb_build_object('field', 'manager',
      'old', public._display_name(OLD.manager_id), 'new', public._display_name(NEW.manager_id));
  END IF;
  IF jsonb_array_length(v_changes) = 0 THEN RETURN NEW; END IF;
  INSERT INTO public.shift_audit_log (organization_id, shift_id, actor_id, target_user_id, subject_id, action, details)
  VALUES (NEW.organization_id, NULL, v_actor, NEW.id, NEW.id, 'profile_updated',
          jsonb_build_object('actor_name', public._display_name(v_actor),
                             'target_name', public._display_name(NEW.id), 'changes', v_changes));
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- Entries written by older code (notify-style, target = recipient): derive who
-- they're about. Fan-out notices (one row per reviewer) are about the actor.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._audit_subject(p_action text, p_actor uuid, p_target uuid)
RETURNS uuid LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE
    WHEN p_action IN ('timeoff_requested', 'swap_requested') THEN p_actor
    WHEN p_action IN ('late_15', 'late_60') THEN NULL
    ELSE p_target
  END
$$;

CREATE OR REPLACE FUNCTION public.audit_fill_subject() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.subject_id IS NULL THEN
    NEW.subject_id := public._audit_subject(NEW.action, NEW.actor_id, NEW.target_user_id);
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS audit_fill_subject ON public.shift_audit_log;
CREATE TRIGGER audit_fill_subject BEFORE INSERT ON public.shift_audit_log
  FOR EACH ROW EXECUTE FUNCTION public.audit_fill_subject();

UPDATE public.shift_audit_log
   SET subject_id = public._audit_subject(action, actor_id, target_user_id)
 WHERE subject_id IS NULL;

-- ---------------------------------------------------------------------------
-- Member invited / removed / left — written by the Edge Functions (service
-- role, so auth.uid() is empty: the caller is passed in). Returns the entry id
-- so a function can take it back if the action then fails.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.log_member_event(p_org uuid, p_action text, p_actor uuid, p_subject uuid, p_details jsonb DEFAULT '{}'::jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  IF p_action NOT IN ('member_invited', 'member_removed', 'member_left') THEN RAISE EXCEPTION 'unknown member event'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.organizations WHERE id = p_org) THEN RETURN NULL; END IF;
  INSERT INTO public.shift_audit_log (organization_id, shift_id, actor_id, target_user_id, subject_id, action, details)
  VALUES (p_org, NULL, p_actor, NULL, p_subject, p_action,
          jsonb_strip_nulls(jsonb_build_object(
            'actor_name', COALESCE(public._display_name(p_actor), 'System'),
            'target_name', public._display_name(p_subject))) || COALESCE(p_details, '{}'::jsonb))
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.log_member_event(uuid, text, uuid, uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.log_member_event(uuid, text, uuid, uuid, jsonb) TO service_role;
