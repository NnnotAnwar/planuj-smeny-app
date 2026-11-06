import type { TimeOff } from '@shared/types';

/**
 * One request in the shared inbox, whatever its type — time off or a name
 * change — normalised so the list, the history and "my requests" render the
 * same card.
 */
export interface RequestItem {
    key: string; // `${type}:${id}`
    type: 'timeoff' | 'name';
    id: string;
    userId: string;
    personName: string;
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
}
