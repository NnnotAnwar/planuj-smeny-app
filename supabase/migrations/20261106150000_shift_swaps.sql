-- =============================================================================
-- SHIFT SWAPS — offer → take → an admin approves (issue #123)
-- -----------------------------------------------------------------------------
-- A member offers one of their upcoming published shifts (to anyone, or to one
-- colleague). A teammate who is free takes it. The swap then waits in the
-- Requests inbox; an admin approves (the shift moves to the taker) or declines
-- with a reason. Either side can withdraw while it's pending.
-- All writes go through SECURITY DEFINER RPCs — the table has no write policies.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.shift_swaps (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  shift_id        uuid NOT NULL REFERENCES public.scheduled_shifts(id) ON DELETE CASCADE,
  from_user       uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  to_user         uuid REFERENCES public.profiles(id) ON DELETE SET NULL,   -- null = anyone
  taker_id        uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  status          text NOT NULL DEFAULT 'open'
                  CHECK (status IN ('open', 'taken', 'approved', 'declined', 'withdrawn')),
  note            text CHECK (note IS NULL OR char_length(note) <= 240),
  review_note     text CHECK (review_note IS NULL OR char_length(review_note) <= 240),
  reviewed_by     uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at     timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- One live swap per shift.
CREATE UNIQUE INDEX IF NOT EXISTS shift_swaps_one_active
  ON public.shift_swaps (shift_id) WHERE status IN ('open', 'taken');
CREATE INDEX IF NOT EXISTS shift_swaps_org_idx ON public.shift_swaps (organization_id, status);
CREATE INDEX IF NOT EXISTS shift_swaps_from_idx ON public.shift_swaps (from_user);
CREATE INDEX IF NOT EXISTS shift_swaps_to_idx ON public.shift_swaps (to_user);
CREATE INDEX IF NOT EXISTS shift_swaps_taker_idx ON public.shift_swaps (taker_id);
CREATE INDEX IF NOT EXISTS shift_swaps_reviewer_idx ON public.shift_swaps (reviewed_by);

ALTER TABLE public.shift_swaps ENABLE ROW LEVEL SECURITY;

-- Read: your own swaps, offers open to you, and everything for observers+.
DROP POLICY IF EXISTS "shift_swaps_select" ON public.shift_swaps;
CREATE POLICY "shift_swaps_select" ON public.shift_swaps FOR SELECT TO authenticated
  USING (
    is_superadmin()
    OR (organization_id = get_my_org_id() AND (
          from_user = (SELECT auth.uid())
          OR taker_id = (SELECT auth.uid())
          OR to_user = (SELECT auth.uid())
          OR (status = 'open' AND to_user IS NULL)
          OR my_role_rank() >= 20
    ))
  );

ALTER TABLE public.shift_swaps REPLICA IDENTITY FULL;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.shift_swaps;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- New notification kinds.
ALTER TABLE public.shift_audit_log DROP CONSTRAINT IF EXISTS shift_audit_log_action_check;
ALTER TABLE public.shift_audit_log ADD CONSTRAINT shift_audit_log_action_check
  CHECK (action = ANY (ARRAY[
    'create', 'update', 'delete', 'username_change', 'name_request_approved', 'name_request_rejected',
    'profile_updated', 'late_15', 'late_60', 'schedule_created', 'schedule_updated', 'schedule_removed',
    'schedule_published', 'timeoff_requested', 'timeoff_approved', 'timeoff_declined',
    'swap_taken', 'swap_requested', 'swap_approved', 'swap_declined'
  ]));

-- The swap RPC moves a shift to another person; its own notifications say so,
-- so the generic "your schedule changed" entry is skipped for that update.
CREATE OR REPLACE FUNCTION public.log_schedule_updated()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF current_setting('app.suppress_schedule_audit', true) = 'on' THEN
    RETURN NULL;
  END IF;
  INSERT INTO public.shift_audit_log (organization_id, shift_id, actor_id, target_user_id, action, details)
  SELECT g.organization_id, NULL, auth.uid(),
         CASE WHEN g.published AND g.user_id IS DISTINCT FROM auth.uid() THEN g.user_id END,
         'schedule_updated',
         jsonb_build_object(
           'actor_name', COALESCE(public._display_name(auth.uid()), 'System'),
           'target_name', public._display_name(g.user_id),
           'count', g.cnt,
           'scheduled_start', g.first_start,
           'location_name', g.loc_name
         )
  FROM (
    SELECT n.organization_id, n.user_id, bool_and(o.published AND n.published) AS published,
           count(*) AS cnt, min(n.starts_at) AS first_start,
           CASE WHEN count(DISTINCT n.location_id) = 1 THEN min(l.name) END AS loc_name
    FROM new_rows n
    JOIN old_rows o ON o.id = n.id
    LEFT JOIN public.locations l ON l.id = n.location_id
    WHERE n.starts_at <> o.starts_at
       OR n.ends_at <> o.ends_at
       OR n.all_day <> o.all_day
       OR n.location_id IS DISTINCT FROM o.location_id
       OR n.user_id IS DISTINCT FROM o.user_id
    GROUP BY n.organization_id, n.user_id
  ) g;
  RETURN NULL;
END;
$function$;

-- Why `p_user` can't work `p_shift` (null = free): another shift overlapping,
-- approved leave that day, or "can't work" availability overlapping it.
CREATE OR REPLACE FUNCTION public._swap_block_reason(p_user uuid, p_shift public.scheduled_shifts)
RETURNS text
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_day  date := (p_shift.starts_at AT TIME ZONE 'Europe/Prague')::date;
  v_from time := (p_shift.starts_at AT TIME ZONE 'Europe/Prague')::time;
  v_to   time := (p_shift.ends_at AT TIME ZONE 'Europe/Prague')::time;
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.scheduled_shifts s
    WHERE s.user_id = p_user AND s.id <> p_shift.id
      AND tstzrange(s.starts_at, s.ends_at, '[)') && tstzrange(p_shift.starts_at, p_shift.ends_at, '[)')
  ) THEN RETURN 'busy'; END IF;

  IF EXISTS (
    SELECT 1 FROM public.time_off t
    WHERE t.user_id = p_user AND t.status = 'approved' AND v_day BETWEEN t.starts_on AND t.ends_on
  ) THEN RETURN 'leave'; END IF;

  IF EXISTS (
    SELECT 1 FROM public.availability a
    WHERE a.user_id = p_user AND a.kind = 'unavailable'
      AND (a.specific_date = v_day OR (a.specific_date IS NULL AND a.day_of_week = extract(dow FROM v_day)))
      AND (a.all_day OR p_shift.all_day OR a.start_time IS NULL OR a.end_time IS NULL
           OR v_to <= v_from                      -- overnight shift: treat as overlapping
           OR (a.start_time < v_to AND a.end_time > v_from))
  ) THEN RETURN 'unavailable'; END IF;

  RETURN NULL;
END;
$$;

-- Notify helper: one audit row per recipient.
CREATE OR REPLACE FUNCTION public._swap_notify(p_swap public.shift_swaps, p_action text, p_recipients uuid[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_shift public.scheduled_shifts;
  v_details jsonb;
  r uuid;
BEGIN
  SELECT * INTO v_shift FROM public.scheduled_shifts WHERE id = p_swap.shift_id;
  v_details := jsonb_build_object(
    'actor_name', COALESCE(public._display_name(auth.uid()), 'System'),
    'from_name', public._display_name(p_swap.from_user),
    'taker_name', public._display_name(p_swap.taker_id),
    'scheduled_start', v_shift.starts_at,
    'scheduled_end', v_shift.ends_at,
    'all_day', v_shift.all_day,
    'location_name', (SELECT name FROM public.locations WHERE id = v_shift.location_id),
    'note', p_swap.review_note
  );
  FOREACH r IN ARRAY p_recipients LOOP
    IF r IS NOT NULL AND r IS DISTINCT FROM auth.uid() THEN
      INSERT INTO public.shift_audit_log (organization_id, shift_id, actor_id, target_user_id, action, details)
      VALUES (p_swap.organization_id, NULL, auth.uid(), r, p_action, v_details);
    END IF;
  END LOOP;
END;
$$;

-- 1. Offer one of my upcoming published shifts.
CREATE OR REPLACE FUNCTION public.offer_shift_swap(p_shift uuid, p_to_user uuid DEFAULT NULL, p_note text DEFAULT NULL)
RETURNS public.shift_swaps
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid   uuid := auth.uid();
  v_shift public.scheduled_shifts;
  v_swap  public.shift_swaps;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not signed in.' USING ERRCODE = 'insufficient_privilege'; END IF;
  SELECT * INTO v_shift FROM public.scheduled_shifts WHERE id = p_shift;
  IF NOT FOUND OR v_shift.user_id <> v_uid THEN
    RAISE EXCEPTION 'You can only offer your own shifts.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF NOT v_shift.published OR v_shift.starts_at <= now() THEN
    RAISE EXCEPTION 'Only upcoming published shifts can be offered.' USING ERRCODE = 'check_violation';
  END IF;
  IF p_to_user IS NOT NULL AND (p_to_user = v_uid OR NOT EXISTS (
       SELECT 1 FROM public.profiles WHERE id = p_to_user AND organization_id = v_shift.organization_id)) THEN
    RAISE EXCEPTION 'Pick a colleague from your organization.' USING ERRCODE = 'check_violation';
  END IF;
  INSERT INTO public.shift_swaps (organization_id, shift_id, from_user, to_user, note)
  VALUES (v_shift.organization_id, v_shift.id, v_uid, p_to_user, NULLIF(btrim(p_note), ''))
  RETURNING * INTO v_swap;
  RETURN v_swap;
EXCEPTION WHEN unique_violation THEN
  RAISE EXCEPTION 'This shift is already offered.' USING ERRCODE = 'unique_violation';
END;
$$;

-- 2. Take an offered shift (must be free).
CREATE OR REPLACE FUNCTION public.take_shift_swap(p_id uuid)
RETURNS public.shift_swaps
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid    uuid := auth.uid();
  v_swap   public.shift_swaps;
  v_shift  public.scheduled_shifts;
  v_reason text;
  v_admins uuid[];
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not signed in.' USING ERRCODE = 'insufficient_privilege'; END IF;
  SELECT * INTO v_swap FROM public.shift_swaps WHERE id = p_id FOR UPDATE;
  IF NOT FOUND OR v_swap.organization_id <> get_my_org_id() THEN
    RAISE EXCEPTION 'Swap not found.' USING ERRCODE = 'no_data_found';
  END IF;
  IF v_swap.status <> 'open' THEN RAISE EXCEPTION 'Someone already took this shift.' USING ERRCODE = 'check_violation'; END IF;
  IF v_swap.from_user = v_uid THEN RAISE EXCEPTION 'You can''t take your own shift.' USING ERRCODE = 'check_violation'; END IF;
  IF v_swap.to_user IS NOT NULL AND v_swap.to_user <> v_uid THEN
    RAISE EXCEPTION 'This shift was offered to someone else.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  SELECT * INTO v_shift FROM public.scheduled_shifts WHERE id = v_swap.shift_id;
  v_reason := public._swap_block_reason(v_uid, v_shift);
  IF v_reason IS NOT NULL THEN
    RAISE EXCEPTION 'swap_blocked:%', v_reason USING ERRCODE = 'check_violation';
  END IF;

  UPDATE public.shift_swaps SET taker_id = v_uid, status = 'taken', updated_at = now()
  WHERE id = p_id RETURNING * INTO v_swap;

  SELECT array_agg(id) INTO v_admins FROM public.profiles
  WHERE organization_id = v_swap.organization_id AND role_rank(role) >= 30
    AND id NOT IN (v_swap.from_user, v_uid);
  PERFORM public._swap_notify(v_swap, 'swap_taken', ARRAY[v_swap.from_user]);
  PERFORM public._swap_notify(v_swap, 'swap_requested', COALESCE(v_admins, '{}'));
  RETURN v_swap;
END;
$$;

-- 3. An admin decides.
CREATE OR REPLACE FUNCTION public.review_shift_swap(p_id uuid, p_approve boolean, p_note text DEFAULT NULL)
RETURNS public.shift_swaps
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid    uuid := auth.uid();
  v_swap   public.shift_swaps;
  v_shift  public.scheduled_shifts;
  v_reason text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not signed in.' USING ERRCODE = 'insufficient_privilege'; END IF;
  SELECT * INTO v_swap FROM public.shift_swaps WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Swap not found.' USING ERRCODE = 'no_data_found'; END IF;
  IF NOT public.can_review_request(v_swap.from_user, v_swap.organization_id)
     OR (v_swap.taker_id = v_uid AND my_role_rank() < 40 AND NOT is_superadmin()) THEN
    RAISE EXCEPTION 'You are not allowed to review this swap.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF v_swap.status <> 'taken' THEN RAISE EXCEPTION 'This swap is no longer waiting for a decision.' USING ERRCODE = 'check_violation'; END IF;

  IF p_approve THEN
    SELECT * INTO v_shift FROM public.scheduled_shifts WHERE id = v_swap.shift_id FOR UPDATE;
    v_reason := public._swap_block_reason(v_swap.taker_id, v_shift);
    IF v_reason IS NOT NULL THEN
      RAISE EXCEPTION 'swap_blocked:%', v_reason USING ERRCODE = 'check_violation';
    END IF;
    PERFORM set_config('app.suppress_schedule_audit', 'on', true);
    UPDATE public.scheduled_shifts SET user_id = v_swap.taker_id WHERE id = v_swap.shift_id;
    PERFORM set_config('app.suppress_schedule_audit', 'off', true);
  END IF;

  UPDATE public.shift_swaps
     SET status = CASE WHEN p_approve THEN 'approved' ELSE 'declined' END,
         review_note = NULLIF(btrim(p_note), ''), reviewed_by = v_uid, reviewed_at = now(), updated_at = now()
   WHERE id = p_id RETURNING * INTO v_swap;

  PERFORM public._swap_notify(v_swap, CASE WHEN p_approve THEN 'swap_approved' ELSE 'swap_declined' END,
                              ARRAY[v_swap.from_user, v_swap.taker_id]);
  RETURN v_swap;
END;
$$;

-- 4. Withdraw: the offerer cancels; the taker gives it back (offer reopens).
CREATE OR REPLACE FUNCTION public.withdraw_shift_swap(p_id uuid)
RETURNS public.shift_swaps
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid  uuid := auth.uid();
  v_swap public.shift_swaps;
BEGIN
  SELECT * INTO v_swap FROM public.shift_swaps WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Swap not found.' USING ERRCODE = 'no_data_found'; END IF;
  IF v_swap.from_user = v_uid AND v_swap.status IN ('open', 'taken') THEN
    UPDATE public.shift_swaps SET status = 'withdrawn', updated_at = now() WHERE id = p_id RETURNING * INTO v_swap;
  ELSIF v_swap.taker_id = v_uid AND v_swap.status = 'taken' THEN
    UPDATE public.shift_swaps SET status = 'open', taker_id = NULL, updated_at = now() WHERE id = p_id RETURNING * INTO v_swap;
  ELSE
    RAISE EXCEPTION 'Nothing to withdraw.' USING ERRCODE = 'check_violation';
  END IF;
  RETURN v_swap;
END;
$$;

REVOKE ALL ON FUNCTION public._swap_block_reason(uuid, public.scheduled_shifts) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._swap_notify(public.shift_swaps, text, uuid[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.offer_shift_swap(uuid, uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.take_shift_swap(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.review_shift_swap(uuid, boolean, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.withdraw_shift_swap(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.offer_shift_swap(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.take_shift_swap(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.review_shift_swap(uuid, boolean, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.withdraw_shift_swap(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
