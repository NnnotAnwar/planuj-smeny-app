import { z } from 'zod';

const PersonSchema = z
    .object({
        username: z.string(),
        first_name: z.string().nullable(),
        last_name: z.string().nullable(),
    })
    .nullable()
    .optional();

/**
 * A shift a member offered to colleagues (issue #123). Lifecycle:
 * open → taken (a free colleague took it) → approved / declined by an admin;
 * withdrawn by the offerer at any point before the decision.
 */
export const ShiftSwapSchema = z.object({
    id: z.string(),
    organization_id: z.string(),
    shift_id: z.string(),
    from_user: z.string(),
    to_user: z.string().nullable().optional(),
    taker_id: z.string().nullable().optional(),
    status: z.enum(['open', 'taken', 'approved', 'declined', 'withdrawn']),
    note: z.string().nullable().optional(),
    review_note: z.string().nullable().optional(),
    reviewed_at: z.string().nullable().optional(),
    created_at: z.string(),
    updated_at: z.string(),
    // Joined: the shift being swapped (may be gone if an admin deleted it).
    shift: z
        .object({
            starts_at: z.string(),
            ends_at: z.string(),
            all_day: z.boolean(),
            location_id: z.string().nullable(),
            location: z.object({ name: z.string() }).nullable().optional(),
        })
        .nullable()
        .optional(),
    from: PersonSchema,
    taker: PersonSchema,
});

export type ShiftSwap = z.infer<typeof ShiftSwapSchema>;

export const personName = (p: ShiftSwap['from']) => (p ? [p.first_name, p.last_name].filter(Boolean).join(' ') || p.username : '—');
