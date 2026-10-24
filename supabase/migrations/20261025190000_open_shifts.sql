-- =============================================================================
-- OPEN SHIFTS (post an unassigned shift; a member claims it)  — v1.10
-- -----------------------------------------------------------------------------
-- A manager posts a shift with no assignee; eligible members in the org can
-- claim it (first-come). Managers manage the posts; members may claim an
-- unclaimed one or release their own. Kept separate from scheduled_shifts so the
-- rota schema is untouched (a claimed open shift can later be promoted into the
-- rota by the planner — a follow-up task).
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.open_shifts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  location_id     uuid NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  role            text,
  starts_at       timestamptz NOT NULL,
  ends_at         timestamptz NOT NULL,
  note            text,
  created_by      uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  claimed_by      uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  claimed_at      timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT open_shifts_time_order CHECK (ends_at > starts_at)
);

CREATE INDEX IF NOT EXISTS open_shifts_org_idx       ON public.open_shifts (organization_id, starts_at);
CREATE INDEX IF NOT EXISTS open_shifts_claimed_idx   ON public.open_shifts (claimed_by);

ALTER TABLE public.open_shifts ENABLE ROW LEVEL SECURITY;

-- Read: anyone in the org.
DROP POLICY IF EXISTS "open_shifts_select" ON public.open_shifts;
CREATE POLICY "open_shifts_select" ON public.open_shifts FOR SELECT TO authenticated
  USING (is_superadmin() OR organization_id = get_my_org_id());

-- Create: managers, posting in their org as themselves.
DROP POLICY IF EXISTS "open_shifts_insert" ON public.open_shifts;
CREATE POLICY "open_shifts_insert" ON public.open_shifts FOR INSERT TO authenticated
  WITH CHECK (
    is_superadmin()
    OR (my_role_rank() >= 20 AND organization_id = get_my_org_id() AND created_by = (SELECT auth.uid()))
  );

-- Update: a manager (anything in their org), or a member claiming an unclaimed
-- post / releasing their own. The resulting row must stay unclaimed or claimed
-- by the caller (members can't claim on someone else's behalf).
DROP POLICY IF EXISTS "open_shifts_update" ON public.open_shifts;
CREATE POLICY "open_shifts_update" ON public.open_shifts FOR UPDATE TO authenticated
  USING (
    organization_id = get_my_org_id()
    AND (my_role_rank() >= 20 OR claimed_by IS NULL OR claimed_by = (SELECT auth.uid()))
  )
  WITH CHECK (
    organization_id = get_my_org_id()
    AND (my_role_rank() >= 20 OR claimed_by IS NULL OR claimed_by = (SELECT auth.uid()))
  );

-- Delete: managers only.
DROP POLICY IF EXISTS "open_shifts_delete" ON public.open_shifts;
CREATE POLICY "open_shifts_delete" ON public.open_shifts FOR DELETE TO authenticated
  USING (is_superadmin() OR (my_role_rank() >= 20 AND organization_id = get_my_org_id()));

ALTER TABLE public.open_shifts REPLICA IDENTITY FULL;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'open_shifts'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.open_shifts;
  END IF;
END$$;

NOTIFY pgrst, 'reload schema';
