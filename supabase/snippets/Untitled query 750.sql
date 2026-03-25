SELECT EXISTS (
  SELECT 1
  FROM pg_proc
  WHERE proname = 'is_superadmin'
);