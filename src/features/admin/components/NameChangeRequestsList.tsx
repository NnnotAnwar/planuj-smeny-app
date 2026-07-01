import { useState } from 'react';
import {
    CheckIcon,
    ProhibitIcon,
    UserIcon,
    ArrowRightIcon,
    CaretDownIcon,
    EnvelopeSimpleIcon,
    CalendarBlankIcon,
    ChatTextIcon,
} from '@phosphor-icons/react';
import type { ReactNode } from 'react';
import type { NameChangeRequest } from '@shared/types';
import { EmptyState } from './AdminStateViews';
import { Button } from '@shared/components/Button';
import { Skeleton } from '@shared/components/Skeleton';
import { useTranslation } from '@shared/preferences/PreferencesContext';
import { haptics } from '@shared/utils/haptics';
import { toast } from '@shared/toast/toastStore';

/**
 * --- NAME-CHANGE REQUESTS LIST ---
 * Pending requests an admin approves/rejects. Approving applies the new name to
 * the member's profile server-side, atomically.
 *
 * UX principles baked in:
 *  1) Intuitiveness — one dominant primary action (Approve) vs. a quiet
 *     secondary (Reject); the decision-critical name diff is up front.
 *  2) Signal over noise — email / date / note are collapsed behind a tap
 *     (progressive disclosure), so the list stays scannable.
 *  3) Feedback for every state — skeletons while loading, an optimistic remove
 *     with an UNDO toast on action, and a silent rollback + error toast on fail.
 *  4) Responsive — full-width, thumb-sized controls on phones; a compact row on ≥sm.
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
    const t = useTranslation();

    // (3) Optimistic model: rows the user has actioned are hidden immediately and
    // only committed to the server once the Undo window closes (see review()).
    const [hidden, setHidden] = useState<Set<string>>(new Set());

    // (3) LOADING: skeletons that mirror the card shape — no layout jump.
    if (isLoading) return <RequestListSkeleton />;

    const visible = items.filter((r) => !hidden.has(r.id));
    // (3) EMPTY: a definitive "nothing to do", not an ambiguous blank.
    if (visible.length === 0) return <EmptyState label={t('admin.nounPendingRequests')} />;

    const review = (req: NameChangeRequest, approve: boolean) => {
        haptics.success(); // optimistic: the tap already "succeeded" visually
        setHidden((prev) => new Set(prev).add(req.id));

        const restore = () =>
            setHidden((prev) => {
                const next = new Set(prev);
                next.delete(req.id);
                return next;
            });

        // Deferred commit: fires only if the user doesn't hit Undo in time.
        const commit = () => {
            void onReview(req.id, approve).catch((err) => {
                restore(); // put the row back on failure
                haptics.error();
                toast(err instanceof Error ? err.message : t('common.actionFailed'), 'error');
            });
        };

        toast(approve ? t('requests.approvedToast') : t('requests.rejectedToast'), 'success', {
            action: { label: t('common.undo'), onClick: restore },
            onExpire: commit,
        });
    };

    return (
        <div className="space-y-2">
            {visible.map((req) => (
                <RequestCard key={req.id} req={req} onReview={review} />
            ))}
        </div>
    );
}

/** (3) Loading placeholder — three cards' worth of shimmer. */
function RequestListSkeleton() {
    return (
        <div className="space-y-2" aria-hidden>
            {[0, 1, 2].map((i) => (
                <div
                    key={i}
                    className="bg-white dark:bg-gray-800/40 border border-gray-100 dark:border-gray-800 rounded-2xl p-4"
                >
                    <div className="flex items-center gap-3">
                        <Skeleton className="w-9 h-9 rounded-xl" />
                        <div className="flex-1 space-y-2">
                            <Skeleton className="h-3.5 w-32" />
                            <Skeleton className="h-3 w-24" />
                        </div>
                        <Skeleton className="h-9 w-24 rounded-xl" />
                    </div>
                </div>
            ))}
        </div>
    );
}

function fullName(first?: string | null, last?: string | null): string {
    return `${first ?? ''} ${last ?? ''}`.trim() || '—';
}

function RequestCard({
    req,
    onReview,
}: {
    req: NameChangeRequest;
    onReview: (req: NameChangeRequest, approve: boolean) => void;
}) {
    const t = useTranslation();
    // (2) Progressive disclosure: details are collapsed so the list stays scannable.
    const [expanded, setExpanded] = useState(false);
    const hasDetails = Boolean(req.requester?.email || req.note || req.created_at);

    return (
        <div className="bg-white dark:bg-gray-800/40 border border-gray-100 dark:border-gray-800 rounded-2xl shadow-sm overflow-hidden">
            {/* (4) Stacks on mobile, one aligned row at ≥sm. */}
            <div className="p-4 flex flex-col sm:flex-row sm:items-center gap-4">
                {/* WHO — tapping the identity zone toggles details (2); real <button> for a11y. */}
                <button
                    type="button"
                    onClick={() => hasDetails && setExpanded((v) => !v)}
                    aria-expanded={hasDetails ? expanded : undefined}
                    className="flex items-center gap-3 min-w-0 flex-1 text-left"
                >
                    <div className="w-9 h-9 rounded-xl bg-gray-100 dark:bg-gray-900/50 flex items-center justify-center text-gray-500 dark:text-gray-400 shrink-0">
                        <UserIcon weight="bold" className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                        <p className="text-body-strong text-gray-900 dark:text-white truncate normal-case">
                            @{req.requester?.username ?? '—'}
                        </p>
                        {/* (1) The name diff is the decision — old (muted) → new (emphasised). */}
                        <span className="flex items-center gap-1.5 mt-0.5 min-w-0">
                            <span className="text-caption text-gray-400 truncate">
                                {fullName(req.current_first_name, req.current_last_name)}
                            </span>
                            <ArrowRightIcon weight="bold" className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                            <span className="text-small-strong text-gray-900 dark:text-white truncate">
                                {fullName(req.requested_first_name, req.requested_last_name)}
                            </span>
                        </span>
                    </div>
                    {hasDetails && (
                        <CaretDownIcon
                            weight="bold"
                            className={`w-4 h-4 text-gray-300 dark:text-gray-600 shrink-0 ml-auto sm:hidden transition-transform ${
                                expanded ? 'rotate-180' : ''
                            }`}
                        />
                    )}
                </button>

                {/* ACTIONS — (1) Approve = primary, Reject = quiet secondary.
                    (4) full-width on mobile (grid), auto on ≥sm; both ≥44px tall via Button. */}
                <div className="grid grid-cols-2 sm:flex items-center gap-2 shrink-0">
                    <Button variant="primary" icon={CheckIcon} onClick={() => onReview(req, true)}>
                        {t('common.approve')}
                    </Button>
                    <Button variant="secondary" icon={ProhibitIcon} onClick={() => onReview(req, false)}>
                        {t('common.reject')}
                    </Button>
                </div>
            </div>

            {/* (2) DETAILS — mounted only when opened; zero weight by default. */}
            {expanded && hasDetails && (
                <div className="px-4 pb-4 -mt-1 space-y-1.5 border-t border-gray-100 dark:border-gray-800 pt-3">
                    {req.requester?.email && (
                        <DetailRow icon={<EnvelopeSimpleIcon weight="bold" className="w-3.5 h-3.5" />}>
                            {req.requester.email}
                        </DetailRow>
                    )}
                    {req.created_at && (
                        <DetailRow icon={<CalendarBlankIcon weight="bold" className="w-3.5 h-3.5" />}>
                            {t('requests.submitted', { date: new Date(req.created_at).toLocaleDateString() })}
                        </DetailRow>
                    )}
                    {req.note && (
                        <DetailRow icon={<ChatTextIcon weight="bold" className="w-3.5 h-3.5" />}>
                            “{req.note}”
                        </DetailRow>
                    )}
                </div>
            )}
        </div>
    );
}

function DetailRow({ icon, children }: { icon: ReactNode; children: ReactNode }) {
    return (
        <p className="flex items-center gap-2 text-caption text-gray-500 dark:text-gray-400">
            <span className="text-gray-400 dark:text-gray-500 shrink-0">{icon}</span>
            <span className="min-w-0 truncate">{children}</span>
        </p>
    );
}
