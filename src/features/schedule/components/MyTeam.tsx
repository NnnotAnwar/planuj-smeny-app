import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { UsersThreeIcon, XIcon, PlusIcon } from '@phosphor-icons/react';
import type { Profile } from '@shared/types';
import { useTranslation } from '@shared/preferences/PreferencesContext';
import { Button } from '@shared/components/Button';
import { Select } from '@shared/components/Select';
import { toast } from '@shared/toast/toastStore';
import { scheduleService } from '../scheduleService';

/**
 * --- MY TEAM ---
 * Manager self-service: take free (unassigned) members of the organization
 * into your team and release your own. Team membership is what scopes who a
 * manager can plan in the rota; authorization lives in the claim_member RPC.
 */
export function MyTeam({ members, userId, userRank }: { members: Profile[]; userId: string; userRank: number }) {
    const t = useTranslation();
    const qc = useQueryClient();
    const [pick, setPick] = useState('');

    const myTeam = members.filter((m) => m.manager_id === userId);
    const free = members.filter((m) => !m.manager_id && m.id !== userId && m.role.rank < userRank);

    const claimM = useMutation({
        mutationFn: ({ id, claim }: { id: string; claim: boolean }) => scheduleService.claimMember(id, claim),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['schedule-members'] }),
        onError: (err) => toast(err instanceof Error ? err.message : t('common.actionFailed'), 'error'),
    });

    const name = (m: Profile) => [m.first_name, m.last_name].filter(Boolean).join(' ') || m.username;

    return (
        <section className="rounded-3xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900/40 shadow-sm p-4 space-y-3">
            <div className="flex items-center gap-2.5">
                <span className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                    <UsersThreeIcon weight="fill" className="w-4 h-4" />
                </span>
                <p className="text-body-strong text-gray-900 dark:text-white">
                    {t('schedule.myTeam')} <span className="text-gray-400 font-normal">· {myTeam.length}</span>
                </p>
            </div>

            {myTeam.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                    {myTeam.map((m) => (
                        <span
                            key={m.id}
                            className="inline-flex items-center gap-1 rounded-full bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 pl-3 pr-1.5 py-1 text-small-strong"
                        >
                            {name(m)}
                            <button
                                onClick={() => claimM.mutate({ id: m.id, claim: false })}
                                aria-label={t('schedule.release')}
                                title={t('schedule.release')}
                                className="p-0.5 rounded-full hover:bg-emerald-200/70 dark:hover:bg-emerald-800/50 transition-colors"
                            >
                                <XIcon weight="bold" className="w-3 h-3" />
                            </button>
                        </span>
                    ))}
                </div>
            )}

            {free.length > 0 ? (
                <div className="flex items-center gap-2">
                    <div className="flex-1 min-w-0">
                        <Select size="sm" value={pick} onChange={(e) => setPick(e.target.value)} placeholder={t('schedule.freePick')}>
                            <option value="">{t('schedule.freePick')}</option>
                            {free.map((m) => (
                                <option key={m.id} value={m.id}>
                                    {name(m)}
                                </option>
                            ))}
                        </Select>
                    </div>
                    <Button
                        size="sm"
                        icon={PlusIcon}
                        disabled={!pick}
                        loading={claimM.isPending}
                        onClick={() => {
                            if (!pick) return;
                            claimM.mutate({ id: pick, claim: true });
                            setPick('');
                        }}
                    >
                        {t('schedule.take')}
                    </Button>
                </div>
            ) : (
                myTeam.length === 0 && <p className="text-caption text-gray-400">{t('schedule.noFree')}</p>
            )}
        </section>
    );
}
