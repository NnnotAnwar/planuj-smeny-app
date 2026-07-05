-- =============================================================================
-- SCHEDULED SHIFTS (rota)  —  #92 phase 1
-- -----------------------------------------------------------------------------
-- Planned/future shifts a manager assigns to members, separate from the actual
-- worked `shifts`. Managers (rank >= 20) create/edit within their org; members
-- see their own upcoming schedule; Superadmin sees all. Consistent with the
-- consolidated RLS style (one policy per action, is_superadmin() folded in).
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.scheduled_shifts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  location_id     uuid REFERENCES public.locations(id) ON DELETE SET NULL,
  starts_at       timestamptz NOT NULL,
  ends_at         timestamptz NOT NULL,
  note            text,
  created_by      uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT scheduled_shifts_time_order CHECK (ends_at > starts_at)
);

CREATE INDEX IF NOT EXISTS scheduled_shifts_user_starts_idx ON public.scheduled_shifts (user_id, starts_at);
CREATE INDEX IF NOT EXISTS scheduled_shifts_org_starts_idx  ON public.scheduled_shifts (organization_id, starts_at);

ALTER TABLE public.scheduled_shifts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "scheduled_select" ON public.scheduled_shifts;
CREATE POLICY "scheduled_select" ON public.scheduled_shifts FOR SELECT TO authenticated
  USING (
    is_superadmin()
    OR user_id = (SELECT auth.uid())
    OR (my_role_rank() >= 20 AND organization_id = get_my_org_id())
  );

DROP POLICY IF EXISTS "scheduled_insert" ON public.scheduled_shifts;
CREATE POLICY "scheduled_insert" ON public.scheduled_shifts FOR INSERT TO authenticated
  WITH CHECK (is_superadmin() OR (my_role_rank() >= 20 AND organization_id = get_my_org_id()));

DROP POLICY IF EXISTS "scheduled_update" ON public.scheduled_shifts;
CREATE POLICY "scheduled_update" ON public.scheduled_shifts FOR UPDATE TO authenticated
  USING (is_superadmin() OR (my_role_rank() >= 20 AND organization_id = get_my_org_id()))
  WITH CHECK (is_superadmin() OR (my_role_rank() >= 20 AND organization_id = get_my_org_id()));

DROP POLICY IF EXISTS "scheduled_delete" ON public.scheduled_shifts;
CREATE POLICY "scheduled_delete" ON public.scheduled_shifts FOR DELETE TO authenticated
  USING (is_superadmin() OR (my_role_rank() >= 20 AND organization_id = get_my_org_id()));
