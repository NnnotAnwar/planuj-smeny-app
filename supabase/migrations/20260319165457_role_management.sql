-- Fix 1: Restrict 'get_email_by_username' to authenticated users only to prevent public email enumeration.
REVOKE ALL ON FUNCTION "public"."get_email_by_username"("text") FROM "anon";

-- Fix 2: Harden 'handle_new_user' to prevent role injection from metadata.
-- New users are always assigned the 'Waiter' role by default.
CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  default_org_id uuid;
BEGIN
  -- Get the default organization ID.
  SELECT id INTO default_org_id FROM public.organizations WHERE slug = 'default-org';

  -- Ensure we have a default org to avoid failures.
  IF default_org_id IS NULL THEN
    RAISE EXCEPTION 'Default organization "default-org" not found.';
  END IF;

  INSERT INTO public.profiles (id, username, role, email, organization_id)
  VALUES (
    new.id, 
    new.raw_user_meta_data->>'username', 
    'Waiter', -- Hardcoded to prevent role injection via registration metadata
    new.email,
    default_org_id 
  );
  RETURN new;
END;
$$;

-- Fix 3: Allow users to update their own profile (names, etc.)
-- This was missing in the original schema, preventing users from setting their names via API.
CREATE POLICY "Users can update own profile" ON "public"."profiles" 
FOR UPDATE TO "authenticated" 
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Fix 4: Strengthen data integrity on 'shifts' table.
-- Ensure organization_id is always present for multi-tenancy isolation.
ALTER TABLE "public"."shifts" ALTER COLUMN "organization_id" SET NOT NULL;
