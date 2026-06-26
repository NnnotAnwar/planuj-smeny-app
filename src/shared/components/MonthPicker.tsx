import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CalendarBlankIcon, CaretDownIcon, CaretLeftIcon, CaretRightIcon } from '@phosphor-icons/react';
import { useTranslation } from '@shared/preferences/PreferencesContext';
import { monthShort } from '@shared/utils/date';

/**
 * --- MONTH PICKER ---
 * Compact month selector with an "All Time" option. `value` is a `YYYY-MM`
 * string, or `null` for all-time. Shared by Overview and Timesheets.
 */

interface MonthPickerProps {
    value: string | null;
    onChange: (value: string | null) => void;
}

export function MonthPicker({ value, onChange }: MonthPickerProps) {
    const t = useTranslation();
    const MONTHS = Array.from({ length: 12 }, (_, i) => monthShort(new Date(2024, i, 1)));
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const today = new Date();
    const currentMonthStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;

    const [viewYear, setViewYear] = useState(() =>
        value ? parseInt(value.split('-')[0]) : today.getFullYear(),
    );

    const selectedYear = value ? parseInt(value.split('-')[0]) : null;
    const selectedMonthIdx = value ? parseInt(value.split('-')[1]) - 1 : null;

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleMonthClick = (idx: number) => {
        const monthStr = String(idx + 1).padStart(2, '0');
        onChange(`${viewYear}-${monthStr}`);
        setIsOpen(false);
    };

    const label = value ? `${MONTHS[selectedMonthIdx!]} ${selectedYear}` : t('month.allTime');

    return (
        <div className="relative" ref={containerRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 bg-white dark:bg-gray-800 px-3 py-1.5 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm active:scale-95 transition-all"
            >
                <CalendarBlankIcon weight="bold" className="w-3.5 h-3.5 text-emerald-500" />
                <span className="text-xs font-black dark:text-white min-w-[70px] text-left truncate">{label}</span>
                <CaretDownIcon
                    weight="bold"
                    className={`w-2.5 h-2.5 text-gray-400 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}
                />
            </button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 8, scale: 0.95 }}
                        animate={{ opacity: 1, y: 4, scale: 1 }}
                        exit={{ opacity: 0, y: 8, scale: 0.95 }}
                        className="absolute right-0 top-full z-50 w-52 bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-xl p-3 overflow-hidden"
                    >
                        <div className="flex items-center justify-between mb-3 px-1">
                            <button onClick={() => setViewYear((v) => v - 1)} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors">
                                <CaretLeftIcon weight="bold" className="w-3 h-3 dark:text-white" />
                            </button>
                            <span className="font-black text-sm dark:text-white">{viewYear}</span>
                            <button onClick={() => setViewYear((v) => v + 1)} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors">
                                <CaretRightIcon weight="bold" className="w-3 h-3 dark:text-white" />
                            </button>
                        </div>

                        <div className="grid grid-cols-3 gap-1.5">
                            {MONTHS.map((month, idx) => {
                                const isSelected = selectedYear === viewYear && selectedMonthIdx === idx;
                                const isCurrent = today.getFullYear() === viewYear && today.getMonth() === idx;
                                return (
                                    <button
                                        key={idx}
                                        onClick={() => handleMonthClick(idx)}
                                        className={`relative py-1.5 rounded-lg text-caption transition-all ${
                                            isSelected ? 'bg-emerald-500 text-white shadow-md' : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400'
                                        } ${isCurrent && !isSelected ? 'ring-1 ring-inset ring-emerald-500/30 text-emerald-600 dark:text-emerald-400' : ''}`}
                                    >
                                        {month}
                                        {isCurrent && <span className={`absolute top-0.5 right-1 w-1 h-1 rounded-full ${isSelected ? 'bg-white' : 'bg-emerald-500'}`} />}
                                    </button>
                                );
                            })}
                        </div>

                        <div className="mt-3 pt-2 border-t border-gray-50 dark:border-gray-800 flex gap-1.5">
                            <button onClick={() => { setViewYear(today.getFullYear()); onChange(currentMonthStr); setIsOpen(false); }} className="flex-1 py-1.5 rounded-lg text-micro bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 transition-colors">{t('common.today')}</button>
                            <button onClick={() => { onChange(null); setIsOpen(false); }} className={`flex-1 py-1.5 rounded-lg text-micro transition-colors ${value === null ? 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white' : 'text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'}`}>{t('common.all')}</button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
