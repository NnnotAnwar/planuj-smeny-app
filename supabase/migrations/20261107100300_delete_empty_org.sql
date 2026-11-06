-- =============================================================================
-- Delete an organization nobody is in (Superadmin)
-- -----------------------------------------------------------------------------
-- locations.organization_id has no ON DELETE action, so an org whose only
-- leftovers are (archived) locations couldn't be deleted. This RPC refuses an
-- org that still has members, then removes its locations (their rota/roster/
-- settings cascade; another org's history pointing at them is cleared) and the
-- organization itself (everything org-scoped cascades).
-- =============================================================================
CREATE OR REPLACE FUNCTION public.delete_organization(p_org uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.is_superadmin() THEN
    RAISE EXCEPTION 'Only a Superadmin can delete an organization.' USING ERRCODE = '42501';
  END IF;
  IF EXISTS (SELECT 1 FROM public.profiles WHERE organization_id = p_org) THEN
    RAISE EXCEPTION 'org_has_members' USING ERRCODE = 'check_violation';
  END IF;
  -- Worked shifts that only remember one of these locations as "moved from".
  UPDATE public.shifts SET previous_location_id = NULL
   WHERE previous_location_id IN (SELECT id FROM public.locations WHERE organization_id = p_org);
  DELETE FROM public.shifts WHERE organization_id = p_org;
  DELETE FROM public.locations WHERE organization_id = p_org;
  DELETE FROM public.organizations WHERE id = p_org;
END;
$$;
REVOKE ALL ON FUNCTION public.delete_organization(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_organization(uuid) TO authenticated;
