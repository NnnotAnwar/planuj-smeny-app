-- =============================================================================
-- SHIFT TEMPLATES (reusable rota building blocks)  — v1.10
-- -----------------------------------------------------------------------------
-- A planner defines named templates ("Morning 7–15", "Close 15–23") once, then
-- applies them when building the rota instead of re-typing times. Org-scoped;
-- managers (rank >= 20) manage them, all members may read (the editor uses them).
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.shift_templates (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name            text NOT NULL CHECK (btrim(name) <> ''),
  role            text,
  start_time      time NOT NULL,
  end_time        time NOT NULL,
  color           text,
  created_by      uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS shift_templates_org_idx ON public.shift_templates (organization_id);

ALTER TABLE public.shift_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "shift_templates_select" ON public.shift_templates;
CREATE POLICY "shift_templates_select" ON public.shift_templates FOR SELECT TO authenticated
  USING (is_superadmin() OR organization_id = get_my_org_id());

DROP POLICY IF EXISTS "shift_templates_write" ON public.shift_templates;
CREATE POLICY "shift_templates_write" ON public.shift_templates FOR ALL TO authenticated
  USING (is_superadmin() OR (my_role_rank() >= 20 AND organization_id = get_my_org_id()))
  WITH CHECK (is_superadmin() OR (my_role_rank() >= 20 AND organization_id = get_my_org_id()));

NOTIFY pgrst, 'reload schema';
