import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Outlet } from 'react-router-dom';
import { WarningCircleIcon, XIcon, MapPinIcon } from '@phosphor-icons/react';

import { useAuthContext } from '@features/auth/AuthContext';
import { useShiftContext } from '@features/shifts/ShiftContext';
import { useLocationManagement } from '@features/locations/hooks/useLocationManagement';
import { useToasts, toastStore } from '@shared/toast/toastStore';
import { useTranslation } from '@shared/preferences/PreferencesContext';

import { Sidebar } from './Sidebar';
import { BottomNav } from './BottomNav';
import { CommandPalette } from '../CommandPalette';
import { LocationPopup, type LocationPopupVariant } from '@features/locations/components/LocationPopup';
import { type User, type Shift, type Location } from '@shared/types';

/**
 * --- APP SHELL (Main Layout) ---
 * This component defines the structure for all logged-in pages.
 * It contains the persistent Sidebar and the Main content area (Outlet).
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
  const { activeShift, allActiveShifts, locations, selectedLocationId, setSelectedLocationId, handleChangeLocation, isChangingLocation } = useShiftContext();
  const t = useTranslation();

  // Failed shift actions (start/end/move) are surfaced via the toast store; the
  // store auto-dismisses each entry.
  const toasts = useToasts();

  // Command palette (⌘K / Ctrl+K) open state + global hotkey.
  const [paletteOpen, setPaletteOpen] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // "You're already here" — a top push-style toast (auto-dismisses).
  const [hereToast, setHereToast] = useState<string | null>(null);
  useEffect(() => {
    if (!hereToast) return;
    const t = setTimeout(() => setHereToast(null), 3000);
    return () => clearTimeout(t);
  }, [hereToast]);

  // Location switch/confirm logic hook.
  const { isLocationPopupOpen, setIsLocationPopupOpen, pendingLocation, handleLocationSelect } = useLocationManagement({
    locations, activeShift, selectedLocationId, setSelectedLocationId,
    onAlreadyHere: (name) => setHereToast(name),
  });

  // What the location popup is asking, and what confirming does. (The "already
  // here" case never opens the popup — it shows the toast instead.)
  const popupVariant: LocationPopupVariant = activeShift ? 'switch' : 'confirm';

  const confirmLocation = async () => {
    if (!pendingLocation) return;
    if (activeShift && selectedLocationId && selectedLocationId !== pendingLocation.id) {
      await handleChangeLocation(pendingLocation.id); // persist the move on the active shift
    } else if (pendingLocation.id !== selectedLocationId) {
      setSelectedLocationId(pendingLocation.id); // just pick where to clock in
    }
    setIsLocationPopupOpen(false);
  };

  // 1. GLOBAL LOADING: Only show a full-page spinner during initial auth check or if no user is present.
  // We avoid unmounting the whole AppShell when shifts are refreshing in the background (flicker fix).
  if (isAuthChecking || (isAuthLoading && !user) || !user) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-[var(--grad-from)] transition-colors duration-500">
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
    <div className="App min-h-dvh w-full font-sans md:flex md:flex-row transition-all duration-500 ease-in-out">
      {/* SIDEBAR — persistent dispatch board / navigation (desktop) + header (mobile) */}
      <Sidebar onLocationSelect={handleLocationSelect} onOpenSearch={() => setPaletteOpen(true)} />

      {/* MAIN CONTENT AREA — bottom padding clears the mobile tab bar (+ the
          floating check-in button on Home); md+ uses the sidebar instead. */}
      <main className="flex-1 p-3 pb-32 md:p-6 md:pb-6 max-w-7xl transition-all">
        <Outlet context={contextValue} />
      </main>

      {/* MOBILE BOTTOM TAB BAR */}
      <BottomNav />

      {/* ACTION ERROR TOASTS — surface failed shift actions (start/end/move). */}
      <div className="fixed left-1/2 -translate-x-1/2 z-[200] bottom-[calc(5.5rem+env(safe-area-inset-bottom))] md:bottom-6 w-[calc(100%-2rem)] max-w-md space-y-2">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              role="alert"
              className="w-full"
            >
              <div className="flex items-start gap-3 bg-red-500 text-white rounded-2xl px-4 py-3 shadow-2xl shadow-red-500/30">
                <WarningCircleIcon weight="fill" className="w-5 h-5 shrink-0 mt-0.5" />
                <p className="flex-1 text-sm font-bold leading-snug">{t.message}</p>
                <button onClick={() => toastStore.dismiss(t.id)} aria-label="Dismiss" className="shrink-0 -m-1 p-1 hover:bg-white/20 rounded-lg transition-colors">
                  <XIcon weight="bold" className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* "ALREADY HERE" TOAST — push-style, slides in from the top. */}
      <AnimatePresence>
        {hereToast && (
          <motion.div
            initial={{ opacity: 0, y: -24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -24 }}
            transition={{ type: 'spring', stiffness: 360, damping: 30 }}
            role="status"
            onClick={() => setHereToast(null)}
            className="fixed left-1/2 -translate-x-1/2 z-[200] top-[calc(0.75rem+env(safe-area-inset-top))] w-[calc(100%-2rem)] max-w-sm"
          >
            <div className="flex items-center gap-3 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl px-4 py-3 shadow-2xl">
              <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                <MapPinIcon weight="fill" className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-body-strong text-gray-900 dark:text-white leading-tight">{t('location.alreadyHere')}</p>
                <p className="text-caption text-gray-500 dark:text-gray-400 truncate">{t('location.workingAt', { location: hereToast })}</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* COMMAND PALETTE (⌘K) */}
      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        locations={locations}
        selectedLocationId={selectedLocationId}
        onSelectLocation={handleLocationSelect}
      />

      {/* GLOBAL OVERLAYS */}
      <AnimatePresence>
        {isLocationPopupOpen && pendingLocation && (
          <LocationPopup
            locationName={pendingLocation.name}
            variant={popupVariant}
            isBusy={isChangingLocation}
            onConfirm={confirmLocation}
            onCancel={() => setIsLocationPopupOpen(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
