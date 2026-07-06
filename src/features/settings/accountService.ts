import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { supabase } from '@shared/api/supabaseClient';

/**
 * --- ACCOUNT SERVICE (GDPR self-service) ---
 * Personal-data export and account self-deletion for the signed-in user.
 * The export reads only the caller's own rows (RLS-scoped); deletion goes
 * through the `delete-account` Edge Function, which erases the auth user and
 * cascades all their data.
 */

/** Gather everything we hold about the current user into one JSON payload. */
export async function buildMyDataExport(userId: string): Promise<string> {
    const [profile, shifts, scheduled, timeOff, notifications] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
        supabase.from('shifts').select('*').eq('user_id', userId).order('started_at', { ascending: false }),
        supabase.from('scheduled_shifts').select('*').eq('user_id', userId).order('starts_at', { ascending: false }),
        supabase.from('time_off').select('*').eq('user_id', userId).order('starts_on', { ascending: false }),
        supabase.from('shift_audit_log').select('*').eq('target_user_id', userId).order('created_at', { ascending: false }),
    ]);

    const payload = {
        exported_at: new Date().toISOString(),
        user_id: userId,
        profile: profile.data ?? null,
        worked_shifts: shifts.data ?? [],
        scheduled_shifts: scheduled.data ?? [],
        time_off: timeOff.data ?? [],
        notifications: notifications.data ?? [],
    };
    return JSON.stringify(payload, null, 2);
}

/** Export the caller's data as a JSON file (native share sheet or web download). */
export async function exportMyData(userId: string): Promise<void> {
    const json = await buildMyDataExport(userId);
    const fileName = `planuj-smeny-data-${new Date().toISOString().slice(0, 10)}.json`;

    if (Capacitor.isNativePlatform()) {
        const res = await Filesystem.writeFile({
            path: fileName,
            data: json,
            directory: Directory.Cache,
            encoding: Encoding.UTF8,
        });
        await Share.share({ title: fileName, url: res.uri, dialogTitle: fileName });
        return;
    }

    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}

/** Permanently delete the caller's own account (Edge Function; cascades data). */
export async function deleteMyAccount(): Promise<void> {
    const { data, error } = await supabase.functions.invoke('delete-account', { body: {} });
    if (error) {
        // On a non-2xx, supabase-js puts the raw Response on `error.context`;
        // read the function's `{ error }` body so the guard messages (e.g. "last
        // admin", "Superadmins cannot…") reach the user instead of a generic one.
        let message = error.message;
        const resp = (error as { context?: Response }).context;
        if (resp && typeof resp.json === 'function') {
            try {
                const body = await resp.json();
                if (body?.error) message = body.error;
            } catch { /* keep the default message */ }
        }
        throw new Error(message);
    }
    if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
}
