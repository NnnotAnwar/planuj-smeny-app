import { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { CalendarBlankIcon, CaretDownIcon, CaretLeftIcon, CaretRightIcon } from '@phosphor-icons/react';
import { useTranslation } from '@shared/preferences/PreferencesContext';
import { monthLong, formatDateLong, weekdayShortLabels } from '@shared/utils/date';

/**
 * --- DATE PICKER ---
 * Calendar popover, rendered in a portal with fixed positioning clamped to the
 * viewport (flips above the trigger when needed), so it can't be clipped by or
 * pushed off a scrollable modal / its header on phones. `value` is
 * `"YYYY-MM-DD"` (local).
 */

const POP_W = 256; // w-64
const MARGIN = 8;

const pad = (n: number) => String(n).padStart(2, '0');
const toStr = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;

interface DatePickerProps {
    value: string; // "YYYY-MM-DD"
    onChange: (value: string) => void;
    disabled?: boolean;
    'aria-label'?: string;
}

export function DatePicker({ value, onChange, disabled, ...rest }: DatePickerProps) {
    const t = useTranslation();
    const DOW = weekdayShortLabels();
    const [isOpen, setIsOpen] = useState(false);
    const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const popRef = useRef<HTMLDivElement>(null);

    const initial = value ? new Date(value + 'T00:00:00') : new Date();
    const [viewY, setViewY] = useState(initial.getFullYear());
    const [viewM, setViewM] = useState(initial.getMonth());

    const place = useCallback(() => {
        const trigger = triggerRef.current;
        if (!trigger) return;
        const r = trigger.getBoundingClientRect();
        const ph = popRef.current?.offsetHeight ?? 330;
        const left = Math.max(MARGIN, Math.min(r.left, window.innerWidth - POP_W - MARGIN));
        let top: number;
        if (r.bottom + 6 + ph <= window.innerHeight - MARGIN) top = r.bottom + 6;
        else if (r.top - 6 - ph >= MARGIN) top = r.top - 6 - ph;
        else top = Math.max(MARGIN, window.innerHeight - ph - MARGIN);
        setPos({ top, left });
    }, []);

    useEffect(() => {
        if (!isOpen) return;
        function onDown(e: MouseEvent) {
            const t = e.target as Node;
            if (triggerRef.current?.contains(t) || popRef.current?.contains(t)) return;
            setIsOpen(false);
        }
        const onMove = () => place();
        document.addEventListener('mousedown', onDown);
        window.addEventListener('resize', onMove);
        window.addEventListener('scroll', onMove, true);
        return () => {
            document.removeEventListener('mousedown', onDown);
            window.removeEventListener('resize', onMove);
            window.removeEventListener('scroll', onMove, true);
        };
    }, [isOpen, place]);

    useLayoutEffect(() => {
        if (!isOpen) return;
        place();
    }, [isOpen, place, viewY, viewM]);

    const label = value
        ? formatDateLong(value)
        : t('common.pickDate');

    const prev = () => { if (viewM === 0) { setViewM(11); setViewY((y) => y - 1); } else setViewM((m) => m - 1); };
    const next = () => { if (viewM === 11) { setViewM(0); setViewY((y) => y + 1); } else setViewM((m) => m + 1); };

    const firstDow = (new Date(viewY, viewM, 1).getDay() + 6) % 7; // Mon = 0
    const daysInMonth = new Date(viewY, viewM + 1, 0).getDate();
    const cells: (number | null)[] = [...Array(firstDow).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];

    const today = new Date();

    return (
        <>
            <button
                ref={triggerRef}
                type="button"
                disabled={disabled}
                aria-label={rest['aria-label']}
                onClick={() => setIsOpen((v) => !v)}
                className="flex w-full items-center justify-between gap-2 rounded-xl border border-ink/10 bg-white/70 hover:bg-white dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/8 px-3 py-2 transition-all active:scale-[0.98] disabled:opacity-40 disabled:active:scale-100"
            >
                <span className="flex items-center gap-2">
                    <CalendarBlankIcon weight="bold" className="size-4 text-emerald-500" />
                    <span className="text-sm font-semibold text-ink dark:text-white">{label}</span>
                </span>
                <CaretDownIcon weight="bold" className={`w-2.5 h-2.5 text-gray-400 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen &&
                createPortal(
                    <motion.div
                        ref={popRef}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        style={{
                            position: 'fixed',
                            top: pos?.top ?? 0,
                            left: pos?.left ?? 0,
                            visibility: pos ? 'visible' : 'hidden',
                        }}
                        className="glass glass-menu z-70 w-64 rounded-2xl p-2.5"
                    >
                        <div className="flex items-center justify-between mb-2 px-1">
                            <button type="button" onClick={prev} className="p-1.5 hover:bg-ink/5 dark:hover:bg-white/8 rounded-lg transition-colors">
                                <CaretLeftIcon weight="bold" className="size-3 text-ink dark:text-white" />
                            </button>
                            <span className="font-display font-bold text-sm text-ink dark:text-white">{monthLong(new Date(viewY, viewM, 1))} {viewY}</span>
                            <button type="button" onClick={next} className="p-1.5 hover:bg-ink/5 dark:hover:bg-white/8 rounded-lg transition-colors">
                                <CaretRightIcon weight="bold" className="size-3 text-ink dark:text-white" />
                            </button>
                        </div>

                        <div className="grid grid-cols-7 gap-0.5 mb-1">
                            {DOW.map((d) => (
                                <span key={d} className="text-micro text-gray-400 text-center py-1">{d}</span>
                            ))}
                        </div>

                        <div className="grid grid-cols-7 gap-0.5">
                            {cells.map((d, i) => {
                                if (d === null) return <span key={`e${i}`} />;
                                const ds = toStr(viewY, viewM, d);
                                const isSel = ds === value;
                                const isToday = today.getFullYear() === viewY && today.getMonth() === viewM && today.getDate() === d;
                                return (
                                    <button
                                        key={ds}
                                        type="button"
                                        onClick={() => { onChange(ds); setIsOpen(false); }}
                                        className={`py-1.5 rounded-lg text-caption tabular-nums transition-all ${
                                            isSel
                                                ? 'bg-emerald-500 text-white shadow-md'
                                                : 'hover:bg-ink/5 dark:hover:bg-white/8 text-gray-700 dark:text-gray-300'
                                        } ${isToday && !isSel ? 'ring-1 ring-inset ring-emerald-500/40 text-emerald-600 dark:text-emerald-400' : ''}`}
                                    >
                                        {d}
                                    </button>
                                );
                            })}
                        </div>
                    </motion.div>,
                    document.body,
                )}
        </>
    );
}
