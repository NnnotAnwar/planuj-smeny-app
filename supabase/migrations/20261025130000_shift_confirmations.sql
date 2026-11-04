-- =============================================================================
-- SHIFT CONFIRMATIONS (members acknowledge a published rota shift)  — v1.10
-- -----------------------------------------------------------------------------
-- A member taps "Got it" on a published scheduled shift; managers can see who
-- has / hasn't confirmed. Kept in its OWN table (not a column on
-- scheduled_shifts) so the rota schema is untouched. One confirmation per
-- scheduled shift (its assigned member), so scheduled_shift_id is the PK.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.shift_confirmations (
  scheduled_shift_id uuid PRIMARY KEY REFERENCES public.scheduled_shifts(id) ON DELETE CASCADE,
  user_id            uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  organization_id    uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  confirmed_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS shift_confirmations_user_idx ON public.shift_confirmations (user_id);
CREATE INDEX IF NOT EXISTS shift_confirmations_org_idx  ON public.shift_confirmations (organization_id);

ALTER TABLE public.shift_confirmations ENABLE ROW LEVEL SECURITY;

-- Read: the member themselves, or a manager (rank >= 20) in the same org.
DROP POLICY IF EXISTS "shift_conf_select" ON public.shift_confirmations;
CREATE POLICY "shift_conf_select" ON public.shift_confirmations FOR SELECT TO authenticated
  USING (
    is_superadmin()
    OR user_id = (SELECT auth.uid())
    OR (my_role_rank() >= 20 AND organization_id = get_my_org_id())
  );

-- Confirm: only the member the shift is assigned to, and only for a PUBLISHED
-- shift that is actually theirs. author of the row must be the caller.
DROP POLICY IF EXISTS "shift_conf_insert" ON public.shift_confirmations;
CREATE POLICY "shift_conf_insert" ON public.shift_confirmations FOR INSERT TO authenticated
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND organization_id = get_my_org_id()
    AND EXISTS (
      SELECT 1 FROM public.scheduled_shifts s
      WHERE s.id = scheduled_shift_id
        AND s.user_id = (SELECT auth.uid())
        AND s.published = true
    )
  );

-- Un-confirm: the member may withdraw their own confirmation.
DROP POLICY IF EXISTS "shift_conf_delete" ON public.shift_confirmations;
CREATE POLICY "shift_conf_delete" ON public.shift_confirmations FOR DELETE TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- Live updates so a manager's "who confirmed" view reacts instantly.
ALTER TABLE public.shift_confirmations REPLICA IDENTITY FULL;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'shift_confirmations'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.shift_confirmations;
  END IF;
END$$;

NOTIFY pgrst, 'reload schema';
