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

type PrefCategory = 'shifts' | 'account' | 'requests';
type Lang = 'en' | 'cs';

/**
 * A notification to deliver. `key` + `vars` are localized per recipient at send
 * time (the recipient's language lives on their notification_preferences row).
 * Direct invocations may instead pass a ready `title`/`body`.
 */
interface PushMessage {
    userId: string;
    route?: string;
    category?: PrefCategory;
    // Localized form:
    key?: string;
    vars?: Record<string, string | number | undefined>;
    // Pre-rendered form (direct `{ userId, title, body }` invocations):
    title?: string;
    body?: string;
}

// --- Push string localization (mirrors the client's notif.* keys) -------------

/** Czech plural pick: (1) one, (2–4) few, (else) many. */
function csPlural(n: number, one: string, few: string, many: string): string {
    if (n === 1) return one;
    if (n >= 2 && n <= 4) return few;
    return many;
}

/** Localized "N shifts". */
function shiftsCount(n: number, lang: Lang): string {
    return lang === 'cs' ? `${n} ${csPlural(n, 'směna', 'směny', 'směn')}` : `${n} shift${n === 1 ? '' : 's'}`;
}

const KIND_ACC: Record<Lang, Record<string, string>> = {
    en: { vacation: 'vacation', sick: 'sick leave', other: 'leave' },
    cs: { vacation: 'dovolenou', sick: 'nemocenskou', other: 'volno' },
};
const KIND_NOM: Record<Lang, Record<string, string>> = {
    en: { vacation: 'vacation', sick: 'sick leave', other: 'leave' },
    cs: { vacation: 'dovolená', sick: 'nemocenská', other: 'volno' },
};

/** Render a notification's title + body for a recipient's language. */
function render(msg: PushMessage, lang: Lang): { title: string; body: string } {
    if (msg.title !== undefined || msg.body !== undefined) {
        return { title: msg.title ?? '', body: msg.body ?? '' };
    }
    const v = msg.vars ?? {};
    const cs = lang === 'cs';
    const actor = String(v.actor ?? (cs ? 'Někdo' : 'Someone'));
    const who = String(v.who ?? (cs ? 'Člen týmu' : 'A team member'));
    const loc = v.loc ? String(v.loc) : '';
    const atLoc = loc ? (cs ? ` v ${loc}` : ` at ${loc}`) : '';
    const n = Number(v.count ?? 1);
    const kind = String(v.kind ?? 'other');
    const range = String(v.range ?? '');

    switch (msg.key) {
        case 'create':
            return cs
                ? { title: 'Nová směna', body: `${actor} vám přidal(a) směnu${v.when ? `: ${v.when}` : ' do rozpisu'}.` }
                : { title: 'New shift', body: `${actor} added a shift${v.when ? `: ${v.when}` : ' to your schedule'}.` };
        case 'update':
            return cs
                ? { title: 'Změna směny', body: `${actor} upravil(a) vaši směnu${v.when ? `: ${v.when}` : ''}.` }
                : { title: 'Shift changed', body: `${actor} updated your shift${v.when ? `: ${v.when}` : ''}.` };
        case 'delete':
            return cs
                ? { title: 'Směna odebrána', body: `${actor} odebral(a) vaši směnu${v.when ? `: ${v.when}` : ''}.` }
                : { title: 'Shift removed', body: `${actor} removed your shift${v.when ? `: ${v.when}` : ''}.` };
        case 'name_request_approved':
            return cs
                ? { title: 'Změna jména schválena', body: 'Vaše žádost o změnu jména byla schválena.' }
                : { title: 'Name change approved', body: 'Your name change request was approved.' };
        case 'name_request_rejected':
            return cs
                ? { title: 'Změna jména zamítnuta', body: 'Vaše žádost o změnu jména byla zamítnuta.' }
                : { title: 'Name change declined', body: 'Your name change request was declined.' };
        case 'late': {
            const mins = v.bucket === '60' ? (cs ? '1+ hodinu' : '1+ hour') : (cs ? '15+ min' : '15+ min');
            return cs
                ? { title: 'Směna nezahájena', body: `${who} se nepřihlásil(a)${atLoc} — ${mins} zpoždění.` }
                : { title: 'Shift not started', body: `${who} hasn't clocked in${atLoc} — ${mins} late.` };
        }
        case 'schedule_published':
            return cs
                ? { title: 'Rozpis zveřejněn', body: `${actor} zveřejnil(a) váš rozpis — ${shiftsCount(n, 'cs')}.` }
                : { title: 'Schedule published', body: `${actor} published your schedule — ${shiftsCount(n, 'en')}.` };
        case 'schedule_updated': {
            const what = cs ? (n === 1 ? 'jednu vaši směnu' : `${n} vašich směn`) : (n === 1 ? 'a shift of yours' : `${n} of your shifts`);
            return cs
                ? { title: 'Změna rozpisu', body: `${actor} změnil(a) ${what}${atLoc}.` }
                : { title: 'Schedule changed', body: `${actor} changed ${what}${atLoc}.` };
        }
        case 'schedule_removed': {
            const what = cs ? (n === 1 ? 'jednu vaši směnu' : `${n} vašich směn`) : (n === 1 ? 'a shift of yours' : `${n} of your shifts`);
            return cs
                ? { title: 'Směny odebrány', body: `${actor} odebral(a) ${what}${atLoc}.` }
                : { title: 'Shifts removed', body: `${actor} removed ${what}${atLoc}.` };
        }
        case 'timeoff_requested':
            return cs
                ? { title: 'Žádost o volno', body: `${who} žádá o ${KIND_ACC.cs[kind]}: ${range}.` }
                : { title: 'Time-off request', body: `${who} requested ${KIND_ACC.en[kind]}: ${range}.` };
        case 'timeoff_approved':
            return cs
                ? { title: 'Volno schváleno', body: `Vaše ${KIND_NOM.cs[kind]} (${range}) byla schválena.` }
                : { title: 'Time off approved', body: `Your ${KIND_NOM.en[kind]} (${range}) was approved.` };
        case 'timeoff_declined':
            return cs
                ? { title: 'Volno zamítnuto', body: `Vaše ${KIND_NOM.cs[kind]} (${range}) byla zamítnuta.` }
                : { title: 'Time off declined', body: `Your ${KIND_NOM.en[kind]} (${range}) was declined.` };
        case 'profile_updated': {
            const fields = String(v.fields ?? (cs ? 'profil' : 'profile'));
            return cs
                ? { title: 'Profil upraven', body: `${actor} upravil(a) váš ${fields}.` }
                : { title: 'Profile updated', body: `${actor} updated your ${fields}.` };
        }
        case 'name_request_new':
            return cs
                ? { title: 'Nová žádost o změnu jména', body: 'Člen týmu požádal o změnu jména.' }
                : { title: 'New name-change request', body: 'A team member requested a name change.' };
        default:
            return { title: '', body: '' };
    }
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
    const s = btoa(String.fromCharCode(...bytes));
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

/**
 * The recipient's push preferences + language in one read (missing row = all on,
 * English). Category gating and localization both use this.
 */
async function fetchPrefs(userId: string, category?: PrefCategory): Promise<{ allow: boolean; lang: Lang }> {
    const { data } = await admin
        .from('notification_preferences')
        .select('push_enabled, shifts, account, requests, language')
        .eq('user_id', userId)
        .maybeSingle();
    const lang: Lang = data?.language === 'cs' ? 'cs' : 'en';
    if (!data) return { allow: true, lang };
    if (!data.push_enabled) return { allow: false, lang };
    const allow = category ? data[category] !== false : true;
    return { allow, lang };
}

async function sendToUser(msg: PushMessage): Promise<number> {
    const { userId, route, category } = msg;
    const { allow, lang } = await fetchPrefs(userId, category);
    if (!allow) return 0;
    const { title, body } = render(msg, lang);

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
    // New announcement → notify every member of the org except the author.
    if (table === 'announcements') {
        const orgId = record.organization_id as string;
        const authorId = (record.author_id as string | null) ?? null;
        const titleText = (record.title as string) || 'Announcement';
        const bodyText = (record.body as string) || '';
        const shortBody = bodyText.length > 140 ? `${bodyText.slice(0, 139)}…` : bodyText;

        const { data: members } = await admin
            .from('profiles')
            .select('id')
            .eq('organization_id', orgId);

        return (members ?? [])
            .map((m: { id: string }) => m.id)
            .filter((id) => id !== authorId)
            .map((id) => ({
                userId: id,
                // User-authored content — passed pre-rendered (no localization).
                title: `📣 ${titleText}`,
                body: shortBody,
                route: '/announcements',
                // No category: gated only by the recipient's push_enabled toggle.
            }));
    }

    if (table === 'shift_audit_log') {
        const target = record.target_user_id as string | null;
        const action = record.action as string;
        const details = (record.details as Record<string, unknown>) ?? {};
        const actor = displayName(record, details);
        if (!target) return [];

        // Date part of a shift snapshot ("5 Jul"); the location is passed
        // separately so the render layer can localize the "at"/"v" joiner.
        const shiftDate = (snap: Record<string, unknown> | undefined | null): string => {
            if (snap && typeof snap.started_at === 'string') {
                try {
                    return new Date(snap.started_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
                } catch { /* ignore */ }
            }
            return '';
        };
        const whenOf = (snap: Record<string, unknown> | undefined | null): string => {
            const d = shiftDate(snap);
            const loc = snap && typeof snap.location_name === 'string' ? snap.location_name : '';
            return [d, loc && `· ${loc}`].filter(Boolean).join(' ');
        };
        const nu = details.new as Record<string, unknown> | undefined;
        const ol = details.old as Record<string, unknown> | undefined;
        const dateRange = (): string =>
            details.starts_on === details.ends_on ? String(details.starts_on ?? '') : `${details.starts_on}–${details.ends_on}`;

        switch (action) {
            case 'create':
                return [{ userId: target, key: 'create', vars: { actor, when: whenOf(nu) }, route: '/overview', category: 'shifts' }];
            case 'update':
                return [{ userId: target, key: 'update', vars: { actor, when: whenOf(nu) }, route: '/overview', category: 'shifts' }];
            case 'delete':
                return [{ userId: target, key: 'delete', vars: { actor, when: whenOf(ol) }, route: '/overview', category: 'shifts' }];
            case 'name_request_approved':
                return [{ userId: target, key: 'name_request_approved', route: '/profile', category: 'account' }];
            case 'name_request_rejected':
                return [{ userId: target, key: 'name_request_rejected', route: '/profile', category: 'account' }];
            case 'late_15':
            case 'late_60':
                // Sent to BOTH the late member and their manager; neutral copy works for either.
                return [{
                    userId: target,
                    key: 'late',
                    vars: { who: (details.target_name as string) || '', loc: (details.location_name as string) || '', bucket: action === 'late_60' ? '60' : '15' },
                    route: '/?openNotifications=1',
                    category: 'shifts',
                }];
            case 'schedule_published':
                return [{ userId: target, key: 'schedule_published', vars: { actor, count: (details.count as number) || 0 }, route: '/schedule', category: 'shifts' }];
            case 'schedule_updated':
            case 'schedule_removed':
                return [{
                    userId: target,
                    key: action,
                    vars: { actor, count: (details.count as number) || 1, loc: (details.location_name as string) || '' },
                    route: '/schedule',
                    category: 'shifts',
                }];
            case 'timeoff_requested':
                return [{
                    userId: target,
                    key: 'timeoff_requested',
                    vars: { who: (details.target_name as string) || '', kind: (details.kind as string) || 'other', range: dateRange() },
                    route: '/schedule',
                    category: 'requests',
                }];
            case 'timeoff_approved':
            case 'timeoff_declined':
                return [{
                    userId: target,
                    key: action,
                    vars: { kind: (details.kind as string) || 'other', range: dateRange() },
                    route: '/schedule',
                    category: 'requests',
                }];
            case 'profile_updated': {
                const changes = (details.changes as { field: string }[] | undefined) ?? [];
                // Regular users have no admin screen for this — open the app on the
                // in-app notifications feed (client reads ?openNotifications=1).
                return [{ userId: target, key: 'profile_updated', vars: { actor, fields: changes.map((c) => c.field).join(', ') }, route: '/?openNotifications=1', category: 'account' }];
            }
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
            key: 'name_request_new',
            route: '/requests',
            category: 'requests' as const,
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
