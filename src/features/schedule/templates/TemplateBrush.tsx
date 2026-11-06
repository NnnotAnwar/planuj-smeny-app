import { GearSixIcon, PaintBrushIcon } from '@phosphor-icons/react';
import { useTranslation } from '@shared/preferences/PreferencesContext';
import type { ShiftTemplate } from './types';
import { tplTime } from './templateTime';

/**
 * --- TEMPLATE BRUSH (roster grid) ---
 * Picks what a tap on an empty grid cell puts down: an all-day shift or one of
 * the templates' times — paint a whole week of mornings in a few taps. "Manage"
 * opens the templates dialog. `value` is the chosen template id, null = all day.
 */
export function TemplateBrush({
    templates,
    value,
    onChange,
    onManage,
}: {
    templates: ShiftTemplate[];
    value: string | null;
    onChange: (id: string | null) => void;
    onManage: () => void;
}) {
    const t = useTranslation();
    const chip = (on: boolean) =>
        `inline-flex items-center gap-1 rounded-lg px-2 py-1 text-meta font-semibold transition-colors ${
            on
                ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/25'
                : 'bg-white/60 text-ink-soft ring-1 ring-ink/10 hover:text-ink dark:bg-white/5 dark:text-slate-300 dark:ring-white/10 dark:hover:text-white'
        }`;

    return (
        <div className="glass flex flex-wrap items-center gap-1.5 rounded-xl px-2.5 py-2">
            <span className="mr-0.5 flex items-center gap-1 text-eyebrow text-ink-soft dark:text-slate-400">
                <PaintBrushIcon weight="bold" className="size-3.5" />
                {t('tpl.brush')}
            </span>
            <button type="button" aria-pressed={value === null} onClick={() => onChange(null)} className={chip(value === null)}>
                {t('schedule.allDay')}
            </button>
            {templates.map((tpl) => (
                <button key={tpl.id} type="button" aria-pressed={value === tpl.id} onClick={() => onChange(tpl.id)} className={chip(value === tpl.id)}>
                    {tpl.name}
                    <span className={`tabular-nums ${value === tpl.id ? 'text-white/75' : 'text-ink-soft/70 dark:text-slate-500'}`}>
                        {tplTime(tpl.start_time)}–{tplTime(tpl.end_time)}
                    </span>
                </button>
            ))}
            <button
                type="button"
                onClick={onManage}
                className="ml-auto inline-flex items-center gap-1 rounded-lg px-2 py-1 text-meta font-semibold text-ink-soft transition-colors hover:bg-ink/5 hover:text-ink dark:text-slate-400 dark:hover:bg-white/8 dark:hover:text-white"
            >
                <GearSixIcon weight="bold" className="size-3.5" />
                {t('tpl.manage')}
            </button>
        </div>
    );
}
