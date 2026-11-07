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
// Custom roles (#124): the client sends an organization role (`org_role_id`);
// its LEVEL must sit below the caller's, and the caller needs the Team
// (members) write permission.
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

        // 3. Load the caller's profile + their role rank.
        const { data: callerProfile, error: profileError } = await admin
            .from('profiles')
            .select('organization_id, role')
            .eq('id', caller.id)
            .single();
        if (profileError || !callerProfile) return json({ error: 'Caller profile not found.' }, 403);

        const { data: callerRole } = await admin
            .from('roles')
            .select('rank')
            .eq('name', callerProfile.role)
            .single();

        const isSuperadmin = callerProfile.role === 'Superadmin';
        // Hierarchy rank = the position of the caller's organization role.
        const { data: callerPos } = await admin.rpc('profile_rank', { p_user: caller.id });
        const callerRank = isSuperadmin ? 1000 : Number(callerPos ?? callerRole?.rank ?? 0);
        // Inviting needs the Team (members) write permission of the caller's role.
        const { data: mayInvite } = await admin.rpc('profile_has_permission', { p_user: caller.id, p_area: 'members', p_action: 'write' });
        if (!isSuperadmin && !mayInvite) return json({ error: 'You are not allowed to invite users.' }, 403);

        // 4. Parse + validate the request body.
        const body = await req.json().catch(() => ({}));
        const email = String(body.email ?? '').trim().toLowerCase();
        const firstName = body.first_name ? String(body.first_name).trim() : null;
        const lastName = body.last_name ? String(body.last_name).trim() : null;
        let organizationId = body.organization_id ? String(body.organization_id) : '';
        let role = body.role ? String(body.role) : 'Employee';
        const orgRoleId = body.org_role_id ? String(body.org_role_id) : '';
        const redirectTo = body.redirect_to ? String(body.redirect_to) : '';
        const language = body.language === 'cs' ? 'cs' : 'en';

        if (!email || !email.includes('@')) return json({ error: 'A valid email is required.' }, 400);

        // 5. Apply scoping (server is the source of truth).
        if (!isSuperadmin) {
            organizationId = callerProfile.organization_id; // org admins can only invite into their own org
        }
        if (!organizationId) return json({ error: 'An organization is required.' }, 400);

        // 6. An organization role decides the level (and must belong to the org).
        let targetRank: number | null = null;
        if (orgRoleId) {
            const { data: orgRole } = await admin.from('org_roles').select('id, organization_id, base_role, sort').eq('id', orgRoleId).single();
            if (!orgRole || orgRole.organization_id !== organizationId) return json({ error: 'Unknown role.' }, 400);
            role = orgRole.base_role;
            targetRank = Number(orgRole.sort);
        }
        //    Validate the organization, and that the level exists and is ranked
        //    strictly below the caller (you can't invite a peer or superior).
        const [{ data: roleRow }, { data: orgRow }] = await Promise.all([
            admin.from('roles').select('name, rank').eq('name', role).single(),
            admin.from('organizations').select('id, name').eq('id', organizationId).single(),
        ]);
        if (!roleRow) return json({ error: `Unknown role "${role}".` }, 400);
        if (!orgRow) return json({ error: 'Unknown organization.' }, 400);
        if ((targetRank ?? Number(roleRow.rank)) >= callerRank) {
            return json({ error: 'You cannot invite someone at or above your own role level.' }, 403);
        }

        // 7. Send the invitation. The trigger reads this metadata to provision
        //    the profile into the right org + role. The invitee lands on the
        //    app's /accept-invite page (must be allowlisted in Auth settings).
        //    The email template also shows the role's name, who invited them
        //    and is written in `language`.
        const roleName = orgRoleId
            ? (await admin.from('org_roles').select('name').eq('id', orgRoleId).single()).data?.name ?? role
            : role;
        const { data: inviter } = await admin.from('profiles').select('first_name, last_name, username').eq('id', caller.id).single();
        const inviterName = [inviter?.first_name, inviter?.last_name].filter(Boolean).join(' ') || inviter?.username || '';
        const target = redirectTo || Deno.env.get('SITE_URL') || '';
        // The provisioning trigger trusts only this server-written record for
        // the organization and role (auth sets invited_at only after the
        // insert, and user metadata can't be trusted).
        const { error: pendingError } = await admin.from('pending_invites').upsert({
            email,
            organization_id: organizationId,
            role,
            org_role_id: orgRoleId || null,
            created_by: caller.id,
        });
        if (pendingError) return json({ error: 'Could not prepare the invitation.' }, 500);
        const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
            data: {
                organization_id: organizationId,
                organization_name: orgRow.name, // surfaced in the invite email template
                role,
                ...(orgRoleId ? { org_role_id: orgRoleId } : {}),
                role_name: roleName,
                inviter_name: inviterName,
                language,
                first_name: firstName,
                last_name: lastName,
            },
            ...(target ? { redirectTo: target } : {}),
        });

        if (inviteError) {
            await admin.from('pending_invites').delete().eq('email', email);
            // AuthError often serialises to "{}", so surface its useful fields.
            const e = inviteError as { message?: string; status?: number; code?: string; name?: string };
            const message =
                e.message && e.message !== '{}'
                    ? e.message
                    : `Could not send the invitation (status ${e.status ?? '?'}${e.code ? `, ${e.code}` : ''}). ` +
                      'This usually means email/SMTP is not configured, or the address is already registered.';
            return json({ error: message, status: e.status ?? null, code: e.code ?? null, name: e.name ?? null }, 400);
        }

        // 8. Activity log: who invited whom, with which role.
        if (invited?.user?.id) {
            await admin.rpc('log_member_event', {
                p_org: organizationId,
                p_action: 'member_invited',
                p_actor: caller.id,
                p_subject: invited.user.id,
                p_details: { role_name: roleName, email },
            });
        }

        return json({ success: true, user_id: invited?.user?.id ?? null }, 200);
    } catch (err) {
        const message = err instanceof Error ? err.message : JSON.stringify(err);
        return json({ error: message || 'Unexpected error.' }, 500);
    }
});
