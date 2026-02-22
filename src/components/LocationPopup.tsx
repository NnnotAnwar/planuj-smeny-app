import { type Location } from '../types/types';

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

    const handleCancel = () => setIsLocationPopupOpen(false);

    const title = isSameLocation
        ? 'You are already at this location.'
        : isSwitch
            ? 'Change Location?'
            : 'Confirm Location?';
    const titleClass = isSameLocation
        ? 'text-red-600'
        : isSwitch
            ? 'text-amber-600'
            : 'text-emerald-600';

    return (
        <div className="fixed inset-0 z-100 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm transition-opacity p-0 sm:p-4">
            <div className="bg-white p-6 sm:rounded-2xl rounded-t-3xl shadow-xl w-full max-w-md transform transition-all sm:animate-none">
                <h2 className={`text-3xl md:text-2xl font-bold mb-4 ${titleClass}`}>{title}</h2>
                <h3 className="text-lg font-semibold text-gray-700">{location?.name}</h3>

                <div className="flex justify-end space-x-3 mt-6">
                    {selectedLocationId !== pendingLocationId ? (
                        <>
                            <button
                                type="button"
                                onClick={handleCancel}
                                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirm}
                                className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-md hover:bg-emerald-700 transition-colors shadow-sm"
                            >
                                Yes
                            </button>
                        </>
                    ) : (
                        <button
                            type="button"
                            onClick={handleConfirm}
                            className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-md hover:bg-emerald-700 transition-colors shadow-sm"
                        >
                            Confirm
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
