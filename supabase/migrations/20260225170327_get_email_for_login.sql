-- Функция для получения email по username (работает даже для анонимов)
CREATE OR REPLACE FUNCTION public.get_email_by_username(u_name text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER -- <--- Важно! Работает с правами админа, обходя RLS
SET search_path = public
AS $$
BEGIN
  RETURN (SELECT email FROM public.profiles WHERE username = u_name LIMIT 1);
END;
$$;

-- Разрешаем вызывать эту функцию всем (даже тем, кто не вошел)
GRANT EXECUTE ON FUNCTION public.get_email_by_username(text) TO anon;
GRANT EXECUTE ON FUNCTION public.get_email_by_username(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_email_by_username(text) TO service_role;