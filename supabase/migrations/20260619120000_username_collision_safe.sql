-- =============================================================================
-- COLLISION-SAFE USERNAME GENERATION
-- -----------------------------------------------------------------------------
-- Email prefixes collide: jondow@gmail.com, jondow@yahoo.com, jondow@example.com
-- all resolve to "jondow". Since profiles.username is UNIQUE (unique_username),
-- the second such invite previously failed inside handle_new_user on the unique
-- violation — blocking the invite entirely.
--
-- Append a numeric suffix until the name is free (jondow, jondow1, jondow2, …).
-- Invitees can still pick a nicer username afterwards on the accept-invite page.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_org_id uuid;
  v_role text;
  v_base text;
  v_username text;
  v_suffix int := 0;
BEGIN
  -- Organization: prefer invite metadata, else the seeded default organization.
  v_org_id := NULLIF(new.raw_user_meta_data->>'organization_id', '')::uuid;
  IF v_org_id IS NULL THEN
    SELECT id INTO v_org_id FROM public.organizations WHERE slug = 'default-org';
  END IF;
  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'No organization for new user: provide organization_id metadata or seed a "default-org".';
  END IF;

  -- Role: prefer invite metadata, else Employee. (FK to roles enforces validity.)
  v_role := COALESCE(NULLIF(new.raw_user_meta_data->>'role', ''), 'Employee');

  -- Base username: invite metadata -> email prefix -> random.
  v_base := COALESCE(
    NULLIF(new.raw_user_meta_data->>'username', ''),
    NULLIF(split_part(new.email, '@', 1), ''),
    'user_' || substr(md5(random()::text), 1, 8)
  );

  -- Ensure uniqueness so a duplicate prefix never blocks provisioning.
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
    NULLIF(new.raw_user_meta_data->>'first_name', ''),
    NULLIF(new.raw_user_meta_data->>'last_name', '')
  );

  RETURN new;
END;
$$;
