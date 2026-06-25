import { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { ClockIcon, CaretDownIcon } from '@phosphor-icons/react';

/**
 * --- TIME PICKER ---
 * Compact hours:minutes selector. The popover is rendered in a portal with fixed
 * positioning clamped to the viewport (and flipped above the trigger when needed),
 * so it can't be clipped by — or pushed off the bottom of — a scrollable modal or
 * its header on phones.
 *
 * `value` is a `"HH:mm"` string (24-hour). Every minute (0–59) is selectable.
 */

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = Array.from({ length: 60 }, (_, i) => i);
const POP_W = 176; // w-44
const MARGIN = 8;

const pad = (n: number) => String(n).padStart(2, '0');

interface TimePickerProps {
    value: string; // "HH:mm"
    onChange: (value: string) => void;
    disabled?: boolean;
    'aria-label'?: string;
}

export function TimePicker({ value, onChange, disabled, ...rest }: TimePickerProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const popRef = useRef<HTMLDivElement>(null);
    const hoursRef = useRef<HTMLDivElement>(null);
    const minutesRef = useRef<HTMLDivElement>(null);

    const [h, m] = value.split(':');
    const selHour = Number.isNaN(parseInt(h)) ? 0 : parseInt(h);
    const selMinute = Number.isNaN(parseInt(m)) ? 0 : parseInt(m);

    // Place the portal popover relative to the trigger, clamped on-screen and
    // flipped above when there isn't room below.
    const place = useCallback(() => {
        const trigger = triggerRef.current;
        if (!trigger) return;
        const r = trigger.getBoundingClientRect();
        const ph = popRef.current?.offsetHeight ?? 240;
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

    // Measure + place once mounted, then center each column on its selection.
    useLayoutEffect(() => {
        if (!isOpen) return;
        place();
        const frame = requestAnimationFrame(() => {
            const center = (box: HTMLDivElement | null) => {
                const el = box?.querySelector<HTMLElement>('[data-selected="true"]');
                if (box && el) box.scrollTop = el.offsetTop - box.clientHeight / 2 + el.clientHeight / 2;
            };
            center(hoursRef.current);
            center(minutesRef.current);
        });
        return () => cancelAnimationFrame(frame);
    }, [isOpen, place]);

    const setHour = (hour: number) => onChange(`${pad(hour)}:${pad(selMinute)}`);
    const setMinute = (minute: number) => onChange(`${pad(selHour)}:${pad(minute)}`);

    const cellClass = (active: boolean) =>
        `w-full py-1.5 rounded-lg text-caption tabular-nums transition-all ${
            active
                ? 'bg-emerald-500 text-white shadow-md'
                : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400'
        }`;

    return (
        <>
            <button
                ref={triggerRef}
                type="button"
                disabled={disabled}
                aria-label={rest['aria-label']}
                onClick={() => setIsOpen((v) => !v)}
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
                        className="z-[70] w-44 bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-2xl p-3 overflow-hidden"
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
                    </motion.div>,
                    document.body,
                )}
        </>
    );
}
