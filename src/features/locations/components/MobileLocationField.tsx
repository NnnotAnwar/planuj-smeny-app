import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { MapPinIcon, CaretUpDownIcon, XIcon } from '@phosphor-icons/react';
import { type Location } from '@shared/types';
import { useTranslation } from '@shared/preferences/PreferencesContext';
import { useRecentLocations } from '../useRecentLocations';
import { useBackHandler } from '@shared/hooks/useBackHandler';
import { haptics } from '@shared/utils/haptics';
import { LocationPicker } from './LocationPicker';

/**
 * --- MOBILE LOCATION FIELD ---
 * The phone equivalent of the desktop sidebar popover: a compact trigger that
 * opens a bottom sheet with the shared LocationPicker. Replaces the old tile
 * grid, which didn't scale past a handful of locations.
 */

interface MobileLocationFieldProps {
    locations: Location[];
    selectedLocationId: string | null;
    isOnShift: boolean;
    onLocationSelect: (locationId: string) => void;
}

export function MobileLocationField({
    locations,
    selectedLocationId,
    isOnShift,
    onLocationSelect,
}: MobileLocationFieldProps) {
    const t = useTranslation();
    const { recentIds, recordPick } = useRecentLocations();
    const [open, setOpen] = useState(false);

    const selected = locations.find((l) => l.id === selectedLocationId);

    useBackHandler(open, () => setOpen(false));

    // Lock body scroll while the sheet is open.
    useEffect(() => {
        document.body.style.overflow = open ? 'hidden' : 'unset';
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [open]);

    const handleSelect = (id: string) => {
        haptics.light();
        recordPick(id);
        onLocationSelect(id);
        setOpen(false);
    };

    return (
        <>
            <button
                onClick={() => setOpen(true)}
                aria-expanded={open}
                className="w-full flex items-center gap-3 p-3 rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-gray-800 dark:text-slate-200 shadow-sm active:scale-[0.99] transition-all"
            >
                <span className="shrink-0 w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                    <MapPinIcon weight="fill" className="w-4 h-4" />
                </span>
                <span className="flex-1 min-w-0 text-left">
                    <span className="block text-micro uppercase tracking-wider text-gray-400 dark:text-slate-500">
                        {isOnShift ? t('location.change') : t('sidebar.availablePosts')}
                    </span>
                    <span className="block text-small-strong truncate">
                        {selected ? selected.name : t('location.select')}
                    </span>
                </span>
                <CaretUpDownIcon className="w-4 h-4 shrink-0 text-gray-400" />
            </button>

            <AnimatePresence>
                {open && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setOpen(false)}
                            className="fixed inset-0 z-70 bg-black/40 backdrop-blur-sm md:hidden"
                        />
                        <motion.div
                            initial={{ y: '100%' }}
                            animate={{ y: 0 }}
                            exit={{ y: '100%' }}
                            transition={{ type: 'spring', stiffness: 360, damping: 36 }}
                            className="fixed inset-x-0 bottom-0 z-71 md:hidden flex flex-col max-h-[78vh] rounded-t-3xl bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-white/10 pb-[env(safe-area-inset-bottom,0px)]"
                        >
                            <div className="flex items-center justify-between px-4 pt-3 pb-2 shrink-0">
                                <div className="mx-auto absolute left-1/2 -translate-x-1/2 top-1.5 h-1 w-10 rounded-full bg-gray-300 dark:bg-white/15" />
                                <h2 className="text-body-strong text-gray-900 dark:text-white">
                                    {isOnShift ? t('location.change') : t('location.select')}
                                </h2>
                                <button
                                    onClick={() => setOpen(false)}
                                    aria-label={t('common.close')}
                                    className="-mr-1 p-1.5 rounded-xl text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 active:scale-90 transition-all"
                                >
                                    <XIcon weight="bold" className="w-5 h-5" />
                                </button>
                            </div>
                            <div className="flex-1 min-h-0 px-3 pb-3">
                                <LocationPicker
                                    locations={locations}
                                    selectedLocationId={selectedLocationId}
                                    recentIds={recentIds}
                                    isOnShift={isOnShift}
                                    onSelect={handleSelect}
                                />
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </>
    );
}
