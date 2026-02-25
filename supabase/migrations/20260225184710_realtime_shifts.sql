-- 1. Добавляем таблицу shifts в список публикации для Realtime
alter publication supabase_realtime add table public.shifts;

-- 2. (Опционально) Если ты хочешь, чтобы Realtime присылал не только ID, 
-- но и старые значения при обновлении (полезно для отслеживания завершения смен)
alter table public.shifts replica identity full;