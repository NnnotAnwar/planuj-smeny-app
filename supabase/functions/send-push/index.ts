// Supabase Edge Function: send-push
//
// Sends Firebase Cloud Messaging (HTTP v1) push notifications. Invoked either by
// a Database Webhook (on INSERT into `shift_audit_log` / `name_change_requests`)
// or directly with `{ userId, title, body, route }`.
//
// Required secrets (set with `supabase secrets set ...`):
//   SUPABASE_URL                — project URL
//   SUPABASE_SERVICE_ROLE_KEY   — service-role key (read device_tokens / profiles)
//   FCM_SERVICE_ACCOUNT         — Firebase service-account JSON (single line)
//
// Deploy: supabase functions deploy send-push --no-verify-jwt
// (Database Webhooks call it server-to-server; recipients are derived here.)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

interface PushMessage {
    userId: string;
    title: string;
    body: string;
    route?: string;
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const FCM_SERVICE_ACCOUNT = Deno.env.get('FCM_SERVICE_ACCOUNT')!;

const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

// --- FCM HTTP v1 auth (service-account JWT -> OAuth access token) -------------

let cachedToken: { token: string; exp: number } | null = null;

function pemToArrayBuffer(pem: string): ArrayBuffer {
    const b64 = pem.replace(/-----BEGIN [^-]+-----/, '').replace(/-----END [^-]+-----/, '').replace(/\s+/g, '');
    const bin = atob(b64);
    const buf = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
    return buf.buffer;
}

function b64url(data: string | Uint8Array): string {
    const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data;
    let s = btoa(String.fromCharCode(...bytes));
    return s.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function getAccessToken(): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    if (cachedToken && cachedToken.exp - 60 > now) return cachedToken.token;

    const sa = JSON.parse(FCM_SERVICE_ACCOUNT);
    const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
    const claim = b64url(
        JSON.stringify({
            iss: sa.client_email,
            scope: 'https://www.googleapis.com/auth/firebase.messaging',
            aud: 'https://oauth2.googleapis.com/token',
            iat: now,
            exp: now + 3600,
        }),
    );
    const signingInput = `${header}.${claim}`;

    const key = await crypto.subtle.importKey(
        'pkcs8',
        pemToArrayBuffer(sa.private_key),
        { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
        false,
        ['sign'],
    );
    const sig = new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(signingInput)));
    const jwt = `${signingInput}.${b64url(sig)}`;

    const res = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
    });
    const json = await res.json();
    if (!json.access_token) throw new Error(`OAuth failed: ${JSON.stringify(json)}`);
    cachedToken = { token: json.access_token, exp: now + 3600 };
    return json.access_token;
}

async function projectId(): Promise<string> {
    return JSON.parse(FCM_SERVICE_ACCOUNT).project_id;
}

// --- Send to all of a user's devices ------------------------------------------

async function sendToUser({ userId, title, body, route }: PushMessage): Promise<number> {
    const { data: tokens } = await admin.from('device_tokens').select('token').eq('user_id', userId);
    if (!tokens || tokens.length === 0) return 0;

    const accessToken = await getAccessToken();
    const pid = await projectId();
    const url = `https://fcm.googleapis.com/v1/projects/${pid}/messages:send`;

    let sent = 0;
    await Promise.all(
        tokens.map(async ({ token }) => {
            const res = await fetch(url, {
                method: 'POST',
                headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: {
                        token,
                        notification: { title, body },
                        data: route ? { route } : {},
                        android: { priority: 'HIGH' },
                    },
                }),
            });
            if (res.ok) {
                sent++;
            } else {
                const txt = await res.text();
                // Drop tokens FCM reports as unregistered/invalid.
                if (res.status === 404 || res.status === 400) {
                    await admin.from('device_tokens').delete().eq('token', token);
                }
                console.warn('[send-push] FCM error', res.status, txt);
            }
        }),
    );
    return sent;
}

// --- Map DB events -> push messages -------------------------------------------

function displayName(rec: Record<string, unknown>, details: Record<string, unknown> | undefined): string {
    return (details?.actor_name as string) || (rec.actor_name as string) || 'Someone';
}

async function messagesFromWebhook(table: string, record: Record<string, unknown>): Promise<PushMessage[]> {
    if (table === 'shift_audit_log') {
        const target = record.target_user_id as string | null;
        const action = record.action as string;
        const details = (record.details as Record<string, unknown>) ?? {};
        const actor = displayName(record, details);
        if (!target) return [];

        switch (action) {
            case 'create':
                return [{ userId: target, title: 'New shift', body: `${actor} added a shift to your schedule.`, route: '/overview' }];
            case 'update':
                return [{ userId: target, title: 'Shift changed', body: `${actor} updated one of your shifts.`, route: '/overview' }];
            case 'delete':
                return [{ userId: target, title: 'Shift removed', body: `${actor} removed one of your shifts.`, route: '/overview' }];
            case 'name_request_approved':
                return [{ userId: target, title: 'Name change approved', body: 'Your name change request was approved.', route: '/profile' }];
            case 'name_request_rejected':
                return [{ userId: target, title: 'Name change declined', body: 'Your name change request was declined.', route: '/profile' }];
            default:
                return [];
        }
    }

    if (table === 'name_change_requests' && record.status === 'pending') {
        // Notify the org's admins/reviewers (rank >= 30), excluding the requester.
        const orgId = record.organization_id as string;
        const requester = record.user_id as string;
        const { data: admins } = await admin
            .from('profiles')
            .select('id, role:roles(rank)')
            .eq('organization_id', orgId);
        const reviewers = (admins ?? [])
            .filter((a: { id: string; role: { rank?: number } | null }) => (a.role?.rank ?? 0) >= 30 && a.id !== requester)
            .map((a: { id: string }) => a.id);
        return reviewers.map((id) => ({
            userId: id,
            title: 'New name-change request',
            body: 'A team member requested a name change.',
            route: '/requests',
        }));
    }

    return [];
}

// --- HTTP entry ---------------------------------------------------------------

Deno.serve(async (req) => {
    try {
        const payload = await req.json();

        let messages: PushMessage[];
        if (payload?.type === 'INSERT' && payload?.table && payload?.record) {
            messages = await messagesFromWebhook(payload.table, payload.record);
        } else if (payload?.userId && payload?.title) {
            messages = [payload as PushMessage];
        } else {
            return new Response(JSON.stringify({ error: 'unrecognized payload' }), { status: 400 });
        }

        let sent = 0;
        for (const m of messages) sent += await sendToUser(m);
        return new Response(JSON.stringify({ ok: true, recipients: messages.length, sent }), {
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (err) {
        console.error('[send-push]', err);
        return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
    }
});
