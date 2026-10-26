-- =============================================================================
-- ANNOUNCEMENTS (team / location notices)  — v1.10
-- -----------------------------------------------------------------------------
-- Managers (rank >= 20) post a short notice to their whole organization or to a
-- single location; every member of that org can read it. Mirrors the RLS shape
-- of time_off: org-scoped reads for members, manager-only writes. The author FK
-- is SET NULL so a notice survives the author leaving; location_id NULL means
-- the notice targets the whole organization.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.announcements (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  location_id     uuid REFERENCES public.locations(id) ON DELETE CASCADE,  -- NULL = whole org
  author_id       uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  title           text NOT NULL CHECK (btrim(title) <> ''),
  body            text NOT NULL CHECK (btrim(body) <> ''),
  pinned          boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS announcements_org_idx      ON public.announcements (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS announcements_location_idx ON public.announcements (location_id);
CREATE INDEX IF NOT EXISTS announcements_author_idx   ON public.announcements (author_id);

ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

-- Read: superadmin, or anyone in the announcement's organization.
DROP POLICY IF EXISTS "announcements_select" ON public.announcements;
CREATE POLICY "announcements_select" ON public.announcements FOR SELECT TO authenticated
  USING (
    is_superadmin()
    OR organization_id = get_my_org_id()
  );

-- Create: managers (rank >= 20) posting as themselves, in their own org.
DROP POLICY IF EXISTS "announcements_insert" ON public.announcements;
CREATE POLICY "announcements_insert" ON public.announcements FOR INSERT TO authenticated
  WITH CHECK (
    is_superadmin()
    OR (my_role_rank() >= 20 AND organization_id = get_my_org_id() AND author_id = (SELECT auth.uid()))
  );

-- Edit: managers in the same org.
DROP POLICY IF EXISTS "announcements_update" ON public.announcements;
CREATE POLICY "announcements_update" ON public.announcements FOR UPDATE TO authenticated
  USING (is_superadmin() OR (my_role_rank() >= 20 AND organization_id = get_my_org_id()))
  WITH CHECK (is_superadmin() OR (my_role_rank() >= 20 AND organization_id = get_my_org_id()));

-- Delete: managers in the same org.
DROP POLICY IF EXISTS "announcements_delete" ON public.announcements;
CREATE POLICY "announcements_delete" ON public.announcements FOR DELETE TO authenticated
  USING (is_superadmin() OR (my_role_rank() >= 20 AND organization_id = get_my_org_id()));

-- Live updates for the in-app list. REPLICA IDENTITY FULL so filtered DELETE
-- events still carry the old row (same reason as the locations table).
ALTER TABLE public.announcements REPLICA IDENTITY FULL;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'announcements'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.announcements;
  END IF;
END$$;

-- Keep updated_at honest on edits.
CREATE OR REPLACE FUNCTION public.announcements_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS announcements_set_updated_at ON public.announcements;
CREATE TRIGGER announcements_set_updated_at
  BEFORE UPDATE ON public.announcements
  FOR EACH ROW EXECUTE FUNCTION public.announcements_touch_updated_at();

NOTIFY pgrst, 'reload schema';
