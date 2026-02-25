ALTER TABLE public.shifts 
ADD COLUMN organization_id uuid REFERENCES public.organizations(id);