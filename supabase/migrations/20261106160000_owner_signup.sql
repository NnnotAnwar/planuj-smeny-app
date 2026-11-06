-- =============================================================================
-- OWNER SIGN-UP + provisioning hardening (issue #125)
-- -----------------------------------------------------------------------------
-- SECURITY: handle_new_user used to take organization_id and role straight from
-- raw_user_meta_data — which ANY caller of the public sign-up API controls.
-- With sign-ups enabled, `auth.signUp({ data: { role: 'Superadmin', ... } })`
-- would have created a Superadmin (or joined someone else's organization).
--
-- Now:
--   • Trusted path — the account was created by our server (an invite:
--     invited_at is set by the admin API; or app metadata, which only the
--     service role can write, names the organization). Metadata is honoured
--     as before (the invite-employee function validates role + org).
--   • Self sign-up — always a NEW organization, the user becomes its Head
--     Admin. Role / organization metadata from the client is ignored. A
--     sign-up without an organization name is rejected.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_trusted  boolean := new.invited_at IS NOT NULL OR (new.raw_app_meta_data ? 'organization_id');
  v_org_id   uuid;
  v_org_name text;
  v_slug     text;
  v_role     text;
  v_base     text;
  v_username text;
  v_suffix   int := 0;
BEGIN
  IF v_trusted THEN
    v_org_id := COALESCE(
      NULLIF(new.raw_app_meta_data->>'organization_id', '')::uuid,
      NULLIF(new.raw_user_meta_data->>'organization_id', '')::uuid
    );
    IF v_org_id IS NULL THEN
      SELECT id INTO v_org_id FROM public.organizations WHERE slug = 'default-org';
    END IF;
    IF v_org_id IS NULL THEN
      RAISE EXCEPTION 'No organization for new user: provide organization_id metadata or seed a "default-org".';
    END IF;
    v_role := COALESCE(
      NULLIF(new.raw_app_meta_data->>'role', ''),
      NULLIF(new.raw_user_meta_data->>'role', ''),
      'Employee'
    );
  ELSE
    -- Self sign-up → owner of a brand-new organization.
    v_org_name := left(btrim(COALESCE(new.raw_user_meta_data->>'organization_name', '')), 80);
    IF v_org_name = '' THEN
      RAISE EXCEPTION 'Sign-up needs an organization name.' USING ERRCODE = 'check_violation';
    END IF;
    v_slug := trim(BOTH '-' FROM regexp_replace(translate(lower(v_org_name), 'áäčďéěëíňóöřšťúůüýž', 'aacdeeeinoorstuuuyz'), '[^a-z0-9]+', '-', 'g'));
    v_slug := left(COALESCE(NULLIF(v_slug, ''), 'org'), 40) || '-' || substr(md5(random()::text || new.id::text), 1, 6);
    INSERT INTO public.organizations (name, slug) VALUES (v_org_name, v_slug) RETURNING id INTO v_org_id;
    v_role := 'Head Admin';
  END IF;

  v_base := CASE WHEN v_trusted THEN
      -- Invites: unchanged behaviour (the invite may carry a chosen username).
      COALESCE(NULLIF(new.raw_user_meta_data->>'username', ''), NULLIF(split_part(new.email, '@', 1), ''), 'user_' || substr(md5(random()::text), 1, 8))
    ELSE
      -- Self sign-up: a clean handle from the email (they can change it later).
      COALESCE(NULLIF(regexp_replace(lower(split_part(new.email, '@', 1)), '[^a-z0-9._]+', '', 'g'), ''), 'user_' || substr(md5(random()::text), 1, 8))
  END;
  v_username := v_base;
  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE username = v_username) LOOP
    v_suffix := v_suffix + 1;
    v_username := v_base || v_suffix;
  END LOOP;

  INSERT INTO public.profiles (id, username, role, email, organization_id, first_name, last_name)
  VALUES (
    new.id,
    v_username,
    v_role,
    new.email,
    v_org_id,
    NULLIF(left(btrim(new.raw_user_meta_data->>'first_name'), 60), ''),
    NULLIF(left(btrim(new.raw_user_meta_data->>'last_name'), 60), '')
  );

  RETURN new;
END;
$function$;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
