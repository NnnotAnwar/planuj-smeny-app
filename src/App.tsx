import './App.css';
import Dashboard from './components/Dashboard';
import LocationPopup from './components/LocationPopup';
import { useAuthContext } from './context/AuthContext';
import { useShiftContext } from './context/ShiftContext';
import { AnimatePresence } from 'framer-motion';
import { useLocationManagement } from './hooks/useLocationManagement';
import { Outlet } from 'react-router-dom';
import { type Location, type Shift, type User } from './types/types';

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

export default function App() {
  const { user, isAuthChecking, isLoading: isAuthLoading } = useAuthContext();

  const {
    activeShift,
    allActiveShifts,
    locations,
    isLoading: isShiftsLoading,
    selectedLocationId,
    setSelectedLocationId,
  } = useShiftContext();

  const {
    isLocationPopupOpen,
    setIsLocationPopupOpen,
    pendingLocation,
    handleLocationSelect,
  } = useLocationManagement({
    locations,
    activeShift,
    selectedLocationId,
    setSelectedLocationId,
  });

  const isLoading = isAuthLoading || isShiftsLoading || isAuthChecking;

  if (isLoading || !user) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const contextValue: AppOutletContext = {
    user,
    activeShift,
    allActiveShifts,
    locations,
    selectedLocationId,
    setSelectedLocationId,
    handleLocationSelect,
    isLocationPopupOpen,
    setIsLocationPopupOpen,
    pendingLocation,
  };

  return (
    <div className="App min-h-screen w-full font-sans md:flex md:flex-row transition-all duration-500 ease-in-out">
      <Dashboard onLocationSelect={handleLocationSelect} />

      <main className="flex-1 p-3 pb-32 md:p-6 md:pb-6 max-w-7xl transition-all duration-500 ease-in-out">
        {/* We pass the context down to all routes like HomePage, OverviewPage, etc. */}
        <Outlet context={contextValue} />
      </main>

      <AnimatePresence>
        {isLocationPopupOpen && pendingLocation && (
          <LocationPopup
            isChangedLocation={{
              selectedLocationId,
              pendingLocationId: pendingLocation.id,
            }}
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
