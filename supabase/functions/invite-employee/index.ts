// =============================================================================
// EDGE FUNCTION: invite-employee
// -----------------------------------------------------------------------------
// Invites a new user by email and provisions them into an organization with a
// role. Runs server-side with the service_role key (never exposed to clients).
//
// Authorization is derived from the CALLER's JWT, not the request body:
//   * Superadmin      -> may invite into ANY organization, with ANY role.
//   * Org admin       -> forced into their OWN organization; cannot assign
//     (is_admin role)    the Superadmin role.
//   * Everyone else   -> rejected.
//
// The chosen organization + role travel as user metadata and are applied
// atomically by the handle_new_user trigger (see the companion migration).
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

        // 3. Load the caller's profile + whether their role is an admin role.
        const { data: callerProfile, error: profileError } = await admin
            .from('profiles')
            .select('organization_id, role')
            .eq('id', caller.id)
            .single();
        if (profileError || !callerProfile) return json({ error: 'Caller profile not found.' }, 403);

        const { data: callerRole } = await admin
            .from('roles')
            .select('is_admin')
            .eq('name', callerProfile.role)
            .single();

        const isSuperadmin = callerProfile.role === 'Superadmin';
        const isAdmin = isSuperadmin || Boolean(callerRole?.is_admin);
        if (!isAdmin) return json({ error: 'You are not allowed to invite users.' }, 403);

        // 4. Parse + validate the request body.
        const body = await req.json().catch(() => ({}));
        const email = String(body.email ?? '').trim().toLowerCase();
        const firstName = body.first_name ? String(body.first_name).trim() : null;
        const lastName = body.last_name ? String(body.last_name).trim() : null;
        let organizationId = body.organization_id ? String(body.organization_id) : '';
        const role = body.role ? String(body.role) : 'Employee';

        if (!email || !email.includes('@')) return json({ error: 'A valid email is required.' }, 400);

        // 5. Apply role-based scoping (server is the source of truth).
        if (!isSuperadmin) {
            organizationId = callerProfile.organization_id; // org admins can only invite into their own org
            if (role === 'Superadmin') {
                return json({ error: 'Only a Superadmin can assign the Superadmin role.' }, 403);
            }
        }
        if (!organizationId) return json({ error: 'An organization is required.' }, 400);

        // 6. Validate role + organization exist.
        const [{ data: roleRow }, { data: orgRow }] = await Promise.all([
            admin.from('roles').select('name').eq('name', role).single(),
            admin.from('organizations').select('id').eq('id', organizationId).single(),
        ]);
        if (!roleRow) return json({ error: `Unknown role "${role}".` }, 400);
        if (!orgRow) return json({ error: 'Unknown organization.' }, 400);

        // 7. Send the invitation. The trigger reads this metadata to provision
        //    the profile into the right org + role.
        const siteUrl = Deno.env.get('SITE_URL');
        const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
            data: {
                organization_id: organizationId,
                role,
                first_name: firstName,
                last_name: lastName,
            },
            ...(siteUrl ? { redirectTo: siteUrl } : {}),
        });

        if (inviteError) return json({ error: inviteError.message }, 400);

        return json({ success: true, user_id: invited?.user?.id ?? null }, 200);
    } catch (err) {
        return json({ error: err instanceof Error ? err.message : 'Unexpected error.' }, 500);
    }
});
