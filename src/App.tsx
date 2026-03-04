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
import { useTheme } from './context/ThemeContext';
import { AnimatePresence } from 'framer-motion';

export default function App() {
  const { user, isAuthChecking, isLoading: isAuthLoading } = useAuthContext();
  const { setTheme, resolvedTheme } = useTheme();

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
    const selected = locations.find((loc) => loc.id === locationId);
    if (!selected) return;
    if (locationId === selectedLocationId && activeShift) {
      setIsLocationPopupOpen(true);
      return;
    }
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
    <div className="App min-h-screen w-full font-sans md:flex md:flex-row transition-colors duration-500">
      <Dashboard onLocationSelect={handleLocationSelect} />
      <main className="flex-1 p-3 pb-32 md:p-6 md:pb-8 max-w-7xl">
        
        {/* Desktop Header Bar (Hidden on Mobile) */}
        <div className="hidden md:flex items-center justify-center relative mb-8 pt-2">
          <div className="text-2xl font-black dark:text-white tracking-tight">
            <Clock seconds={true} />
          </div>
          
          {/* Desktop Only Theme Toggle (Hidden on Mobile) */}
          <div className="hidden md:block absolute right-0 top-1/2 -translate-y-1/2">
            <button
              onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
              className="p-2.5 rounded-2xl bg-white/40 dark:bg-white/5 text-gray-600 dark:text-gray-200 hover:bg-white/80 dark:hover:bg-white/10 border border-white/20 dark:border-white/10 transition-all cursor-pointer backdrop-blur-md shadow-sm"
              aria-label="Toggle theme"
            >
              {resolvedTheme === 'dark' ? (
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M3 12h2.25m.386-6.364l-1.591 1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M3 12h2.25m.386-6.364l1.591-1.591M12 7.5a4.5 4.5 0 110 9 4.5 4.5 0 010-9z" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
                </svg>
              )}
            </button>
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
