import { AnimatePresence } from 'framer-motion';
import { Outlet } from 'react-router-dom';

import { useAuthContext } from '@features/auth/AuthContext';
import { useShiftContext } from '@features/shifts/ShiftContext';
import { useLocationManagement } from '@features/locations/hooks/useLocationManagement';

import { Dashboard } from '@features/dashboard/Dashboard';
import { LocationPopup } from '@features/locations/components/LocationPopup';
import { type User, type Shift, type Location } from '@shared/types';

/**
 * --- APP SHELL (Main Layout) ---
 * This component defines the structure for all logged-in pages.
 * It contains the Sidebar (Dashboard) and the Main content area (Outlet).
 * 
 * Logic:
 * It also manages global popups like the Location Confirmation modal.
 */

export interface AppOutletContext {
  user: User;
  activeShift: Shift | null;
  allActiveShifts: Shift[];
  locations: Location[];
  selectedLocationId: string | null;
  setSelectedLocationId: (id: string | null) => void;
  handleLocationSelect: (locationId: string | null) => void;
  isLocationPopupOpen: boolean;
  setIsLocationPopupOpen: (open: boolean) => void;
  pendingLocation: Location | null;
}

export function AppShell() {
  const { user, isAuthChecking, isLoading: isAuthLoading } = useAuthContext();
  const { activeShift, allActiveShifts, locations, isLoading: isShiftsLoading, selectedLocationId, setSelectedLocationId } = useShiftContext();

  // Location switch/confirm logic hook.
  const { isLocationPopupOpen, setIsLocationPopupOpen, pendingLocation, handleLocationSelect } = useLocationManagement({
    locations, activeShift, selectedLocationId, setSelectedLocationId,
  });

  // 1. GLOBAL LOADING: Only show a full-page spinner during initial auth check or if no user is present.
  // We avoid unmounting the whole AppShell when shifts are refreshing in the background (flicker fix).
  if (isAuthChecking || (isAuthLoading && !user) || !user) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-white dark:bg-gray-950 transition-colors duration-500">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin shadow-lg shadow-emerald-500/20"></div>
          <p className="text-emerald-600 dark:text-emerald-400 font-bold text-sm animate-pulse">Loading experience...</p>
        </div>
      </div>
    );
  }

  // 2. CONTEXT: Data passed down to sub-pages (Home, Overview).
  const contextValue: AppOutletContext = {
    user, activeShift, allActiveShifts, locations,
    selectedLocationId, setSelectedLocationId, handleLocationSelect,
    isLocationPopupOpen, setIsLocationPopupOpen, pendingLocation,
  };

  return (
    <div className="App min-h-screen w-full font-sans md:flex md:flex-row transition-all duration-500 ease-in-out">
      {/* SIDEBAR NAVIGATION */}
      <Dashboard onLocationSelect={handleLocationSelect} />

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 p-3 pb-40 md:p-6 md:pb-6 max-w-7xl transition-all">
        <Outlet context={contextValue} />
      </main>

      {/* GLOBAL OVERLAYS */}
      <AnimatePresence>
        {isLocationPopupOpen && pendingLocation && (
          <LocationPopup
            isChangedLocation={{ selectedLocationId, pendingLocationId: pendingLocation.id }}
            location={pendingLocation}
            setIsLocationPopupOpen={setIsLocationPopupOpen}
            setSelectedLocationId={setSelectedLocationId}
            handleChangeLocation={() => { }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
