-- =============================================================================
-- FIX: creating an organization failed ("ON CONFLICT does not support
-- deferrable unique constraints"). The role-hierarchy migration made
-- (organization_id, sort) a DEFERRABLE unique constraint, and the preset seed
-- still used a bare ON CONFLICT DO NOTHING — so owner sign-up and a Superadmin
-- creating an organization both broke. Found by supabase/tests/rls_smoke.sql.
--
-- Seed only the presets the organization doesn't have yet, and do it as an
-- internal sync: no permission check, no "role created" noise in a brand-new
-- organization's activity log.
-- =============================================================================
CREATE OR REPLACE FUNCTION public._seed_org_roles(p_org uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_id uuid;
  a text;
  all_areas text[] := ARRAY['rota', 'timesheets', 'requests', 'announcements', 'members', 'wages', 'locations', 'activity', 'roles'];
  v_prev text := current_setting('app.role_sync', true);
BEGIN
  PERFORM set_config('app.role_sync', 'on', true);

  INSERT INTO public.org_roles (organization_id, name, color, base_role, preset_key, sort)
  SELECT p_org, v.name, v.color, v.base_role, v.preset_key, v.sort
  FROM (VALUES
    ('Employee',   '#22c55e', 'Employee',   'employee',   0::smallint),
    ('Supervisor', '#3b82f6', 'Supervisor', 'supervisor', 10::smallint),
    ('Manager',    '#eab308', 'Manager',    'manager',    20::smallint),
    ('Admin',      '#ef4444', 'Admin',      'admin',      30::smallint),
    ('Head Admin', '#f59e0b', 'Head Admin', 'head_admin', 40::smallint)
  ) AS v(name, color, base_role, preset_key, sort)
  WHERE NOT EXISTS (SELECT 1 FROM public.org_roles r WHERE r.organization_id = p_org AND r.preset_key = v.preset_key)
    AND NOT EXISTS (SELECT 1 FROM public.org_roles r WHERE r.organization_id = p_org AND r.sort = v.sort);

  SELECT id INTO v_id FROM public.org_roles WHERE organization_id = p_org AND preset_key = 'manager';
  IF v_id IS NOT NULL THEN
    FOREACH a IN ARRAY ARRAY['rota', 'timesheets', 'requests', 'members', 'announcements'] LOOP
      INSERT INTO public.org_role_permissions (role_id, area, can_read) VALUES (v_id, a, true) ON CONFLICT DO NOTHING;
    END LOOP;
  END IF;

  SELECT id INTO v_id FROM public.org_roles WHERE organization_id = p_org AND preset_key = 'admin';
  IF v_id IS NOT NULL THEN
    FOREACH a IN ARRAY ARRAY['rota', 'timesheets', 'requests', 'announcements', 'members', 'wages'] LOOP
      INSERT INTO public.org_role_permissions (role_id, area, can_read, can_write, can_delete) VALUES (v_id, a, true, true, true) ON CONFLICT DO NOTHING;
    END LOOP;
    INSERT INTO public.org_role_permissions (role_id, area, can_read) VALUES (v_id, 'locations', true), (v_id, 'activity', true) ON CONFLICT DO NOTHING;
  END IF;

  SELECT id INTO v_id FROM public.org_roles WHERE organization_id = p_org AND preset_key = 'head_admin';
  IF v_id IS NOT NULL THEN
    FOREACH a IN ARRAY all_areas LOOP
      INSERT INTO public.org_role_permissions (role_id, area, can_read, can_write, can_delete) VALUES (v_id, a, true, true, true) ON CONFLICT DO NOTHING;
    END LOOP;
  END IF;

  PERFORM set_config('app.role_sync', COALESCE(v_prev, 'off'), true);
END;
$$;

-- Internal syncs (the preset seed above) don't write role events.
CREATE OR REPLACE FUNCTION public._log_role(p_org uuid, p_action text, p_details jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR COALESCE(current_setting('app.role_sync', true), '') = 'on'
     OR NOT EXISTS (SELECT 1 FROM public.organizations WHERE id = p_org) THEN RETURN; END IF;
  INSERT INTO public.shift_audit_log (organization_id, shift_id, actor_id, target_user_id, action, details)
  VALUES (p_org, NULL, auth.uid(), NULL, p_action,
          jsonb_build_object('actor_name', COALESCE(public._display_name(auth.uid()), 'System')) || p_details);
END;
$$;
