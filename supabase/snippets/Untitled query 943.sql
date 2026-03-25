UPDATE public.profiles
SET 
  role = 'Superadmin',
  organization_id = (SELECT id FROM public.organizations WHERE slug = 'hq-admin')
WHERE email = 'anuarkairulla@gmail.com';