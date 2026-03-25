CREATE OR REPLACE FUNCTION public.is_superadmin() 
RETURNS boolean
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_role text;
BEGIN
  SELECT role INTO user_role FROM public.profiles WHERE id = auth.uid();
  RETURN user_role = 'Superadmin';
END;
$$;

CREATE POLICY "Superadmin full access to organizations" 
ON public.organizations FOR ALL TO authenticated 
USING (public.is_superadmin());

CREATE POLICY "Superadmin full access to profiles" 
ON public.profiles FOR ALL TO authenticated 
USING (public.is_superadmin());

CREATE POLICY "Superadmin full access to shifts" 
ON public.shifts FOR ALL TO authenticated 
USING (public.is_superadmin());

CREATE POLICY "Superadmin full access to locations" 
ON public.locations FOR ALL TO authenticated 
USING (public.is_superadmin());