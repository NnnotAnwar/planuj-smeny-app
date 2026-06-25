-- =====================================================================
-- Let users read their OWN audit entries (= personal notifications)
-- =====================================================================
-- The audit log already records the events an employee cares about, tagged with
-- target_user_id: shift add/edit/delete, username changes, and name-change
-- request approvals/rejections. Admins (rank >= 30) could already read the org's
-- log; this adds a self-scoped read so every user can see notifications about
-- themselves, and publishes the table to realtime so they arrive live.

-- Self-read: a user may see audit rows that target them.
DROP POLICY IF EXISTS "Users read their own audit entries" ON public.shift_audit_log;
CREATE POLICY "Users read their own audit entries"
  ON public.shift_audit_log
  FOR SELECT
  USING (target_user_id = auth.uid());

-- Deliver inserts over realtime (RLS above scopes which rows a client receives).
ALTER PUBLICATION supabase_realtime ADD TABLE public.shift_audit_log;
