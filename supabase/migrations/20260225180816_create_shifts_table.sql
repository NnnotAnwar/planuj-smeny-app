CREATE TABLE IF NOT EXISTS public.shifts (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  location_id uuid REFERENCES public.locations(id) NOT NULL,
  organization_id uuid REFERENCES public.organizations(id) NOT NULL,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL,
  ended_at TIMESTAMP WITH TIME ZONE, -- NULL, пока смена идет
  role TEXT NOT NULL
);

-- Включаем защиту
ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;

-- Политика: Вижу смены только своей организации
CREATE POLICY "View org shifts only" ON public.shifts
FOR SELECT USING (
  organization_id = get_my_org_id()
);

-- Политика: Могу создавать смену только для себя
CREATE POLICY "Insert own shifts" ON public.shifts
FOR INSERT WITH CHECK (
  auth.uid() = user_id AND 
  organization_id = get_my_org_id()
);

-- Политика: Могу обновлять (завершать) только свою смену
CREATE POLICY "Update own shifts" ON public.shifts
FOR UPDATE USING (
  auth.uid() = user_id
);