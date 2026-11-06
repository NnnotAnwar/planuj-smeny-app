-- =============================================================================
-- v1.10 RLS HARDENING (wages + open shifts)
-- -----------------------------------------------------------------------------
-- 1. member_wages: any manager in the org could set ANY rate — including their
--    own or a higher-ranked admin's. Pay is now an ADMIN matter (rank >= 30):
--    admins read/set rates only for people strictly below them in their own
--    org (never themselves); members read their own rate.
-- 2. open_shifts: the update policy let a member change an unclaimed post's
--    details (times, location…) while "claiming". A trigger now limits
--    non-managers to the claim columns only.
-- 3. shift_confirmations: a confirmation is final for the member — they can no
--    longer withdraw it; only a manager in the org can reset one.
-- 4. shift_templates: at most 8 per organization (they become buttons all over
--    the rota UI, so an unbounded list would crowd it out).
-- 5. Changing a shift's time, day, location or person clears its confirmation
--    — the member confirmed a different shift and must confirm again.
-- =============================================================================

-- True when `target` is in my organization and ranks strictly below me.
CREATE OR REPLACE FUNCTION public.is_my_subordinate(target uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.profiles p
      JOIN public.roles r ON r.name = p.role
     WHERE p.id = target
       AND p.id <> auth.uid()
       AND p.organization_id = public.get_my_org_id()
       AND r.rank < public.my_role_rank()
  );
$$;

REVOKE ALL ON FUNCTION public.is_my_subordinate(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_my_subordinate(uuid) FROM anon; -- Supabase grants anon by default
GRANT EXECUTE ON FUNCTION public.is_my_subordinate(uuid) TO authenticated;

DROP POLICY IF EXISTS "member_wages_select" ON public.member_wages;
CREATE POLICY "member_wages_select" ON public.member_wages FOR SELECT TO authenticated
  USING (
    is_superadmin()
    OR user_id = (SELECT auth.uid())
    OR (my_role_rank() >= 30 AND public.is_my_subordinate(user_id))
  );

DROP POLICY IF EXISTS "member_wages_write" ON public.member_wages;
CREATE POLICY "member_wages_write" ON public.member_wages FOR ALL TO authenticated
  USING (is_superadmin() OR (my_role_rank() >= 30 AND public.is_my_subordinate(user_id)))
  WITH CHECK (
    is_superadmin()
    OR (my_role_rank() >= 30 AND organization_id = get_my_org_id() AND public.is_my_subordinate(user_id))
  );

-- Members may only touch the claim columns of an open shift.
CREATE OR REPLACE FUNCTION public.open_shifts_guard_member_edits()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF is_superadmin() OR my_role_rank() >= 20 THEN
    RETURN NEW;
  END IF;
  IF (NEW.organization_id, NEW.location_id, NEW.role, NEW.starts_at, NEW.ends_at, NEW.note, NEW.created_by)
     IS DISTINCT FROM
     (OLD.organization_id, OLD.location_id, OLD.role, OLD.starts_at, OLD.ends_at, OLD.note, OLD.created_by) THEN
    RAISE EXCEPTION 'Only managers can change an open shift''s details' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS open_shifts_guard_member_edits ON public.open_shifts;
CREATE TRIGGER open_shifts_guard_member_edits
  BEFORE UPDATE ON public.open_shifts
  FOR EACH ROW EXECUTE FUNCTION public.open_shifts_guard_member_edits();

-- A member's confirmation is final; managers may reset it (e.g. after a change).
DROP POLICY IF EXISTS "shift_conf_delete" ON public.shift_confirmations;
CREATE POLICY "shift_conf_delete" ON public.shift_confirmations FOR DELETE TO authenticated
  USING (is_superadmin() OR (my_role_rank() >= 20 AND organization_id = get_my_org_id()));

-- At most 8 shift templates per organization.
CREATE OR REPLACE FUNCTION public.shift_templates_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF (SELECT count(*) FROM public.shift_templates WHERE organization_id = NEW.organization_id) >= 8 THEN
    RAISE EXCEPTION 'TEMPLATE_LIMIT' USING ERRCODE = 'P0001', HINT = 'An organization can keep at most 8 shift templates.';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.shift_templates_limit() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS shift_templates_limit ON public.shift_templates;
CREATE TRIGGER shift_templates_limit
  BEFORE INSERT ON public.shift_templates
  FOR EACH ROW EXECUTE FUNCTION public.shift_templates_limit();

-- A changed shift needs a fresh confirmation (a note edit doesn't count).
CREATE OR REPLACE FUNCTION public.reset_confirmation_on_shift_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF (NEW.starts_at, NEW.ends_at, NEW.all_day, NEW.location_id, NEW.user_id)
     IS DISTINCT FROM
     (OLD.starts_at, OLD.ends_at, OLD.all_day, OLD.location_id, OLD.user_id) THEN
    DELETE FROM public.shift_confirmations WHERE scheduled_shift_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.reset_confirmation_on_shift_change() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS reset_confirmation_on_shift_change ON public.scheduled_shifts;
CREATE TRIGGER reset_confirmation_on_shift_change
  AFTER UPDATE ON public.scheduled_shifts
  FOR EACH ROW EXECUTE FUNCTION public.reset_confirmation_on_shift_change();

NOTIFY pgrst, 'reload schema';
