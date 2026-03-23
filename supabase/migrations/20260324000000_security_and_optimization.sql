
-- 1. Fix broken 'Login with Username' by re-granting access to unauthenticated users
-- We keep the SECURITY DEFINER and search_path set for safety.
GRANT EXECUTE ON FUNCTION "public"."get_email_by_username"("text") TO "anon";
GRANT EXECUTE ON FUNCTION "public"."get_email_by_username"("text") TO "authenticated";

-- 2. Harden 'handle_new_user' trigger
-- Ensure we don't crash if metadata is missing, and provide a fallback username.
CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  default_org_id uuid;
  v_username text;
BEGIN
  -- Get the default organization ID.
  SELECT id INTO default_org_id FROM public.organizations WHERE slug = 'default-org';
  
  IF default_org_id IS NULL THEN
    RAISE EXCEPTION 'Default organization "default-org" not found. Please seed your database.';
  END IF;

  -- Fallback logic for username: metadata -> email prefix -> 'user_' + random
  v_username := COALESCE(
    new.raw_user_meta_data->>'username', 
    split_part(new.email, '@', 1),
    'user_' || substr(md5(random()::text), 1, 8)
  );

  INSERT INTO public.profiles (id, username, role, email, organization_id)
  VALUES (
    new.id, 
    v_username, 
    'Waiter',
    new.email,
    default_org_id 
  );
  RETURN new;
END;
$$;

-- 3. Optimize RLS Policies
-- Using subqueries in USING clauses can be slow. We'll simplify where possible.
-- For 'profiles', we already have a direct check for the organization member view.

DROP POLICY IF EXISTS "Shifts are viewable by organization" ON "public"."shifts";
CREATE POLICY "Shifts are viewable by organization" ON "public"."shifts" 
FOR SELECT TO "authenticated" 
USING (
  organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
);

-- Optimization: Add indexes to support these RLS lookups if they don't exist
CREATE INDEX IF NOT EXISTS idx_profiles_organization_id ON public.profiles(organization_id);
CREATE INDEX IF NOT EXISTS idx_shifts_organization_id ON public.shifts(organization_id);
CREATE INDEX IF NOT EXISTS idx_shifts_user_id ON public.shifts(user_id);
