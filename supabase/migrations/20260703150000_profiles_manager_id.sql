-- =============================================================================
-- ASSIGN MEMBERS TO A MANAGER  (#92)
-- -----------------------------------------------------------------------------
-- Optional link from a member to their manager. Used by the rota: a manager
-- (rank 20) plans shifts only for their own people; admins (30+) see everyone.
-- =============================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS manager_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_manager_id ON public.profiles (manager_id);
