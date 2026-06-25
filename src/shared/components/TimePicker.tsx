import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ClockIcon, CaretDownIcon } from '@phosphor-icons/react';

/**
 * --- TIME PICKER ---
 * Compact hours:minutes selector styled to match {@link MonthPicker} — a pill
 * button that opens a popover with an Hours column and a Minutes column. Used by
 * the shift editor instead of the native `datetime-local` so only the time of a
 * shift can be changed (the date is held fixed by the caller).
 *
 * `value` is a `"HH:mm"` string (24-hour). Every minute (0–59) is selectable.
 */

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = Array.from({ length: 60 }, (_, i) => i);

const pad = (n: number) => String(n).padStart(2, '0');

interface TimePickerProps {
    value: string; // "HH:mm"
    onChange: (value: string) => void;
    disabled?: boolean;
    /** Optional id/aria label for the trigger button. */
    'aria-label'?: string;
}

export function TimePicker({ value, onChange, disabled, ...rest }: TimePickerProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [dropUp, setDropUp] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const hoursRef = useRef<HTMLDivElement>(null);
    const minutesRef = useRef<HTMLDivElement>(null);

    // Flip the popover above the trigger when there isn't room below it (keeps it
    // on-screen inside the scrollable modal on phones).
    const toggle = () => {
        setIsOpen((prev) => {
            if (!prev && containerRef.current) {
                const rect = containerRef.current.getBoundingClientRect();
                setDropUp(window.innerHeight - rect.bottom < 280);
            }
            return !prev;
        });
    };

    const [h, m] = value.split(':');
    const selHour = Number.isNaN(parseInt(h)) ? 0 : parseInt(h);
    const selMinute = Number.isNaN(parseInt(m)) ? 0 : parseInt(m);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // On open, center the selected hour/minute inside ITS OWN column only — set
    // the column's scrollTop directly. (scrollIntoView would bubble up and shift
    // the whole popover/modal, which looked like the popup "jumping".)
    useEffect(() => {
        if (!isOpen) return;
        const frame = requestAnimationFrame(() => {
            const center = (box: HTMLDivElement | null) => {
                const el = box?.querySelector<HTMLElement>('[data-selected="true"]');
                if (box && el) box.scrollTop = el.offsetTop - box.clientHeight / 2 + el.clientHeight / 2;
            };
            center(hoursRef.current);
            center(minutesRef.current);
        });
        return () => cancelAnimationFrame(frame);
    }, [isOpen]);

    const setHour = (hour: number) => onChange(`${pad(hour)}:${pad(selMinute)}`);
    const setMinute = (minute: number) => onChange(`${pad(selHour)}:${pad(minute)}`);

    const cellClass = (active: boolean) =>
        `w-full py-1.5 rounded-lg text-caption tabular-nums transition-all ${
            active
                ? 'bg-emerald-500 text-white shadow-md'
                : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400'
        }`;

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
                    <ClockIcon weight="bold" className="w-4 h-4 text-emerald-500" />
                    <span className="text-body font-black tabular-nums text-gray-900 dark:text-white">
                        {pad(selHour)}:{pad(selMinute)}
                    </span>
                </span>
                <CaretDownIcon
                    weight="bold"
                    className={`w-2.5 h-2.5 text-gray-400 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}
                />
            </button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className={`absolute left-0 z-50 w-44 bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-xl p-3 overflow-hidden ${
                            dropUp ? 'bottom-full mb-2' : 'top-full mt-2'
                        }`}
                    >
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <p className="text-micro text-gray-400 mb-1.5 px-1">Hour</p>
                                <div ref={hoursRef} className="max-h-44 overflow-y-auto overscroll-contain pr-1 space-y-0.5 scrollbar-hide">
                                    {HOURS.map((hour) => (
                                        <button
                                            key={hour}
                                            type="button"
                                            data-selected={hour === selHour}
                                            onClick={() => setHour(hour)}
                                            className={cellClass(hour === selHour)}
                                        >
                                            {pad(hour)}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <p className="text-micro text-gray-400 mb-1.5 px-1">Min</p>
                                <div ref={minutesRef} className="max-h-44 overflow-y-auto overscroll-contain pr-1 space-y-0.5 scrollbar-hide">
                                    {MINUTES.map((minute) => (
                                        <button
                                            key={minute}
                                            type="button"
                                            data-selected={minute === selMinute}
                                            onClick={() => setMinute(minute)}
                                            className={cellClass(minute === selMinute)}
                                        >
                                            {pad(minute)}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
