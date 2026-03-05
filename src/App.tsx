import { useState } from 'react';
import './App.css';
import Dashboard from './components/Dashboard';
import ShiftCards from './components/ShiftCards';
import LocationPopup from './components/LocationPopup';
import LocationSelection from './components/LocationSelection';
import CheckIn from './components/CheckIn';
import { type Location, type ShiftDisplayData } from './types/types';
import ActiveShift from './components/ActiveShift';
import Clock from './components/Clock';
import { useAuthContext } from './context/AuthContext';
import { useShiftContext } from './context/ShiftContext';
import { AnimatePresence } from 'framer-motion';

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

  const [isLocationPopupOpen, setIsLocationPopupOpen] = useState(false);
  const [pendingLocation, setPendingLocation] = useState<Location | null>(null);

  const handleLocationSelect = (locationId: string | null) => {
    // 1. Если кликаем по той же локации
    if (locationId === selectedLocationId) {
      if (activeShift) {
        setIsLocationPopupOpen(true); // "Вы уже здесь"
      } else {
        setSelectedLocationId(null); // Снимаем выбор без попапа
      }
      return;
    }

    // 2. Если выбираем новую локацию (всегда через попап)
    const selected = locations.find((loc) => loc.id === locationId);
    if (!selected) return;

    setPendingLocation(selected);
    setIsLocationPopupOpen(true);
  };

  const isLoading = isAuthLoading || isShiftsLoading || isAuthChecking;

  if (isLoading || !user) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="App min-h-screen w-full font-sans md:flex md:flex-row transition-all duration-500 ease-in-out">
      <Dashboard onLocationSelect={handleLocationSelect} />
      <main className="flex-1 p-3 pb-32 md:p-6 md:pb-8 max-w-7xl transition-all duration-500 ease-in-out">

        {/* Desktop Header Bar (Hidden on Mobile) */}
        <div className="hidden md:flex items-center justify-center relative mb-8 pt-2">
          <div className="text-2xl font-black dark:text-white tracking-tight">
            <Clock seconds={true} />
          </div>
        </div>

        <ActiveShift />

        <CheckIn />

        <div className="md:hidden mb-6 -mx-3 px-3">
          <LocationSelection
            locations={locations}
            selectedLocationId={selectedLocationId}
            onLocationSelect={handleLocationSelect}
          />
        </div>

        <div className="space-y-4">
          {locations.map((location) => {
            const userFullName = `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.username;

            const colleaguesInLocation: ShiftDisplayData[] = allActiveShifts
              .filter((s) => s.location_id === location.id && s.user_id !== user.id)
              .map((s) => ({
                id: s.id,
                start: s.started_at ? new Date(s.started_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '--:--',
                name: `${s.profiles?.first_name || 'Employee'} ${s.profiles?.last_name || ''}`.trim(),
                role: s.role,
                end: null
              }));

            const currentUserShiftData: ShiftDisplayData | undefined = (activeShift && location.id === selectedLocationId)
              ? {
                name: userFullName,
                role: user.role,
                start: new Date(activeShift.started_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
                end: null,
                isChangeLocation: false,
              }
              : undefined;

            return (
              <section key={location.id}>
                <ShiftCards
                  locationName={location.name}
                  shifts={colleaguesInLocation}
                  userShift={currentUserShiftData}
                />
              </section>
            );
          })}
        </div>
      </main>

      {isLocationPopupOpen && pendingLocation && (
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
      )}
    </div>
  );
}
