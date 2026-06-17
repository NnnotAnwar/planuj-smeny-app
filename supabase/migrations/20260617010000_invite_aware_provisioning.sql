-- =============================================================================
-- INVITE-AWARE USER PROVISIONING
-- -----------------------------------------------------------------------------
-- New users are created via the `invite-employee` Edge Function, which sets the
-- target organization + role (and optional names) as user metadata. This makes
-- the handle_new_user trigger honor that metadata so the profile lands in the
-- right organization with the right role in a single, atomic step.
--
-- Falls back to the default organization + 'Employee' for any other signup path
-- (keeping previous behaviour). Metadata is set server-side by the Edge Function
-- (service_role), never by the client, so it is trusted.
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
  v_username text;
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

  -- Username fallback chain: metadata -> email prefix -> random.
  v_username := COALESCE(
    NULLIF(new.raw_user_meta_data->>'username', ''),
    split_part(new.email, '@', 1),
    'user_' || substr(md5(random()::text), 1, 8)
  );

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
