import { type Location } from '../types/types';
import { motion, type Variants } from 'framer-motion';

/** Tells popup whether user is confirming a new location or switching from another. */
export interface LocationPopupProps {
    isChangedLocation: {
        selectedLocationId: string | null;
        pendingLocationId: string | null;
    };
    location: Location | null;
    setIsLocationPopupOpen: (open: boolean) => void;
    setSelectedLocationId: (id: string) => void;
    handleChangeLocation: (change: boolean) => void;
}

/**
 * Modal to confirm location choice or location change.
 * Titles and actions differ for "confirm", "change?" and "already at this location".
 */
export default function LocationPopup({
    isChangedLocation,
    location,
    setIsLocationPopupOpen,
    setSelectedLocationId,
    handleChangeLocation,
}: LocationPopupProps) {
    const { selectedLocationId, pendingLocationId } = isChangedLocation;
    const isSwitch = selectedLocationId != null && pendingLocationId != null;
    const isSameLocation = selectedLocationId === pendingLocationId;

    const handleConfirm = () => {
        if (!location?.id) return;
        setSelectedLocationId(location.id);
        setIsLocationPopupOpen(false);
        if (isSwitch && selectedLocationId !== pendingLocationId) {
            handleChangeLocation(true);
        }
    };

    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

    const popupVariants: Variants = {
        hidden: isMobile
            ? { y: "100%", opacity: 0.5 }
            : { scale: 0.9, opacity: 0, y: 0 },
        visible: {
            y: 0, scale: 1, opacity: 1,
            transition: { type: "spring", bounce: 0.3, duration: 0.5 }
        },
        exit: isMobile
            ? { y: "100%", opacity: 0, transition: { duration: 0.2, ease: "easeIn" } }
            : { scale: 0.9, opacity: 0, transition: { duration: 0.2, ease: "easeIn" } }
    };

    const handleCancel = () => setIsLocationPopupOpen(false);

    const title = isSameLocation
        ? 'You are already at this location.'
        : isSwitch
            ? 'Change Location?'
            : 'Confirm Location?';
    const titleClass = isSameLocation
        ? 'text-red-600 dark:text-red-400'
        : isSwitch
            ? 'text-amber-600 dark:text-amber-400'
            : 'text-emerald-600 dark:text-emerald-400';

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-100 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4"
            onClick={() => setIsLocationPopupOpen(false)}
        >
            <motion.div
                variants={popupVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                onClick={(e) => e.stopPropagation()}
                className="bg-white dark:bg-gray-900 p-6 sm:rounded-2xl rounded-t-3xl shadow-xl w-full max-w-md transition-colors"
            >
                <h2 className={`text-3xl md:text-2xl font-bold mb-4 ${titleClass}`}>{title}</h2>
                <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300">{location?.name}</h3>

                <div className="flex justify-end space-x-3 mt-6">
                    {selectedLocationId !== pendingLocationId ? (
                        <>
                            <button
                                type="button"
                                onClick={handleCancel}
                                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirm}
                                className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-md hover:bg-emerald-700 transition-colors shadow-sm cursor-pointer"
                            >
                                Yes
                            </button>
                        </>
                    ) : (
                        <button
                            type="button"
                            onClick={handleConfirm}
                            className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-md hover:bg-emerald-700 transition-colors shadow-sm cursor-pointer"
                        >
                            Confirm
                        </button>
                    )}
                </div>
            </motion.div>
        </motion.div>
    );
}
