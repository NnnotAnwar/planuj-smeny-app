import React, { createContext, useContext } from 'react';
import { useShifts } from './hooks/useShifts';
import { useRealtime } from './hooks/useRealtime';
import { useAuthContext } from '@features/auth/AuthContext';
import { type Shift, type Location } from '@shared/types';

/**
 * --- SHIFT CONTEXT ---
 * Manages everything related to the user's active shift and other colleagues' shifts.
 * It combines the business logic (useShifts) with live updates (useRealtime).
 */

interface ShiftContextType {
  activeShift: Shift | null;
  setActiveShift: React.Dispatch<React.SetStateAction<Shift | null>>;
  allActiveShifts: Shift[];
  setAllActiveShifts: React.Dispatch<React.SetStateAction<Shift[]>>;
  userShifts: Shift[];
  setUserShifts: React.Dispatch<React.SetStateAction<Shift[]>>;
  locations: Location[];
  isLoading: boolean;
  isStarting: boolean;
  isEnding: boolean;
  isChangingLocation: boolean;
  selectedLocationId: string | null;
  setSelectedLocationId: React.Dispatch<React.SetStateAction<string | null>>;
  handleStartShift: () => Promise<void>;
  handleEndShift: () => Promise<void>;
  handleChangeLocation: (newLocationId: string) => Promise<void>;
  refreshData: () => Promise<void>;
}

const ShiftContext = createContext<ShiftContextType | undefined>(undefined);

export function ShiftProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuthContext();
  
  // 1. Logic hook: Handles state, database calls, and actions.
  const shiftData = useShifts(user);

  // 2. Realtime hook: Handles live updates from the database.
  useRealtime({
    user,
    setActiveShift: shiftData.setActiveShift,
    setSelectedLocationId: shiftData.setSelectedLocationId,
    setAllActiveShifts: shiftData.setAllActiveShifts,
    setUserShifts: shiftData.setUserShifts,
    refreshData: shiftData.refreshData
  });

  return (
    <ShiftContext.Provider value={shiftData}>
      {children}
    </ShiftContext.Provider>
  );
}

/**
 * CUSTOM HOOK: useShiftContext
 * Allows components to start/end shifts and see the status.
 */
export function useShiftContext() {
  const context = useContext(ShiftContext);
  if (context === undefined) {
    throw new Error('useShiftContext must be used within a ShiftProvider');
  }
  return context;
}
