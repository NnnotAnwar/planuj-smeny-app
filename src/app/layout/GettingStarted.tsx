import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CheckIcon, MapPinIcon, PaperPlaneTiltIcon, CalendarPlusIcon, XIcon, type Icon } from '@phosphor-icons/react';
import { supabase } from '@shared/api/supabaseClient';
import { can, isSuperAdmin } from '@shared/auth/permissions';
import { useTranslation } from '@shared/preferences/PreferencesContext';
import type { User } from '@shared/types';

/**
 * --- GETTING STARTED (new organization owners) ---
 * After sign-up the owner lands on an empty Home. Three steps get a team
 * going: a location, people, a first planned week. Each ticks itself off from
 * real data; the card disappears once all are done (or when hidden).
 */

const hiddenKey = (uid: string) => `getting-started:hidden:${uid}`;
const readHidden = (uid: string) => {
    try {
        return localStorage.getItem(hiddenKey(uid)) === '1';
    } catch {
        return false;
    }
};

async function countOf(table: 'profiles' | 'scheduled_shifts', orgId: string) {
    const { count, error } = await supabase.from(table).select('id', { count: 'exact', head: true }).eq('organization_id', orgId);
    if (error) throw error;
    return count ?? 0;
}

export function GettingStarted({ user, locationCount }: { user: User; locationCount: number }) {
    const t = useTranslation();
    const [hidden, setHidden] = useState(() => readHidden(user.id));
    const eligible = can(user, 'locations.manage') && !isSuperAdmin(user) && !hidden;

    const counts = useQuery({
        queryKey: ['getting-started', user.organization_id],
        enabled: eligible,
        staleTime: 60_000,
        queryFn: async () => {
            const [people, shifts] = await Promise.all([countOf('profiles', user.organization_id), countOf('scheduled_shifts', user.organization_id)]);
            return { people, shifts };
        },
    });
    if (!eligible || !counts.data) return null;

    const steps: { done: boolean; icon: Icon; label: string; to: string }[] = [
        { done: locationCount > 0, icon: MapPinIcon, label: t('start.location'), to: '/admin?tab=locations' },
        { done: counts.data.people > 1, icon: PaperPlaneTiltIcon, label: t('start.invite'), to: '/admin' },
        { done: counts.data.shifts > 0, icon: CalendarPlusIcon, label: t('start.plan'), to: '/schedule' },
    ];
    if (steps.every((s) => s.done)) return null;
    const doneCount = steps.filter((s) => s.done).length;

    const hide = () => {
        setHidden(true);
        try {
            localStorage.setItem(hiddenKey(user.id), '1');
        } catch {
            /* storage unavailable — hidden for this session only */
        }
    };

    return (
        <section className="glass mb-4 rounded-2xl p-3 sm:p-4">
            <header className="mb-2 flex items-start justify-between gap-2 px-1">
                <div>
                    <h2 className="text-card-title text-ink dark:text-white">{t('start.title')}</h2>
                    <p className="text-caption text-ink-soft dark:text-slate-400">{t('start.sub', { done: doneCount, total: steps.length })}</p>
                </div>
                <button
                    type="button"
                    onClick={hide}
                    aria-label={t('start.hide')}
                    className="-mr-1 rounded-lg p-1.5 text-ink-soft transition-colors hover:bg-ink/5 hover:text-ink dark:text-slate-400 dark:hover:bg-white/8"
                >
                    <XIcon weight="bold" className="size-4" />
                </button>
            </header>
            <ol className="grid gap-1.5 sm:grid-cols-3">
                {steps.map(({ done, icon: StepIcon, label, to }) => (
                    <li key={label}>
                        <Link
                            to={to}
                            className={`flex min-h-11 items-center gap-2.5 rounded-xl px-2.5 py-2 text-meta font-semibold ring-1 transition-colors ${
                                done
                                    ? 'bg-emerald-500/8 text-emerald-700 ring-emerald-500/20 dark:text-emerald-300'
                                    : 'bg-white/55 text-ink ring-ink/5 hover:bg-white/80 dark:bg-white/4 dark:text-white dark:ring-white/6 dark:hover:bg-white/8'
                            }`}
                        >
                            <span
                                className={`flex size-7 shrink-0 items-center justify-center rounded-lg ${
                                    done ? 'bg-emerald-600 text-white' : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                                }`}
                            >
                                {done ? <CheckIcon weight="bold" className="size-3.5" /> : <StepIcon weight="bold" className="size-3.5" />}
                            </span>
                            <span className={done ? 'line-through decoration-emerald-600/40' : ''}>{label}</span>
                        </Link>
                    </li>
                ))}
            </ol>
        </section>
    );
}
