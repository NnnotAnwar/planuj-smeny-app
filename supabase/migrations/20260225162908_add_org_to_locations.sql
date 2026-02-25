-- 1. Добавляем колонку organization_id в таблицу locations
ALTER TABLE public.locations 
ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id);

-- 2. Привязываем существующие локации к дефолтной организации
-- (Ищем ID организации по слагу 'default-org', который мы создали в прошлой миграции)
UPDATE public.locations
SET organization_id = (SELECT id FROM public.organizations WHERE slug = 'default-org')
WHERE organization_id IS NULL;

-- 3. Делаем колонку обязательной
ALTER TABLE public.locations 
ALTER COLUMN organization_id SET NOT NULL;

-- 4. Включаем защиту (RLS)
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;

-- Удаляем старые дырявые политики, если были
DROP POLICY IF EXISTS "Public locations" ON public.locations;

-- 5. Создаем политику: "Вижу только локации МОЕЙ организации"
CREATE POLICY "View org locations only" ON public.locations
FOR SELECT USING (
  organization_id = (
    SELECT organization_id FROM public.profiles WHERE id = auth.uid()
  )
);