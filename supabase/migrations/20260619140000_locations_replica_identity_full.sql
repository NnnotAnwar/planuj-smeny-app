-- =============================================================================
-- FIX: live DELETE for locations
-- -----------------------------------------------------------------------------
-- The locations realtime subscription is filtered by organization_id. With the
-- default REPLICA IDENTITY (primary key only), a DELETE's `old` record carries
-- just the id — so `organization_id` is absent and the filter never matches,
-- meaning deletes were silently dropped (adds/renames worked because INSERT/
-- UPDATE carry the full new row). REPLICA IDENTITY FULL makes the old row carry
-- every column, so filtered DELETE events are delivered. (shifts is already FULL.)
-- =============================================================================

ALTER TABLE public.locations REPLICA IDENTITY FULL;
