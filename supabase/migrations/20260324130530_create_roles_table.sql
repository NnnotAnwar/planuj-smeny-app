-- 1. Create roles table
CREATE TABLE IF NOT EXISTS public.roles (
    name text PRIMARY KEY,
    color text NOT NULL,
    description text
);

-- RLS
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Roles are viewable by authenticated users" 
ON public.roles FOR SELECT 
TO authenticated 
USING (true);

-- 2. Filling the data
INSERT INTO public.roles (name, color, description) VALUES
    ('Admin', '#ef4444', 'Full Access'),     -- red
    ('Manager', '#eab308', 'Shift Management'),         -- yellow
    ('Supervisor', '#3b82f6', 'Shift Control'),
    ('Employee', '#22c55e', 'Employee')          -- green
ON CONFLICT (name) DO UPDATE 
SET color = EXCLUDED.color, description = EXCLUDED.description;


-- 3. Data Migration: 
UPDATE public.profiles 
SET role = 'Employee' 
WHERE role = 'Waiter' OR role IS NULL;


-- 4. Change of table Profiles
ALTER TABLE public.profiles 
    ALTER COLUMN role SET DEFAULT 'Employee'::text;

ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_role_fkey 
    FOREIGN KEY (role) 
    REFERENCES public.roles(name) 
    ON UPDATE CASCADE;


-- 5. New Trigger 
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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
    'Employee',
    new.email,
    default_org_id 
  );
  RETURN new;
END;
$$;