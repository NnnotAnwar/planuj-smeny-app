-- =============================================================================
-- MANAGER SELF-SERVICE TEAM  (#92)
-- -----------------------------------------------------------------------------
-- Managers can't edit other profiles (RLS reserves that for admins), so this
-- SECURITY DEFINER RPC lets a manager (rank >= 20) take a FREE lower-ranked
-- member of their organization into their team (manager_id = caller) and
-- release their own members. Nobody can poach someone who already has another
-- manager; superadmins can release anyone.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.claim_member(p_member uuid, p_claim boolean)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_caller_rank int := my_role_rank();
  v_target public.profiles%ROWTYPE;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not signed in.';
  END IF;
  IF v_caller_rank < 20 THEN
    RAISE EXCEPTION 'Only managers can manage a team.';
  END IF;
  IF p_member = v_caller THEN
    RAISE EXCEPTION 'You cannot manage yourself.';
  END IF;

  SELECT * INTO v_target FROM public.profiles WHERE id = p_member;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Member not found.';
  END IF;
  IF v_target.organization_id <> get_my_org_id() AND NOT is_superadmin() THEN
    RAISE EXCEPTION 'Member is not in your organization.';
  END IF;
  IF role_rank(v_target.role) >= v_caller_rank AND NOT is_superadmin() THEN
    RAISE EXCEPTION 'You can only manage members below your role.';
  END IF;

  IF p_claim THEN
    IF v_target.manager_id IS NOT NULL AND v_target.manager_id <> v_caller THEN
      RAISE EXCEPTION 'This member already has a manager.';
    END IF;
    UPDATE public.profiles SET manager_id = v_caller WHERE id = p_member;
  ELSE
    IF v_target.manager_id IS DISTINCT FROM v_caller AND NOT is_superadmin() THEN
      RAISE EXCEPTION 'This member is not on your team.';
    END IF;
    UPDATE public.profiles SET manager_id = NULL WHERE id = p_member;
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.claim_member(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_member(uuid, boolean) TO authenticated;
