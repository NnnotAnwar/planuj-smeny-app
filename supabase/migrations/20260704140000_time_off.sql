-- =============================================================================
-- TIME OFF (vacation / sick days / other leave)  (#92)
-- -----------------------------------------------------------------------------
-- Members request date-range leave; managers (rank >= 20) approve or decline.
-- Approved leave blocks rota planning for those days (enforced in the app:
-- busy-lock in the day editor, quick-fill skips, grid shows a leave marker).
-- Managers can also enter leave for their people directly (pre-approved).
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.time_off (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  kind            text NOT NULL CHECK (kind IN ('vacation', 'sick', 'other')),
  starts_on       date NOT NULL,
  ends_on         date NOT NULL,
  note            text,
  status          text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'declined')),
  reviewed_by     uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT time_off_date_order CHECK (ends_on >= starts_on)
);

CREATE INDEX IF NOT EXISTS time_off_user_idx ON public.time_off (user_id, starts_on);
CREATE INDEX IF NOT EXISTS time_off_org_idx  ON public.time_off (organization_id, starts_on);

ALTER TABLE public.time_off ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "timeoff_select" ON public.time_off;
CREATE POLICY "timeoff_select" ON public.time_off FOR SELECT TO authenticated
  USING (
    is_superadmin()
    OR user_id = (SELECT auth.uid())
    OR (my_role_rank() >= 20 AND organization_id = get_my_org_id())
  );

-- Members file their own (pending); managers may enter leave for their org.
DROP POLICY IF EXISTS "timeoff_insert" ON public.time_off;
CREATE POLICY "timeoff_insert" ON public.time_off FOR INSERT TO authenticated
  WITH CHECK (
    is_superadmin()
    OR (user_id = (SELECT auth.uid()) AND organization_id = get_my_org_id())
    OR (my_role_rank() >= 20 AND organization_id = get_my_org_id())
  );

-- Review (approve/decline) is a manager action.
DROP POLICY IF EXISTS "timeoff_update" ON public.time_off;
CREATE POLICY "timeoff_update" ON public.time_off FOR UPDATE TO authenticated
  USING (is_superadmin() OR (my_role_rank() >= 20 AND organization_id = get_my_org_id()))
  WITH CHECK (is_superadmin() OR (my_role_rank() >= 20 AND organization_id = get_my_org_id()));

-- Members may withdraw their own pending request; managers may delete any.
DROP POLICY IF EXISTS "timeoff_delete" ON public.time_off;
CREATE POLICY "timeoff_delete" ON public.time_off FOR DELETE TO authenticated
  USING (
    is_superadmin()
    OR (user_id = (SELECT auth.uid()) AND status = 'pending')
    OR (my_role_rank() >= 20 AND organization_id = get_my_org_id())
  );
