// =============================================================================
// EDGE FUNCTION: delete-employee
// -----------------------------------------------------------------------------
// Fully deprovisions a member: deletes the auth.users row with the service_role
// key, which CASCADES to public.profiles and public.shifts (FKs are ON DELETE
// CASCADE). The old client-side path deleted only the profiles row, leaving an
// orphaned auth user who could still authenticate — a security/lifecycle gap.
//
// Authorization is derived from the CALLER's JWT (never the body):
//   * Superadmin            -> may delete anyone (except self).
//   * Admin/Head Admin (>=30)-> may delete a strictly lower-ranked member in
//                               their OWN organization.
//   * Everyone else         -> rejected.
// =============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
}

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
    if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);

    try {
        const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
        const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
        const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

        const authHeader = req.headers.get('Authorization');
        if (!authHeader) return json({ error: 'Missing Authorization header.' }, 401);

        // 1. Identify the caller from their JWT.
        const callerClient = createClient(SUPABASE_URL, ANON_KEY, {
            global: { headers: { Authorization: authHeader } },
        });
        const {
            data: { user: caller },
            error: callerError,
        } = await callerClient.auth.getUser();
        if (callerError || !caller) return json({ error: 'Invalid or expired session.' }, 401);

        // 2. Admin (service_role) client — bypasses RLS for trusted operations.
        const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
            auth: { autoRefreshToken: false, persistSession: false },
        });

        // 3. Parse + validate input.
        const body = await req.json().catch(() => ({}));
        const targetId = body.user_id ? String(body.user_id) : '';
        if (!targetId) return json({ error: 'A user_id is required.' }, 400);
        if (targetId === caller.id) return json({ error: 'You cannot delete your own account.' }, 400);

        // 4. Load caller + target profiles and their ranks.
        const { data: callerProfile, error: cpErr } = await admin
            .from('profiles')
            .select('organization_id, role')
            .eq('id', caller.id)
            .single();
        if (cpErr || !callerProfile) return json({ error: 'Caller profile not found.' }, 403);

        const { data: targetProfile, error: tpErr } = await admin
            .from('profiles')
            .select('organization_id, role')
            .eq('id', targetId)
            .single();
        if (tpErr || !targetProfile) return json({ error: 'Target user not found.' }, 404);

        const { data: rankRows } = await admin
            .from('roles')
            .select('name, rank')
            .in('name', [callerProfile.role, targetProfile.role]);
        const rankOf = (name: string) => Number(rankRows?.find((r) => r.name === name)?.rank ?? 0);
        const callerRank = rankOf(callerProfile.role);
        const targetRank = rankOf(targetProfile.role);
        const isSuperadmin = callerProfile.role === 'Superadmin';

        // 5. Authorize (mirrors RLS + canManageMember).
        const allowed =
            isSuperadmin ||
            (callerRank >= 30 &&
                callerProfile.organization_id === targetProfile.organization_id &&
                targetRank < callerRank);
        if (!allowed) return json({ error: 'You are not allowed to remove this member.' }, 403);

        // 6. Delete the auth user — cascades to profiles + shifts.
        const { error: delErr } = await admin.auth.admin.deleteUser(targetId);
        if (delErr) return json({ error: delErr.message }, 400);

        return json({ success: true }, 200);
    } catch (err) {
        const message = err instanceof Error ? err.message : JSON.stringify(err);
        return json({ error: message || 'Unexpected error.' }, 500);
    }
});
