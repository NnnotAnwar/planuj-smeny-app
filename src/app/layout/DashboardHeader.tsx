import { useEffect, useState } from 'react';
import { Clock } from '@shared/components/Clock';
import { useTranslation } from '@shared/preferences/PreferencesContext';
import { formatWeekdayDate } from '@shared/utils/date';
import type { TranslationKey } from '@shared/i18n/translations';

/**
 * --- DASHBOARD HEADER ---
 * Greeting + today's date on the left, the live wall clock on the right
 * (desktop; mobile already shows the clock in the top bar). The greeting follows
 * the time of day, so it re-evaluates every minute rather than only when the
 * page happens to re-render. Night hours greet "evening" — a 2 a.m. "good
 * morning" reads wrong to someone finishing a late shift.
 */
export function DashboardHeader({ firstName }: { firstName: string }) {
    const t = useTranslation();
    const [now, setNow] = useState(() => new Date());

    useEffect(() => {
        const id = setInterval(() => setNow(new Date()), 60_000);
        return () => clearInterval(id);
    }, []);

    const hour = now.getHours();
    const greetingKey: TranslationKey =
        hour >= 5 && hour < 12 ? 'home.greetingMorning' : hour >= 12 && hour < 18 ? 'home.greetingAfternoon' : 'home.greetingEvening';

    return (
        <header className="mb-4 flex items-end justify-between gap-4">
            <div className="min-w-0">
                <h1 className="text-greeting text-pretty text-ink dark:text-white">{t(greetingKey, { name: firstName })}</h1>
                <p className="mt-1 text-sm font-medium text-ink-soft first-letter:uppercase dark:text-slate-400">
                    {formatWeekdayDate(now)}
                </p>
            </div>
            <div className="glass hidden shrink-0 rounded-xl px-3 py-2 md:block">
                <Clock seconds className="text-clock text-ink dark:text-white" />
            </div>
        </header>
    );
}
