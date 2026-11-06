import type { TimeOff } from '@shared/types';

/**
 * One request in the shared inbox, whatever its type — time off or a name
 * change — normalised so the list, the history and "my requests" render the
 * same card.
 */
export interface RequestItem {
    key: string; // `${type}:${id}`
    type: 'timeoff' | 'name' | 'swap' | 'role' | 'other' | 'complaint';
    id: string;
    /** Empty for an anonymous complaint seen by a reviewer. */
    userId: string;
    personName: string;
    /** The signed-in user's own request (set by the server for member requests). */
    mine?: boolean;
    /** Server-decided: may the signed-in user approve / decline it. */
    canReview?: boolean;
    status: 'pending' | 'approved' | 'declined';
    createdAt: string;
    reviewedAt: string | null;
    reviewNote: string | null;
    note: string | null;
    // time off
    kind?: TimeOff['kind'];
    startsOn?: string; // YYYY-MM-DD
    endsOn?: string;
    // name change
    oldName?: string;
    newName?: string;
    // shift swap (userId = the person who offered it)
    takerId?: string | null;
    takerName?: string;
    shiftStart?: string;
    shiftEnd?: string;
    shiftAllDay?: boolean;
    locationName?: string;
    // role / other / complaint
    subject?: string | null;
    body?: string | null;
    roleName?: string | null;
    roleColor?: string | null;
    currentRoleName?: string | null;
    anonymous?: boolean;
    reviewerName?: string | null;
}
