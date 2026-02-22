/**
 * LocationPopup Component
 * Modal dialog for confirming location selection or changes
 * Shows different messages depending on whether it's a new selection or location change
 */

/** Type definition for a restaurant location */
import { type Location } from '../types/types';

/** Props for the LocationPopup component */
interface LocationPopupProps {
    isChangedLocation: {
        selectedLocationId: string | null; // Currently selected location ID
        pendingLocationId: string | null;  // Location ID being selected in the popup
    };                                  // True if switching to a different location
    location: Location | null;                                   // The location being confirmed
    setIsLocationPopupOpen: (isOpen: boolean) => void;          // Callback to close the popup
    setSelectedLocationId: (id: string) => void;                // Callback to confirm location selection
    handleChangeLocation: (change: boolean) => void;                                      // Indicates if the user is changing locations
}


/**
 * LocationPopup component
 * Renders a modal for confirming location selection
 * Shows warning if user is changing from one location to another
 */
export default function LocationPopup({
    isChangedLocation,
    location,
    setIsLocationPopupOpen,
    setSelectedLocationId,
    handleChangeLocation
}: LocationPopupProps) {
    // const [changeShift, setChangeShift] = useState({
    //     isChanged: false,
    //     currentTime: '',
    // });
    /**
     * Confirms location selection and closes the popup
     * Updates the parent component's selectedLocationId state
     */
    const handleConfirm = () => {
        // Only proceed if location data is available
        if (location?.id) {
            // Set this location as the selected one
            setSelectedLocationId(location.id);
            // Close the popup
            setIsLocationPopupOpen(false);
        }
        if (changeLocation) {
            handleChangeLocation(true);
        } // Indicate that a location change is occurring       }
    };

    /**
     * Cancels location selection and closes the popup
     * Does not update the selected location
     */
    const handleCancel = () => {
        // Simply close the popup without making changes
        setIsLocationPopupOpen(false);
    };

    const changeLocation = isChangedLocation.selectedLocationId && isChangedLocation.pendingLocationId



    return (
        // ===== MODAL OVERLAY ===== 
        // Fixed position backdrop with dark semi-transparent overlay
        <div className='fixed inset-0 z-100 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm transition-opacity p-0 sm:p-4'>
            {/* ===== MODAL CONTENT BOX ===== */}
            <div className="bg-white p-6 sm:rounded-2xl rounded-t-3xl shadow-xl w-full max-w-md transform transition-all sm:animate-none">
                {/* ===== DYNAMIC TITLE ===== */}
                {/* Shows different title based on whether this is a new selection or a location change */}
                {
                    changeLocation
                        && isChangedLocation.selectedLocationId !== isChangedLocation.pendingLocationId
                        ? <h2 className="text-3xl md:text-2xl font-bold text-amber-600 mb-4">Change Location?</h2>
                        : changeLocation && isChangedLocation.selectedLocationId === isChangedLocation.pendingLocationId
                            ? <h2 className="text-2xl font-bold text-red-600 mb-4">You are already at this location.</h2>
                            : <h2 className="text-3xl md:text-2xl font-bold text-emerald-600 mb-4">Confirm Location?</h2>


                }
                {/* ===== LOCATION NAME ===== */}
                <h3 className="text-lg font-semibold text-gray-700">{location?.name}</h3>

                {/* ===== ACTION BUTTONS ===== */}
                <div className="flex justify-end space-x-3 mt-6">
                    {isChangedLocation.selectedLocationId !== isChangedLocation.pendingLocationId
                        ?
                        (<>
                            <button
                                onClick={handleCancel}
                                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleConfirm}
                                className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-md hover:bg-emerald-700 transition-colors shadow-sm"
                            >
                                Yes
                            </button>
                        </>)
                        : (
                            <button
                                onClick={handleConfirm}
                                className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-md hover:bg-emerald-700 transition-colors shadow-sm"
                            >
                                Confirm
                            </button>
                        )}
                </div>
            </div>
        </div >
    )
}
