INSERT INTO public.roles (name, color, description) 
VALUES ('Superadmin', '#9333ea', 'Full Access')
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.organizations (name, slug) 
VALUES ('Planuj Smeny Admin', 'hq-admin')
ON CONFLICT (slug) DO NOTHING;