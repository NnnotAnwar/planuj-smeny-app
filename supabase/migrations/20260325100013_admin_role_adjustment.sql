ALTER TABLE public.roles
ADD COLUMN is_admin BOOLEAN NOT NULL DEFAULT False;

Update public.roles
set is_admin = true where name = 'Admin' or name = 'Superadmin' or name = 'Manager'