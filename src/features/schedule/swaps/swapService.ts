import { z } from 'zod';
import { supabase } from '@shared/api/supabaseClient';
import { ShiftSwapSchema, type ShiftSwap } from './types';

/**
 * --- SHIFT SWAP SERVICE ---
 * Reads go through RLS (own swaps, open offers, everything for observers);
 * every write is a SECURITY DEFINER RPC that re-checks the rules (the taker
 * must be free; only admins decide; nobody decides their own swap).
 */
const SELECT =
    '*, shift:scheduled_shifts(starts_at, ends_at, all_day, location_id, location:locations(name)), ' +
    'from:profiles!shift_swaps_from_user_fkey(username, first_name, last_name), ' +
    'taker:profiles!shift_swaps_taker_id_fkey(username, first_name, last_name)';

export const swapService = {
    /** Live swaps + anything decided in the last 90 days. */
    async list(): Promise<ShiftSwap[]> {
        const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
        const { data, error } = await supabase
            .from('shift_swaps')
            .select(SELECT)
            .or(`status.in.(open,taken),updated_at.gte.${since}`)
            .order('created_at', { ascending: true });
        if (error) throw error;
        return z.array(ShiftSwapSchema).parse(data ?? []);
    },
    async offer(shiftId: string, toUser: string | null = null, note: string | null = null) {
        const { data, error } = await supabase.rpc('offer_shift_swap', { p_shift: shiftId, p_to_user: toUser, p_note: note });
        if (error) throw error;
        return data;
    },
    async take(id: string) {
        const { error } = await supabase.rpc('take_shift_swap', { p_id: id });
        if (error) throw error;
    },
    async review(id: string, approve: boolean, note: string | null) {
        const { error } = await supabase.rpc('review_shift_swap', { p_id: id, p_approve: approve, p_note: note });
        if (error) throw error;
    },
    async withdraw(id: string) {
        const { error } = await supabase.rpc('withdraw_shift_swap', { p_id: id });
        if (error) throw error;
    },
};

/** "swap_blocked:busy" → 'busy' (why the taker can't work the shift). */
export const swapBlockReason = (e: unknown): 'busy' | 'leave' | 'unavailable' | null => {
    const m = /swap_blocked:(busy|leave|unavailable)/.exec(e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e));
    return (m?.[1] as 'busy' | 'leave' | 'unavailable') ?? null;
};
