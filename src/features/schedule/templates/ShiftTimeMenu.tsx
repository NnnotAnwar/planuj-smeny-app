import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { BookmarkSimpleIcon, CheckIcon, SunHorizonIcon, TrashIcon } from '@phosphor-icons/react';
import { Button } from '@shared/components/Button';
import { useTranslation } from '@shared/preferences/PreferencesContext';
import type { ShiftTemplate } from './types';
import { MAX_TEMPLATES, templateFor, tplTime } from './templateTime';

/**
 * --- SHIFT TIME MENU ---
 * A small popover for one assignment, anchored to what was tapped (a roster
 * grid cell): switch it to all-day, stamp a template's times, type exact
 * times, save those times as a new template, or remove the shift. Fixed +
 * portalled so the scrolling grid can't clip it; flips above the anchor when
 * there's no room below.
 */

export interface ShiftTimeValue {
    allDay: boolean;
    start: string; // HH:MM
    end: string; // HH:MM
}

const MENU_W = 264;


export function ShiftTimeMenu({
    anchor,
    title,
    value,
    templates,
    busy,
    onPick,
    onSaveTemplate,
    onRemove,
    onClose,
}: {
    anchor: DOMRect;
    title: string;
    value: ShiftTimeValue;
    templates: ShiftTemplate[];
    busy?: boolean;
    onPick: (v: ShiftTimeValue) => void;
    /** Save the typed times as a template (named after them; rename in Manage). */
    onSaveTemplate?: (start: string, end: string) => void;
    onRemove?: () => void;
    onClose: () => void;
}) {
    const t = useTranslation();
    const [start, setStart] = useState(value.start);
    const [end, setEnd] = useState(value.end);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
        window.addEventListener('keydown', onKey);
        window.addEventListener('resize', onClose);
        return () => {
            window.removeEventListener('keydown', onKey);
            window.removeEventListener('resize', onClose);
        };
    }, [onClose]);

    const left = Math.min(Math.max(8, anchor.left), window.innerWidth - MENU_W - 8);
    const below = window.innerHeight - anchor.bottom > 320;
    const pos = below ? { top: anchor.bottom + 4 } : { bottom: window.innerHeight - anchor.top + 4 };

    const typedTemplate = templateFor(templates, start, end);
    const atLimit = templates.length >= MAX_TEMPLATES;
    const isActive = (tpl: ShiftTemplate) => !value.allDay && tplTime(tpl.start_time) === value.start && tplTime(tpl.end_time) === value.end;
    const rowClass =
        'flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-meta font-medium text-ink transition-colors hover:bg-ink/5 disabled:opacity-50 dark:text-slate-200 dark:hover:bg-white/8';
    const timeInput =
        'w-full min-w-0 rounded-lg border border-ink/10 bg-white/80 px-1.5 py-1 text-meta tabular-nums text-ink outline-none focus:border-emerald-500 dark:border-white/10 dark:bg-white/5 dark:text-white';

    return createPortal(
        <>
            <div className="fixed inset-0 z-90" onClick={onClose} />
            <div
                role="dialog"
                aria-label={title}
                style={{ position: 'fixed', left, width: MENU_W, ...pos }}
                className="glass glass-menu z-100 rounded-xl p-1.5"
            >
                <p className="truncate px-2 pb-1 pt-1 text-eyebrow text-ink-soft dark:text-slate-400">{title}</p>

                <button type="button" disabled={busy} onClick={() => onPick({ ...value, allDay: true })} className={rowClass}>
                    <SunHorizonIcon weight="bold" className="size-3.5 shrink-0 text-emerald-600 dark:text-emerald-300" />
                    <span className="flex-1">{t('schedule.allDay')}</span>
                    {value.allDay && <CheckIcon weight="bold" className="size-3.5 text-emerald-600 dark:text-emerald-300" />}
                </button>
                {templates.map((tpl) => (
                    <button
                        key={tpl.id}
                        type="button"
                        disabled={busy}
                        onClick={() => onPick({ allDay: false, start: tplTime(tpl.start_time), end: tplTime(tpl.end_time) })}
                        className={rowClass}
                    >
                        <BookmarkSimpleIcon weight="fill" className="size-3.5 shrink-0 text-emerald-600/70 dark:text-emerald-300/70" />
                        <span className="min-w-0 flex-1 truncate">{tpl.name}</span>
                        <span className="tabular-nums text-ink-soft dark:text-slate-400">
                            {tplTime(tpl.start_time)}–{tplTime(tpl.end_time)}
                        </span>
                        {isActive(tpl) && <CheckIcon weight="bold" className="size-3.5 text-emerald-600 dark:text-emerald-300" />}
                    </button>
                ))}

                {/* Exact times (+ save them as a template in one tap). */}
                <div className="mt-1 border-t border-ink/5 px-1 pt-2 dark:border-white/6">
                    <p className="mb-1 px-1 text-eyebrow text-ink-soft dark:text-slate-400">{t('schedule.setTime')}</p>
                    <div className="flex items-center gap-1">
                        <input type="time" value={start} onChange={(e) => setStart(e.target.value)} aria-label={t('shiftEditor.startTime')} className={timeInput} />
                        <span className="text-ink-soft">–</span>
                        <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} aria-label={t('shiftEditor.endTime')} className={timeInput} />
                        {onSaveTemplate && (
                            <button
                                type="button"
                                disabled={!!typedTemplate || atLimit || !start || !end}
                                onClick={() => onSaveTemplate(start, end)}
                                title={typedTemplate ? typedTemplate.name : atLimit ? t('tpl.limit') : t('tpl.save')}
                                aria-label={t('tpl.save')}
                                className="flex size-7 shrink-0 items-center justify-center rounded-lg text-emerald-600 transition-colors hover:bg-emerald-500/10 disabled:opacity-60 dark:text-emerald-300"
                            >
                                <BookmarkSimpleIcon weight={typedTemplate ? 'fill' : 'bold'} className="size-4" />
                            </button>
                        )}
                    </div>
                    {start && end && end <= start && <p className="mt-1 px-1 text-micro text-amber-500">{t('shiftEditor.overnight')}</p>}
                    <Button
                        size="sm"
                        fullWidth
                        className="mt-1.5"
                        loading={busy}
                        disabled={!start || !end}
                        onClick={() => onPick({ allDay: false, start, end })}
                    >
                        {t('common.save')}
                    </Button>
                </div>

                {onRemove && (
                    <div className="mt-1 border-t border-ink/5 pt-1 dark:border-white/6">
                        <button type="button" disabled={busy} onClick={onRemove} className={`${rowClass} text-rose-600! hover:bg-rose-500/10! dark:text-rose-400!`}>
                            <TrashIcon weight="bold" className="size-3.5 shrink-0" />
                            {t('schedule.deleteTitle')}
                        </button>
                    </div>
                )}
            </div>
        </>,
        document.body,
    );
}
