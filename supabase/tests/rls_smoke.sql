-- =============================================================================
-- RLS SMOKE TEST — organization isolation + the request rules.
-- Read-only in effect: everything runs in one transaction that is rolled back.
-- Run against preprod (never prod data you can't lose):
--   • Supabase SQL editor / MCP execute_sql: paste the whole file.
--   • psql "$PREPROD_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/rls_smoke.sql
-- It picks two real organizations (or makes a throw-away second one); any broken rule raises
-- "RLS FAIL: …". Success ends with "RLS SMOKE OK".
-- =============================================================================
BEGIN;

DO $$
DECLARE
  org_a uuid; org_b uuid;
  emp_a uuid; emp_b uuid; head_a uuid;
  n int;
  fails text := '';
  req uuid;
BEGIN
  -- Two organizations that both have an ordinary member.
  SELECT p.organization_id INTO org_a FROM public.profiles p
   WHERE p.role <> 'Superadmin' AND public.profile_rank(p.id) < 40
   GROUP BY 1 ORDER BY count(*) DESC LIMIT 1;
  SELECT p.organization_id INTO org_b FROM public.profiles p
   WHERE p.organization_id <> org_a AND p.role <> 'Superadmin'
   GROUP BY 1 ORDER BY count(*) DESC LIMIT 1;
  IF org_a IS NULL THEN RAISE EXCEPTION 'RLS SKIP: need an organization with members'; END IF;
  -- Only one real organization? Make a throw-away second one (rolled back):
  -- the org, a location and its seeded roles are enough to test isolation.
  IF org_b IS NULL THEN
    INSERT INTO public.organizations (name, slug) VALUES ('RLS smoke B', 'rls-smoke-b-' || substr(md5(random()::text), 1, 8))
    RETURNING id INTO org_b;
    INSERT INTO public.locations (organization_id, name) VALUES (org_b, 'Smoke location');
  END IF;

  SELECT id INTO emp_a FROM public.profiles WHERE organization_id = org_a AND role <> 'Superadmin' AND public.profile_rank(id) < 40 LIMIT 1;
  SELECT id INTO emp_b FROM public.profiles WHERE organization_id = org_b AND role <> 'Superadmin' LIMIT 1;
  SELECT id INTO head_a FROM public.profiles WHERE organization_id = org_a AND public.profile_rank(id) >= 40 AND role <> 'Superadmin' LIMIT 1;

  PERFORM set_config('role', 'authenticated', true);

  -- ---- As an ordinary member of A -----------------------------------------
  PERFORM set_config('request.jwt.claims', json_build_object('sub', emp_a, 'role', 'authenticated')::text, true);

  SELECT count(*) INTO n FROM public.profiles WHERE organization_id = org_b;
  IF n > 0 THEN fails := fails || ' profiles(B visible)'; END IF;
  SELECT count(*) INTO n FROM public.shifts WHERE organization_id = org_b;
  IF n > 0 THEN fails := fails || ' shifts(B visible)'; END IF;
  SELECT count(*) INTO n FROM public.scheduled_shifts WHERE organization_id = org_b;
  IF n > 0 THEN fails := fails || ' scheduled_shifts(B visible)'; END IF;
  SELECT count(*) INTO n FROM public.time_off WHERE organization_id = org_b;
  IF n > 0 THEN fails := fails || ' time_off(B visible)'; END IF;
  SELECT count(*) INTO n FROM public.locations WHERE organization_id = org_b;
  IF n > 0 THEN fails := fails || ' locations(B visible)'; END IF;
  SELECT count(*) INTO n FROM public.org_roles WHERE organization_id = org_b;
  IF n > 0 THEN fails := fails || ' org_roles(B visible)'; END IF;
  SELECT count(*) INTO n FROM public.shift_audit_log WHERE organization_id = org_b;
  IF n > 0 THEN fails := fails || ' audit(B visible)'; END IF;
  SELECT count(*) INTO n FROM public.list_member_requests() WHERE organization_id = org_b;
  IF n > 0 THEN fails := fails || ' member_requests(B visible)'; END IF;

  -- Writes into B are refused (or touch nothing).
  UPDATE public.profiles SET first_name = 'pwned' WHERE id = emp_b;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n > 0 THEN fails := fails || ' profiles(B writable)'; END IF;
  BEGIN
    INSERT INTO public.org_roles (organization_id, name, color, base_role) VALUES (org_b, 'x', '#000', 'Employee');
    fails := fails || ' org_roles(B insertable)';
  EXCEPTION WHEN insufficient_privilege OR check_violation OR others THEN NULL; END;

  -- A member can't promote themself.
  BEGIN
    UPDATE public.profiles SET org_role_id = (SELECT id FROM public.org_roles WHERE organization_id = org_a AND sort = 40)
     WHERE id = emp_a;
    GET DIAGNOSTICS n = ROW_COUNT;
    IF n > 0 THEN fails := fails || ' self-promotion'; END IF;
  EXCEPTION WHEN others THEN NULL; END;

  -- Four eyes: nobody approves their own request.
  req := public.submit_member_request('other', 'RLS smoke', 'rolled back');
  BEGIN
    PERFORM public.review_member_request(req, true, NULL);
    fails := fails || ' self-approval(member)';
  EXCEPTION WHEN others THEN NULL; END;

  -- ---- As the Head Admin of A --------------------------------------------
  IF head_a IS NOT NULL THEN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', head_a, 'role', 'authenticated')::text, true);
    SELECT count(*) INTO n FROM public.profiles WHERE organization_id = org_b;
    IF n > 0 THEN fails := fails || ' head:profiles(B visible)'; END IF;
    UPDATE public.locations SET name = name WHERE organization_id = org_b;
    GET DIAGNOSTICS n = ROW_COUNT;
    IF n > 0 THEN fails := fails || ' head:locations(B writable)'; END IF;
    req := public.submit_member_request('other', 'RLS smoke (head)', 'rolled back');
    BEGIN
      PERFORM public.review_member_request(req, true, NULL);
      fails := fails || ' self-approval(head)';
    EXCEPTION WHEN others THEN NULL; END;
  END IF;

  -- ---- Anonymous visitor -------------------------------------------------
  PERFORM set_config('role', 'anon', true);
  PERFORM set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  SELECT count(*) INTO n FROM public.profiles;
  IF n > 0 THEN fails := fails || ' anon:profiles'; END IF;
  SELECT count(*) INTO n FROM public.shifts;
  IF n > 0 THEN fails := fails || ' anon:shifts'; END IF;

  PERFORM set_config('role', 'postgres', true);
  IF fails <> '' THEN RAISE EXCEPTION 'RLS FAIL:%', fails; END IF;
  RAISE NOTICE 'RLS SMOKE OK';
END $$;

ROLLBACK;
