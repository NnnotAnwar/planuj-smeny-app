// =============================================================================
// EDGE FUNCTION: username-login   (verify_jwt = false — this IS the login)
// -----------------------------------------------------------------------------
// Lets users sign in with a username instead of an email WITHOUT exposing the
// username -> email mapping to the public.
//
// Previously the client called the `get_email_by_username` RPC (granted to
// `anon`) to turn a username into an email, then signed in. That let anyone
// enumerate usernames and harvest email addresses (PII).
//
// Here the lookup AND the sign-in happen server-side; the response only ever
// contains session tokens or a single generic error, so it leaks neither which
// usernames exist nor any email address.
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

const GENERIC = 'Invalid username or password.';

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
    if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);

    try {
        const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
        const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
        const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

        const body = await req.json().catch(() => ({}));
        const username = String(body.username ?? '').trim();
        const password = String(body.password ?? '');
        if (!username || !password) return json({ error: GENERIC }, 400);

        // 1. Resolve username -> email with the service role (never returned).
        const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
            auth: { autoRefreshToken: false, persistSession: false },
        });
        const { data: profile } = await admin
            .from('profiles')
            .select('email')
            .eq('username', username)
            .maybeSingle();

        // Same generic error whether the username exists or not (no oracle).
        if (!profile?.email) return json({ error: GENERIC }, 400);

        // 2. Verify the password by actually signing in (anon client).
        const authClient = createClient(SUPABASE_URL, ANON_KEY, {
            auth: { autoRefreshToken: false, persistSession: false },
        });
        const { data, error } = await authClient.auth.signInWithPassword({
            email: profile.email,
            password,
        });
        if (error || !data.session) return json({ error: GENERIC }, 400);

        // 3. Return only the tokens; the client adopts them via setSession().
        return json(
            {
                access_token: data.session.access_token,
                refresh_token: data.session.refresh_token,
            },
            200,
        );
    } catch {
        // Never leak internals on the login path.
        return json({ error: GENERIC }, 400);
    }
});
