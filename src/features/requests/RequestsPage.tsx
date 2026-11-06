import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { PlusIcon, UserCircleIcon, CheckCircleIcon } from '@phosphor-icons/react';
import { useTranslation } from '@shared/preferences/PreferencesContext';
import { can } from '@shared/auth/permissions';
import { PageHeader } from '@shared/components/PageHeader';
import { Button } from '@shared/components/Button';
import { Skeleton } from '@shared/components/Skeleton';
import { TimeOffRequestModal } from '@features/schedule/components/TimeOffCard';
import { RequestCard } from './RequestCard';
import { useRequests, canDecideOn, markRequestsSeen } from './useRequests';

/**
 * --- REQUESTS (the shared inbox) ---
 * Every request lands here — time off and name changes.
 *   • Admins decide (approve / decline with a reason), never on their own.
 *   • Managers observe: they see the same queue and history, without buttons.
 *   • Everyone sees "My requests" with each decision and its reason, can
 *     withdraw a pending leave request and file a new one.
 */

type Tab = 'review' | 'history' | 'mine';

export function RequestsPage() {
    const t = useTranslation();
    const { user, toReview, history, mine, isLoading, conflictsFor, decide, withdraw } = useRequests();
    const canObserve = can(user, 'team.view');
    const [tab, setTab] = useState<Tab>(canObserve ? 'review' : 'mine');
    const [requesting, setRequesting] = useState(false);

    // Looking at your own requests clears the "new decision" badge.
    useEffect(() => {
        if (user && tab === 'mine') markRequestsSeen(user.id);
    }, [tab, user, mine.length]);

    if (!user) return null;

    const tabs: { id: Tab; label: string }[] = canObserve
        ? [
              { id: 'review', label: `${t('requests.toReview')}${toReview.length ? ` (${toReview.length})` : ''}` },
              { id: 'history', label: t('requests.history') },
              { id: 'mine', label: t('requests.mine') },
          ]
        : [];

    const busyKey = decide.isPending ? decide.variables?.item.key : withdraw.isPending ? `timeoff:${withdraw.variables?.id}` : null;
    const empty = (text: string) => (
        <div className="glass flex flex-col items-center rounded-2xl px-6 py-8 text-center">
            <div className="mb-2.5 flex size-11 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-300">
                <CheckCircleIcon weight="duotone" className="size-6" />
            </div>
            <p className="max-w-xs text-meta text-ink-soft dark:text-slate-400">{text}</p>
        </div>
    );

    return (
        <div className="space-y-4 px-1 pb-10">
            <PageHeader eyebrow={canObserve ? t('requests.inbox') : t('requests.mine')} title={t('nav.requests')} />

            {tabs.length > 0 && (
                <div className="segmented">
                    {tabs.map((tb) => (
                        <button
                            key={tb.id}
                            type="button"
                            aria-pressed={tab === tb.id}
                            onClick={() => setTab(tb.id)}
                            className={`rounded-[9px] px-2.5 py-1 text-meta font-semibold transition-colors ${
                                tab === tb.id ? 'segment-active text-ink dark:text-white' : 'text-ink-soft hover:text-ink dark:text-slate-400 dark:hover:text-white'
                            }`}
                        >
                            {tb.label}
                        </button>
                    ))}
                </div>
            )}

            {isLoading ? (
                <div className="space-y-2" aria-hidden>
                    {[0, 1, 2].map((i) => (
                        <Skeleton key={i} className="h-24 rounded-2xl" />
                    ))}
                </div>
            ) : tab === 'review' ? (
                toReview.length === 0 ? (
                    empty(t('requests.allCaughtUp'))
                ) : (
                    <ul className="space-y-2">
                        {toReview.map((item) => (
                            <RequestCard
                                key={item.key}
                                item={item}
                                conflicts={conflictsFor(item)}
                                canDecide={canDecideOn(user, item)}
                                observer={canObserve}
                                busy={busyKey === item.key}
                                onDecide={(approve, note) => decide.mutate({ item, approve, note })}
                            />
                        ))}
                    </ul>
                )
            ) : tab === 'history' ? (
                history.length === 0 ? (
                    empty(t('requests.historyEmpty'))
                ) : (
                    <ul className="space-y-2">
                        {history.map((item) => (
                            <RequestCard key={item.key} item={item} />
                        ))}
                    </ul>
                )
            ) : (
                <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                        <Button size="sm" icon={PlusIcon} onClick={() => setRequesting(true)}>
                            {t('timeoff.request')}
                        </Button>
                        <Link
                            to="/profile"
                            className="inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-meta font-semibold text-ink-soft transition-colors hover:bg-ink/5 hover:text-ink dark:text-slate-400 dark:hover:bg-white/8 dark:hover:text-white"
                            title={t('requests.nameHint')}
                        >
                            <UserCircleIcon weight="bold" className="size-4" />
                            {t('requests.typeName')}
                        </Link>
                    </div>
                    {mine.length === 0 ? (
                        empty(t('requests.mineEmpty'))
                    ) : (
                        <ul className="space-y-2">
                            {mine.map((item) => (
                                <RequestCard
                                    key={item.key}
                                    item={item}
                                    showPerson={false}
                                    busy={busyKey === item.key}
                                    onWithdraw={item.type === 'timeoff' ? () => withdraw.mutate(item) : undefined}
                                />
                            ))}
                        </ul>
                    )}
                </div>
            )}

            <AnimatePresence>
                {requesting && (
                    <TimeOffRequestModal members={[]} selfId={user.id} orgId={user.organization_id} managerMode={false} onClose={() => setRequesting(false)} />
                )}
            </AnimatePresence>
        </div>
    );
}
