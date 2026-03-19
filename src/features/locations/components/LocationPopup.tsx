import React from 'react';
import { motion, type Variants } from 'framer-motion';
import { type Location } from '@shared/types';
import { useShiftContext } from '@features/shifts/ShiftContext';

/**
 * --- LOCATION POPUP COMPONENT ---
 * Modal to confirm location choice or location change.
 * This popup asks the user: "Are you sure you want to select [Location Name]?"
 */

export interface LocationPopupProps {
    isChangedLocation: {
        selectedLocationId: string | null;
        pendingLocationId: string | null;
    };
    location: Location | null;
    setIsLocationPopupOpen: (open: boolean) => void;
    setSelectedLocationId: React.Dispatch<React.SetStateAction<string | null>>;
    handleChangeLocation: (change: boolean) => void;
}

export function LocationPopup({
    isChangedLocation,
    location,
    setIsLocationPopupOpen,
    setSelectedLocationId,
    handleChangeLocation,
}: LocationPopupProps) {
    const { activeShift, handleChangeLocation: updateShiftLocation, isChangingLocation } = useShiftContext();
    const { selectedLocationId, pendingLocationId } = isChangedLocation;
    
    // logic variables to determine the state
    const isSwitch = selectedLocationId != null && pendingLocationId != null;
    const isSameLocation = selectedLocationId === pendingLocationId;

    const handleConfirm = async () => {
        if (!location?.id) return;
        
        // If we have an active shift, we MUST update it on the server too.
        if (activeShift && isSwitch && selectedLocationId !== pendingLocationId) {
            await updateShiftLocation(location.id);
        } else {
            // Otherwise just update the frontend selection.
            setSelectedLocationId(location.id);
        }
        
        // 2. Close the modal.
        setIsLocationPopupOpen(false);

        // 3. Optional: Trigger specific "location changed" logic.
        if (isSwitch && selectedLocationId !== pendingLocationId) {
            handleChangeLocation(true);
        }
    };

    const handleCancel = () => setIsLocationPopupOpen(false);

    // Determine titles and colors based on whether we are selecting for the first time or switching.
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
            onClick={handleCancel}
        >
            <motion.div
                variants={popupVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                onClick={(e) => e.stopPropagation()} // Stop click from bubbling to the backdrop (so it doesn't close)
                className="bg-white dark:bg-gray-900 p-6 sm:rounded-2xl rounded-t-3xl shadow-xl w-full max-w-md transition-colors"
            >
                <h2 className={`text-3xl md:text-2xl font-bold mb-4 ${titleClass}`}>{title}</h2>
                <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300">{location?.name}</h3>

                <div className="flex justify-end space-x-3 mt-6">
                    {!isSameLocation ? (
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
                                disabled={isChangingLocation}
                                className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-md hover:bg-emerald-700 transition-colors shadow-sm cursor-pointer disabled:opacity-50"
                            >
                                {isChangingLocation ? 'Updating...' : 'Yes'}
                            </button>
                        </>
                    ) : (
                        <button
                            type="button"
                            onClick={handleCancel}
                            className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-md hover:bg-emerald-700 transition-colors shadow-sm cursor-pointer"
                        >
                            Got it
                        </button>
                    )}
                </div>
            </motion.div>
        </motion.div>
    );
}
