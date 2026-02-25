-- 1. Создаем функцию-"лазейку", которая узнает Организацию юзера без проверки прав
CREATE OR REPLACE FUNCTION public.get_my_org_id()
RETURNS uuid 
LANGUAGE plpgsql 
SECURITY DEFINER -- <--- Магия здесь: функция работает от имени админа
SET search_path = public 
AS $$
DECLARE
  org_id uuid;
BEGIN
  SELECT organization_id INTO org_id
  FROM public.profiles
  WHERE id = auth.uid();
  
  RETURN org_id;
END;
$$;

-- 2. Удаляем старую (глючную) политику
DROP POLICY IF EXISTS "View org members only" ON public.profiles;

-- 3. Создаем новую политику, использующую нашу функцию
CREATE POLICY "View org members only" ON public.profiles
FOR SELECT USING (
  -- Теперь мы сравниваем org_id напрямую с результатом функции
  organization_id = get_my_org_id()
);