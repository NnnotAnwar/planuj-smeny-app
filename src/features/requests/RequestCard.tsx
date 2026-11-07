import { useState } from 'react';
import { CheckIcon, WarningIcon, XIcon, ArrowRightIcon, EyeSlashIcon } from '@phosphor-icons/react';
import { Button } from '@shared/components/Button';
import { Textarea } from '@shared/components/Input';
import { useTranslation } from '@shared/preferences/PreferencesContext';
import { formatDateShort, formatTime } from '@shared/utils/date';
import { KIND_KEYS } from '@features/schedule/timeOffShared';
import type { RequestItem } from './types';

/**
 * --- REQUEST CARD ---
 * One request, whatever its type: who, what (leave dates / old → new name),
 * their note, a warning when approving leave would remove planned shifts, the
 * decision (with its reason) once made — and, for someone allowed to decide,
 * Approve / Decline (decline can carry a reason the member will see).
 */

const initials = (name: string) =>
    name
        .split(/\s+/)
        .map((w) => w[0])
        .filter(Boolean)
        .slice(0, 2)
        .join('')
        .toUpperCase() || '?';

const dayCount = (from: string, to: string) => {
    const [fy, fm, fd] = from.split('-').map(Number);
    const [ty, tm, td] = to.split('-').map(Number);
    return Math.round((new Date(ty, tm - 1, td).getTime() - new Date(fy, fm - 1, fd).getTime()) / 86_400_000) + 1;
};

const STATUS_TONE: Record<RequestItem['status'], string> = {
    pending: 'bg-amber-500/12 text-amber-700 dark:text-amber-300',
    approved: 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300',
    declined: 'bg-rose-500/12 text-rose-700 dark:text-rose-300',
};

export function RequestCard({
    item,
    showPerson = true,
    conflicts = 0,
    canDecide = false,
    observer = false,
    own = false,
    busy = false,
    onDecide,
    onWithdraw,
}: {
    item: RequestItem;
    /** Hide the requester line in "my requests". */
    showPerson?: boolean;
    /** Planned shifts approving this leave would remove. */
    conflicts?: number;
    canDecide?: boolean;
    /** Can see but not decide (managers) — shows who it waits for. */
    observer?: boolean;
    /** The viewer's own request in the review queue: no buttons, someone else decides. */
    own?: boolean;
    busy?: boolean;
    onDecide?: (approve: boolean, note: string | null) => void;
    onWithdraw?: () => void;
}) {
    const t = useTranslation();
    const [declining, setDeclining] = useState(false);
    const [reason, setReason] = useState('');

    const isMember = item.type === 'role' || item.type === 'other' || item.type === 'complaint';
    const freeText = item.type === 'other' || item.type === 'complaint';
    const typeLabel =
        item.type === 'name'
            ? t('requests.typeName')
            : item.type === 'swap'
              ? t('swap.typeLabel')
              : isMember
                ? t(`mreq.kind.${item.type}` as 'mreq.kind.role')
                : t(KIND_KEYS[item.kind ?? 'other']);
    const statusLabel =
        item.status === 'pending'
            ? t('requests.statusPending')
            : item.status === 'approved'
              ? freeText ? t('mreq.done') : t('timeoff.approved')
              : t('timeoff.declined');
    // An anonymous complaint, as a reviewer sees it.
    const person = item.personName || t('mreq.anonymousSender');
    const range =
        item.type === 'timeoff' && item.startsOn && item.endsOn
            ? item.startsOn === item.endsOn
                ? formatDateShort(`${item.startsOn}T00:00`)
                : `${formatDateShort(`${item.startsOn}T00:00`)} – ${formatDateShort(`${item.endsOn}T00:00`)}`
            : null;
    const days = item.type === 'timeoff' && item.startsOn && item.endsOn ? dayCount(item.startsOn, item.endsOn) : 0;

    return (
        <li className="glass rounded-2xl p-3">
            <div className="flex items-start gap-2.5">
                {showPerson && (
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-emerald-500/12 text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
                        {item.personName ? initials(item.personName) : <EyeSlashIcon weight="bold" className="size-3.5" />}
                    </span>
                )}
                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        {showPerson && <span className="truncate text-meta font-semibold text-ink dark:text-white">{person}</span>}
                        <span className="rounded-full bg-ink/6 px-2 py-0.5 text-[11px] font-semibold text-ink-soft dark:bg-white/8 dark:text-slate-300">{typeLabel}</span>
                        {own && (
                            <span className="rounded-full bg-emerald-500/12 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
                                {t('requests.yours')}
                            </span>
                        )}
                        {item.anonymous && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-violet-500/12 px-2 py-0.5 text-[11px] font-semibold text-violet-700 dark:text-violet-300">
                                <EyeSlashIcon weight="bold" className="size-3" />
                                {t('mreq.anonymousBadge')}
                            </span>
                        )}
                        {(!canDecide || item.status !== 'pending') && (
                            <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_TONE[item.status]}`}>{statusLabel}</span>
                        )}
                        <span className="ml-auto text-caption text-ink-soft dark:text-slate-400">
                            {t('requests.submitted', { date: formatDateShort(item.createdAt) })}
                        </span>
                    </div>

                    {/* What's asked. */}
                    {item.type === 'timeoff' ? (
                        <p className="mt-1 text-meta tabular-nums text-ink dark:text-slate-200">
                            {range} · {t('requests.days', { n: days })}
                        </p>
                    ) : item.type === 'swap' && item.shiftStart ? (
                        <div className="mt-1 space-y-0.5 text-meta text-ink dark:text-slate-200">
                            <p className="tabular-nums">
                                {formatDateShort(item.shiftStart)} ·{' '}
                                {item.shiftAllDay ? t('schedule.allDay') : `${formatTime(item.shiftStart)}–${formatTime(item.shiftEnd!)}`}
                                {item.locationName ? ` · ${item.locationName}` : ''}
                            </p>
                            <p className="flex flex-wrap items-center gap-1.5">
                                <span className="text-ink-soft dark:text-slate-400">{item.personName}</span>
                                <ArrowRightIcon weight="bold" className="size-3 text-ink-soft" />
                                <span className="font-semibold">{item.takerName}</span>
                            </p>
                        </div>
                    ) : item.type === 'role' ? (
                        <p className="mt-1 flex flex-wrap items-center gap-1.5 text-meta text-ink dark:text-slate-200">
                            <span className="text-ink-soft dark:text-slate-400">{item.currentRoleName ?? '—'}</span>
                            <ArrowRightIcon weight="bold" className="size-3 text-ink-soft" />
                            <span className="inline-flex items-center gap-1.5 font-semibold">
                                {item.roleColor && <span className="size-2.5 rounded-full" style={{ backgroundColor: item.roleColor }} aria-hidden />}
                                {item.roleName ?? t('mreq.roleGone')}
                            </span>
                        </p>
                    ) : freeText ? (
                        <div className="mt-1 space-y-0.5">
                            {item.subject && <p className="text-meta font-semibold text-ink dark:text-white">{item.subject}</p>}
                            {item.body && <p className="whitespace-pre-line text-meta text-ink dark:text-slate-200">{item.body}</p>}
                        </div>
                    ) : (
                        <p className="mt-1 flex flex-wrap items-center gap-1.5 text-meta text-ink dark:text-slate-200">
                            <span className="text-ink-soft line-through decoration-ink/30 dark:text-slate-400">{item.oldName}</span>
                            <ArrowRightIcon weight="bold" className="size-3 text-ink-soft" />
                            <span className="font-semibold">{item.newName}</span>
                        </p>
                    )}
                    {item.note && <p className="mt-1 text-caption italic text-ink-soft dark:text-slate-400">“{item.note}”</p>}

                    {item.status === 'pending' && conflicts > 0 && (
                        <p className="mt-1.5 flex items-start gap-1 text-caption font-medium text-amber-700 dark:text-amber-300">
                            <WarningIcon weight="fill" className="mt-px size-3.5 shrink-0" />
                            {t('requests.conflicts', { n: conflicts })}
                        </p>
                    )}
                    {item.status !== 'pending' && item.reviewNote && (
                        <p className="mt-1 text-caption text-ink-soft dark:text-slate-400">
                            {freeText ? t('mreq.reply') : t('requests.reason')}: {item.reviewNote}
                        </p>
                    )}
                    {item.status !== 'pending' && item.reviewerName && (
                        <p className="mt-0.5 text-caption text-ink-soft dark:text-slate-400">{t('mreq.decidedBy', { name: item.reviewerName })}</p>
                    )}
                    {item.status === 'pending' && own ? (
                        <p className="mt-1 text-caption text-ink-soft dark:text-slate-400">{t('requests.decidedByOther')}</p>
                    ) : item.status === 'pending' && observer && !canDecide ? (
                        <p className="mt-1 text-caption text-ink-soft dark:text-slate-400">{t('requests.waitsForAdmin')}</p>
                    ) : null}

                    {/* Decide. */}
                    {item.status === 'pending' && canDecide && onDecide && (
                        declining ? (
                            <div className="mt-2.5 space-y-2">
                                <Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t('requests.reasonPh')} maxLength={240} />
                                <div className="flex justify-end gap-2">
                                    <Button size="sm" variant="ghost" onClick={() => setDeclining(false)} disabled={busy}>
                                        {t('common.cancel')}
                                    </Button>
                                    <Button size="sm" variant="danger" icon={XIcon} loading={busy} onClick={() => onDecide(false, reason.trim() || null)}>
                                        {t('requests.decline')}
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            <div className="mt-2.5 flex flex-wrap justify-end gap-2">
                                <Button size="sm" variant="secondary" icon={XIcon} onClick={() => setDeclining(true)} disabled={busy}>
                                    {t('requests.decline')}
                                </Button>
                                <Button size="sm" icon={CheckIcon} loading={busy} onClick={() => onDecide(true, null)}>
                                    {conflicts > 0
                                        ? t('requests.approveRemoving', { n: conflicts })
                                        : item.type === 'role'
                                          ? t('mreq.giveRole')
                                          : freeText
                                            ? t('mreq.markDone')
                                            : t('requests.approve')}
                                </Button>
                            </div>
                        )
                    )}

                    {item.status === 'pending' && onWithdraw && (
                        <div className="mt-2 flex justify-end">
                            <Button size="sm" variant="ghost" onClick={onWithdraw} disabled={busy}>
                                {t('timeoff.withdraw')}
                            </Button>
                        </div>
                    )}
                </div>
            </div>
        </li>
    );
}
