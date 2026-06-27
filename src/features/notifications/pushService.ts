import { supabase } from '@shared/api/supabaseClient';

/**
 * Persist / remove a device's push token. Upsert on the token so a device that
 * gets reassigned to another user simply moves to the new owner.
 */
export async function saveDeviceToken(userId: string, token: string, platform: string): Promise<void> {
    await supabase
        .from('device_tokens')
        .upsert(
            { user_id: userId, token, platform, updated_at: new Date().toISOString() },
            { onConflict: 'token' },
        );
}

export async function removeDeviceToken(token: string): Promise<void> {
    await supabase.from('device_tokens').delete().eq('token', token);
}
