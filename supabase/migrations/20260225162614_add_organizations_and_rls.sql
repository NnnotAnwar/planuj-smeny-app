-- 1. Создаем таблицу организаций
CREATE TABLE IF NOT EXISTS public.organizations (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  name TEXT NOT NULL,
  slug TEXT UNIQUE -- например 'my-restaurant' для красивых ссылок
);

-- 2. Включаем защиту (RLS) для организаций
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- Политика: "Я вижу организацию, если я в ней состою" (реализуем позже через связную таблицу, пока оставим доступ на чтение для авторизованных, чтобы не сломать)
CREATE POLICY "Organizations are viewable by auth users" 
ON public.organizations FOR SELECT TO authenticated USING (true);


-- 3. Создаем "Дефолтную организацию" (чтобы старые юзеры не зависли)
INSERT INTO public.organizations (name, slug)
VALUES ('My Default Restaurant', 'default-org')
ON CONFLICT DO NOTHING;


-- 4. Модифицируем таблицу PROFILES
-- Сначала добавляем колонку как NULL (необязательную)
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id);


-- 5. МИГРАЦИЯ ДАННЫХ: Привязываем ВСЕХ существующих юзеров к дефолтной организации
UPDATE public.profiles
SET organization_id = (SELECT id FROM public.organizations WHERE slug = 'default-org')
WHERE organization_id IS NULL;


-- 6. Теперь делаем колонку ОБЯЗАТЕЛЬНОЙ (NOT NULL)
ALTER TABLE public.profiles 
ALTER COLUMN organization_id SET NOT NULL;


-- 7. Обновляем функцию создания новых юзеров (handle_new_user)
-- Теперь новым юзерам тоже нужно выдавать организацию
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS trigger AS $$
DECLARE
  default_org_id uuid;
BEGIN
  -- Находим ID дефолтной организации
  SELECT id INTO default_org_id FROM public.organizations WHERE slug = 'default-org';

  INSERT INTO public.profiles (id, username, role, email, organization_id)
  VALUES (
    new.id, 
    new.raw_user_meta_data->>'username', 
    COALESCE(new.raw_user_meta_data->>'role', 'Waiter'),
    new.email,
    default_org_id -- <-- Автоматически присваиваем дефолтную организацию
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 8. Обновляем RLS (Защиту данных)
-- Удаляем старую политику "Видно всем"
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;

-- Создаем новую: Вижу только коллег из МОЕЙ организации
CREATE POLICY "View org members only" ON public.profiles
FOR SELECT USING (
  organization_id = (
    SELECT organization_id FROM public.profiles WHERE id = auth.uid()
  )
);