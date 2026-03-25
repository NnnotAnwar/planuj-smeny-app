import { useState } from 'react';
import { type Location, type Shift } from '@shared/types';

/**
 * --- USE LOCATION MANAGEMENT ---
 * This custom hook handles the logic of selecting a location.
 * 
 * Logic:
 * 1. If a user clicks a location they are already at, show the popup.
 * 2. If they click a new location, show a confirmation popup (PendingLocation).
 */

interface UseLocationManagementProps {
  locations: Location[];
  activeShift: Shift | null;
  selectedLocationId: string | null;
  setSelectedLocationId: (id: string | null) => void;
}


export function useLocationManagement({
  locations,
  activeShift,
  selectedLocationId,
  setSelectedLocationId,
}: UseLocationManagementProps) {
  const [isLocationPopupOpen, setIsLocationPopupOpen] = useState(false);
  const [pendingLocation, setPendingLocation] = useState<Location | null>(null);

  /**
   * Called when a user clicks a location button in the list.
   */
  const handleLocationSelect = (locationId: string | null) => {
    // 1. Same location clicked
    if (locationId === selectedLocationId) {
      if (activeShift) {
        setIsLocationPopupOpen(true); // Let them know they are already here.
      } else {
        setSelectedLocationId(null); // Deselect if no active shift.
      }
      return;
    }

    // 2. Different location clicked
    const selected = locations.find((loc) => loc.id === locationId);
    if (!selected) return;

    setPendingLocation(selected); // Store it temporarily to show in the popup.
    setIsLocationPopupOpen(true); // Ask for confirmation.
  };

  const closeLocationPopup = () => {
    setIsLocationPopupOpen(false);
    setPendingLocation(null);
  };

  return {
    isLocationPopupOpen,
    setIsLocationPopupOpen,
    pendingLocation,
    handleLocationSelect,
    closeLocationPopup,
  };
}
