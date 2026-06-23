import { useState } from 'react';
import {
    CheckIcon,
    XIcon,
    UserIcon,
    ArrowRightIcon,
} from '@phosphor-icons/react';
import type { NameChangeRequest } from '@shared/types';
import { LoadingState, EmptyState } from './AdminStateViews';

/**
 * Pending name-change requests for the admin to approve or reject. Approving
 * applies the requested name to the member's profile (server-side, atomically).
 */
export function NameChangeRequestsList({
    items,
    isLoading,
    onReview,
}: {
    items: NameChangeRequest[];
    isLoading: boolean;
    onReview: (id: string, approve: boolean, note?: string | null) => Promise<void>;
}) {
    if (isLoading) return <LoadingState label="requests" />;
    if (items.length === 0) return <EmptyState label="pending requests" />;

    return (
        <div className="space-y-2">
            {items.map((req) => (
                <RequestRow key={req.id} req={req} onReview={onReview} />
            ))}
        </div>
    );
}

function fullName(first?: string | null, last?: string | null): string {
    return `${first ?? ''} ${last ?? ''}`.trim() || '—';
}

function RequestRow({
    req,
    onReview,
}: {
    req: NameChangeRequest;
    onReview: (id: string, approve: boolean, note?: string | null) => Promise<void>;
}) {
    const [busy, setBusy] = useState<null | 'approve' | 'reject'>(null);
    const [error, setError] = useState<string | null>(null);

    const act = async (approve: boolean) => {
        setError(null);
        setBusy(approve ? 'approve' : 'reject');
        try {
            await onReview(req.id, approve);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Action failed.');
            setBusy(null);
        }
    };

    return (
        <div className="bg-white dark:bg-gray-800/40 border border-gray-100 dark:border-gray-800 rounded-2xl shadow-sm p-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                {/* who */}
                <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-9 h-9 rounded-xl bg-gray-100 dark:bg-gray-900/50 flex items-center justify-center text-gray-500 dark:text-gray-400 shrink-0">
                        <UserIcon weight="bold" className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                        <p className="text-body-strong text-gray-900 dark:text-white truncate">
                            @{req.requester?.username ?? '—'}
                        </p>
                        <p className="text-caption text-gray-400 truncate">{req.requester?.email ?? ''}</p>
                    </div>
                </div>

                {/* current -> requested */}
                <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span className="text-small text-gray-500 dark:text-gray-400 truncate">
                        {fullName(req.current_first_name, req.current_last_name)}
                    </span>
                    <ArrowRightIcon weight="bold" className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span className="text-small-strong text-gray-900 dark:text-white truncate">
                        {fullName(req.requested_first_name, req.requested_last_name)}
                    </span>
                </div>

                {/* actions */}
                <div className="flex items-center gap-2 shrink-0">
                    <button
                        onClick={() => act(true)}
                        disabled={busy !== null}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-small-strong text-white bg-emerald-500 hover:bg-emerald-600 transition-colors disabled:opacity-50"
                    >
                        <CheckIcon weight="bold" className="w-4 h-4" />
                        {busy === 'approve' ? '…' : 'Approve'}
                    </button>
                    <button
                        onClick={() => act(false)}
                        disabled={busy !== null}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-small-strong text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/15 hover:bg-red-100 dark:hover:bg-red-900/25 transition-colors disabled:opacity-50"
                    >
                        <XIcon weight="bold" className="w-4 h-4" />
                        {busy === 'reject' ? '…' : 'Reject'}
                    </button>
                </div>
            </div>

            {req.note && (
                <p className="text-caption text-gray-500 dark:text-gray-400 mt-3 pl-12">“{req.note}”</p>
            )}
            {error && <p className="text-caption text-red-500 mt-2 pl-12">{error}</p>}
        </div>
    );
}
