import { z } from 'zod';
import { supabase } from '@shared/api/supabaseClient';

/**
 * --- MEMBER REQUESTS SERVICE ---
 * Role requests, other requests and complaints. Everything goes through RPCs:
 * the list hides an anonymous sender from reviewers, decisions on a role
 * request apply the role (with the usual hierarchy checks) in the DB.
 */
export const MemberRequestSchema = z.object({
    id: z.string(),
    organization_id: z.string(),
    user_id: z.string().nullable(),
    person_name: z.string().nullable(),
    kind: z.enum(['role', 'other', 'complaint']),
    subject: z.string().nullable(),
    body: z.string().nullable(),
    org_role_id: z.string().nullable(),
    role_name: z.string().nullable(),
    role_color: z.string().nullable(),
    current_role_name: z.string().nullable(),
    anonymous: z.boolean(),
    status: z.enum(['pending', 'approved', 'declined']),
    review_note: z.string().nullable(),
    reviewer_name: z.string().nullable(),
    reviewed_at: z.string().nullable(),
    created_at: z.string(),
    mine: z.boolean(),
    can_review: z.boolean(),
});
export type MemberRequest = z.infer<typeof MemberRequestSchema>;
export type MemberRequestKind = MemberRequest['kind'];

/** Server error codes worth a friendly message (else the generic one). */
const CODES = ['request_role_top', 'request_role_same', 'request_role_pending', 'request_role_gone', 'request_empty', 'request_too_many'] as const;
export type MemberRequestError = (typeof CODES)[number];
export function memberRequestError(e: unknown): MemberRequestError | null {
    const msg = e instanceof Error ? e.message : String((e as { message?: string })?.message ?? '');
    return CODES.find((c) => msg.includes(c)) ?? null;
}

export const memberRequestsService = {
    async list(): Promise<MemberRequest[]> {
        const { data, error } = await supabase.rpc('list_member_requests');
        if (error) throw error;
        return z.array(MemberRequestSchema).parse(data ?? []);
    },

    async submit(v: { kind: MemberRequestKind; subject?: string | null; body?: string | null; orgRoleId?: string | null; anonymous?: boolean }): Promise<string> {
        const { data, error } = await supabase.rpc('submit_member_request', {
            p_kind: v.kind,
            p_subject: v.subject ?? null,
            p_body: v.body ?? null,
            p_org_role: v.orgRoleId ?? null,
            p_anonymous: !!v.anonymous,
        });
        if (error) throw error;
        return data as string;
    },

    async review(id: string, approve: boolean, note: string | null): Promise<void> {
        const { error } = await supabase.rpc('review_member_request', { p_id: id, p_approve: approve, p_note: note });
        if (error) throw error;
    },

    async cancel(id: string): Promise<void> {
        const { error } = await supabase.rpc('cancel_member_request', { p_id: id });
        if (error) throw error;
    },
};
