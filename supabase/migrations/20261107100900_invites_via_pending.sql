-- =============================================================================
-- FIX: an invited member became Head Admin of a NEW organization.
-- Supabase inserts the invited auth.users row first and sets invited_at in a
-- separate UPDATE a moment later, so handle_new_user saw invited_at = NULL and
-- treated the invite as an owner's self sign-up.
--
-- Now the invite-employee Edge Function (service role) records the invite in
-- public.pending_invites BEFORE calling inviteUserByEmail. handle_new_user
-- trusts ONLY that record (or server-set app metadata): it takes the
-- organization and role from it — never from client-supplied user metadata —
-- and deletes it. No record → a self sign-up (new organization, Head Admin).
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.pending_invites (
  email           text PRIMARY KEY CHECK (email = lower(btrim(email))),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  role            text NOT NULL REFERENCES public.roles(name),
  org_role_id     uuid REFERENCES public.org_roles(id) ON DELETE SET NULL,
  created_by      uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.pending_invites ENABLE ROW LEVEL SECURITY;  -- no policies: service role only
REVOKE ALL ON public.pending_invites FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pending_invites TO service_role;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_invite   public.pending_invites;
  v_trusted  boolean := false;
  v_org_id   uuid;
  v_org_role uuid;
  v_org_name text;
  v_slug     text;
  v_role     text;
  v_base     text;
  v_username text;
  v_suffix   int := 0;
BEGIN
  SELECT * INTO v_invite FROM public.pending_invites WHERE email = lower(btrim(new.email));
  IF FOUND THEN
    -- An invite recorded by the server.
    v_trusted  := true;
    v_org_id   := v_invite.organization_id;
    v_role     := v_invite.role;
    v_org_role := v_invite.org_role_id;
    DELETE FROM public.pending_invites WHERE email = v_invite.email;
  ELSIF new.raw_app_meta_data ? 'organization_id' THEN
    -- Server-set app metadata (admin API).
    v_trusted  := true;
    v_org_id   := NULLIF(new.raw_app_meta_data->>'organization_id', '')::uuid;
    v_role     := COALESCE(NULLIF(new.raw_app_meta_data->>'role', ''), 'Employee');
    v_org_role := NULLIF(new.raw_app_meta_data->>'org_role_id', '')::uuid;
  END IF;

  IF NOT v_trusted THEN
    -- Self sign-up → owner of a brand-new organization.
    v_org_name := left(btrim(COALESCE(new.raw_user_meta_data->>'organization_name', '')), 80);
    IF v_org_name = '' THEN
      RAISE EXCEPTION 'Sign-up needs an organization name.' USING ERRCODE = 'check_violation';
    END IF;
    v_slug := trim(BOTH '-' FROM regexp_replace(translate(lower(v_org_name), 'áäčďéěëíňóöřšťúůüýž', 'aacdeeeinoorstuuuyz'), '[^a-z0-9]+', '-', 'g'));
    v_slug := left(COALESCE(NULLIF(v_slug, ''), 'org'), 40) || '-' || substr(md5(random()::text || new.id::text), 1, 6);
    INSERT INTO public.organizations (name, slug) VALUES (v_org_name, v_slug) RETURNING id INTO v_org_id;
    v_role := 'Head Admin';
    v_org_role := NULL;
  END IF;

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'No organization for new user.';
  END IF;

  v_base := CASE WHEN v_trusted THEN
      COALESCE(NULLIF(new.raw_user_meta_data->>'username', ''), NULLIF(split_part(new.email, '@', 1), ''), 'user_' || substr(md5(random()::text), 1, 8))
    ELSE
      COALESCE(NULLIF(regexp_replace(lower(split_part(new.email, '@', 1)), '[^a-z0-9._]+', '', 'g'), ''), 'user_' || substr(md5(random()::text), 1, 8))
  END;
  v_username := v_base;
  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE username = v_username) LOOP
    v_suffix := v_suffix + 1;
    v_username := v_base || v_suffix;
  END LOOP;

  INSERT INTO public.profiles (id, username, role, email, organization_id, org_role_id, first_name, last_name)
  VALUES (
    new.id,
    v_username,
    v_role,
    new.email,
    v_org_id,
    v_org_role,
    NULLIF(left(btrim(new.raw_user_meta_data->>'first_name'), 60), ''),
    NULLIF(left(btrim(new.raw_user_meta_data->>'last_name'), 60), '')
  );

  RETURN new;
END;
$function$;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
NOTIFY pgrst, 'reload schema';
