// =============================================================================
// EDGE FUNCTION: delete-account  (GDPR — right to erasure, self-service)
// -----------------------------------------------------------------------------
// Lets a signed-in user delete their OWN account. Deletes the auth.users row
// with the service_role key, which CASCADES to public.profiles and everything
// that references it (shifts, scheduled_shifts, time_off, device_tokens,
// notification_preferences, audit rows) via ON DELETE CASCADE.
//
// Guardrails (so a deletion can't orphan an organization):
//   * Superadmin cannot self-delete (they administer the whole system).
//   * The last remaining admin (rank >= 30) of an org that still has other
//     members cannot self-delete — they must promote another admin first.
//
// Authorization is derived from the CALLER's JWT — the body carries nothing.
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

        // 2. Service-role client — bypasses RLS for the trusted checks + delete.
        const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
            auth: { autoRefreshToken: false, persistSession: false },
        });

        // 3. Load the caller's profile + role rank.
        const { data: profile, error: pErr } = await admin
            .from('profiles')
            .select('organization_id, role')
            .eq('id', caller.id)
            .single();
        if (pErr || !profile) return json({ error: 'Profile not found.' }, 404);

        const { data: roleRow } = await admin
            .from('roles')
            .select('rank')
            .eq('name', profile.role)
            .maybeSingle();
        const callerRank = Number(roleRow?.rank ?? 0);

        if (profile.role === 'Superadmin') {
            return json({ error: 'Superadmins cannot delete their own account. Contact support.' }, 403);
        }

        // 4. Orphan guard: the last admin of an org with other members must
        //    promote a replacement before leaving.
        if (callerRank >= 30) {
            const { data: peers } = await admin
                .from('profiles')
                .select('id, role')
                .eq('organization_id', profile.organization_id)
                .neq('id', caller.id);
            const others = peers ?? [];
            if (others.length > 0) {
                const { data: ranks } = await admin.from('roles').select('name, rank');
                const rankOf = (name: string) => Number(ranks?.find((r) => r.name === name)?.rank ?? 0);
                const otherAdmins = others.filter((o) => rankOf(o.role) >= 30);
                if (otherAdmins.length === 0) {
                    return json(
                        { error: 'You are the last admin of your organization. Promote another admin before deleting your account.' },
                        409,
                    );
                }
            }
        }

        // 5. Delete the auth user — cascades to all their data.
        const { error: delErr } = await admin.auth.admin.deleteUser(caller.id);
        if (delErr) return json({ error: delErr.message }, 400);

        return json({ success: true }, 200);
    } catch (err) {
        const message = err instanceof Error ? err.message : JSON.stringify(err);
        return json({ error: message || 'Unexpected error.' }, 500);
    }
});
