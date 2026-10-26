-- =============================================================================
-- ANNOUNCEMENT READ-RECEIPTS  — v1.10
-- -----------------------------------------------------------------------------
-- A member marks an announcement as read; managers can see reach (who read it).
-- One row per (announcement, member). Depends on the announcements table.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.announcement_reads (
  announcement_id uuid NOT NULL REFERENCES public.announcements(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  read_at         timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (announcement_id, user_id)
);

CREATE INDEX IF NOT EXISTS announcement_reads_user_idx ON public.announcement_reads (user_id);
CREATE INDEX IF NOT EXISTS announcement_reads_org_idx  ON public.announcement_reads (organization_id);

ALTER TABLE public.announcement_reads ENABLE ROW LEVEL SECURITY;

-- Read: the member themselves, or a manager (rank >= 20) in the org (reach view).
DROP POLICY IF EXISTS "ann_reads_select" ON public.announcement_reads;
CREATE POLICY "ann_reads_select" ON public.announcement_reads FOR SELECT TO authenticated
  USING (
    is_superadmin()
    OR user_id = (SELECT auth.uid())
    OR (my_role_rank() >= 20 AND organization_id = get_my_org_id())
  );

-- Mark read: only for yourself, in your org.
DROP POLICY IF EXISTS "ann_reads_insert" ON public.announcement_reads;
CREATE POLICY "ann_reads_insert" ON public.announcement_reads FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()) AND organization_id = get_my_org_id());

-- Un-mark: your own.
DROP POLICY IF EXISTS "ann_reads_delete" ON public.announcement_reads;
CREATE POLICY "ann_reads_delete" ON public.announcement_reads FOR DELETE TO authenticated
  USING (user_id = (SELECT auth.uid()));

NOTIFY pgrst, 'reload schema';
