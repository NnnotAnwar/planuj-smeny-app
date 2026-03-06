import { useState } from 'react';
import { type Location } from '../types/types';
import { type Shift } from '../types/types';

interface UseLocationManagementProps {
  locations: Location[];
  activeShift: Shift | null;
  selectedLocationId: string | null;
  setSelectedLocationId: (id: string | null) => void;
}

/**
 * Hook to manage location selection and confirmation logic.
 */
export function useLocationManagement({
  locations,
  activeShift,
  selectedLocationId,
  setSelectedLocationId,
}: UseLocationManagementProps) {
  const [isLocationPopupOpen, setIsLocationPopupOpen] = useState(false);
  const [pendingLocation, setPendingLocation] = useState<Location | null>(null);

  const handleLocationSelect = (locationId: string | null) => {
    if (locationId === selectedLocationId) {
      if (activeShift) {
        setIsLocationPopupOpen(true);
      } else {
        setSelectedLocationId(null);
      }
      return;
    }

    const selected = locations.find((loc) => loc.id === locationId);
    if (!selected) return;

    setPendingLocation(selected);
    setIsLocationPopupOpen(true);
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
