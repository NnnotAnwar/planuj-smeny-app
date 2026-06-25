import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CalendarBlankIcon, CaretDownIcon, CaretLeftIcon, CaretRightIcon } from '@phosphor-icons/react';

/**
 * --- DATE PICKER ---
 * Compact calendar popover styled to match {@link MonthPicker} / {@link TimePicker}.
 * `value` is a `"YYYY-MM-DD"` string in local time. Used by the shift editor when
 * adding a shift (so an admin can backdate it to the day actually worked).
 */

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DOW = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

const pad = (n: number) => String(n).padStart(2, '0');
const toStr = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;

interface DatePickerProps {
    value: string; // "YYYY-MM-DD"
    onChange: (value: string) => void;
    disabled?: boolean;
    'aria-label'?: string;
}

export function DatePicker({ value, onChange, disabled, ...rest }: DatePickerProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [dropUp, setDropUp] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    // Flip above the trigger when there isn't room below (keeps the calendar
    // on-screen inside the scrollable modal on phones).
    const toggle = () => {
        setIsOpen((prev) => {
            if (!prev && containerRef.current) {
                const rect = containerRef.current.getBoundingClientRect();
                setDropUp(window.innerHeight - rect.bottom < 340);
            }
            return !prev;
        });
    };

    const initial = value ? new Date(value + 'T00:00:00') : new Date();
    const [viewY, setViewY] = useState(initial.getFullYear());
    const [viewM, setViewM] = useState(initial.getMonth());

    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) setIsOpen(false);
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const label = value
        ? new Date(value + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
        : 'Pick a date';

    const prev = () => { if (viewM === 0) { setViewM(11); setViewY((y) => y - 1); } else setViewM((m) => m - 1); };
    const next = () => { if (viewM === 11) { setViewM(0); setViewY((y) => y + 1); } else setViewM((m) => m + 1); };

    const firstDow = (new Date(viewY, viewM, 1).getDay() + 6) % 7; // Mon = 0
    const daysInMonth = new Date(viewY, viewM + 1, 0).getDate();
    const cells: (number | null)[] = [...Array(firstDow).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];

    const today = new Date();

    return (
        <div className="relative" ref={containerRef}>
            <button
                type="button"
                disabled={disabled}
                aria-label={rest['aria-label']}
                onClick={toggle}
                className="flex w-full items-center justify-between gap-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2.5 shadow-sm transition-all active:scale-[0.98] disabled:opacity-40 disabled:active:scale-100"
            >
                <span className="flex items-center gap-2">
                    <CalendarBlankIcon weight="bold" className="w-4 h-4 text-emerald-500" />
                    <span className="text-body font-black text-gray-900 dark:text-white">{label}</span>
                </span>
                <CaretDownIcon weight="bold" className={`w-2.5 h-2.5 text-gray-400 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className={`absolute left-0 z-50 w-64 bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-xl p-3 ${
                            dropUp ? 'bottom-full mb-2' : 'top-full mt-2'
                        }`}
                    >
                        <div className="flex items-center justify-between mb-2 px-1">
                            <button type="button" onClick={prev} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors">
                                <CaretLeftIcon weight="bold" className="w-3 h-3 dark:text-white" />
                            </button>
                            <span className="font-black text-sm dark:text-white">{MONTHS[viewM]} {viewY}</span>
                            <button type="button" onClick={next} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors">
                                <CaretRightIcon weight="bold" className="w-3 h-3 dark:text-white" />
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
                                                : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'
                                        } ${isToday && !isSel ? 'ring-1 ring-inset ring-emerald-500/40 text-emerald-600 dark:text-emerald-400' : ''}`}
                                    >
                                        {d}
                                    </button>
                                );
                            })}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
