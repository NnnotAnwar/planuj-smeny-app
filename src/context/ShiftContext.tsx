import React, { createContext, useContext } from 'react';
import { useShifts } from '../hooks/useShifts';
import { useRealtime } from '../hooks/useRealtime';
import { useAuthContext } from './AuthContext';
import { type Shift, type Location } from '../types/types';

interface ShiftContextType {
  activeShift: Shift | null;
  setActiveShift: (shift: Shift | null) => void;
  allActiveShifts: Shift[];
  setAllActiveShifts: React.Dispatch<React.SetStateAction<Shift[]>>;
  locations: Location[];
  isLoading: boolean;
  selectedLocationId: string | null;
  setSelectedLocationId: (id: string | null) => void;
  handleStartShift: () => Promise<void>;
  handleEndShift: () => Promise<void>;
}

const ShiftContext = createContext<ShiftContextType | undefined>(undefined);

/**
 * Provider component that manages shift state and realtime updates.
 * Depends on AuthContext for user information.
 */
export function ShiftProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuthContext();
  const shiftData = useShifts(user);

  // Initialize realtime sync for shifts
  useRealtime({
    user,
    setActiveShift: shiftData.setActiveShift,
    setSelectedLocationId: shiftData.setSelectedLocationId,
    setAllActiveShifts: shiftData.setAllActiveShifts
  });

  return (
    <ShiftContext.Provider value={shiftData}>
      {children}
    </ShiftContext.Provider>
  );
}

/**
 * Hook to consume the shift context.
 * @throws Error if used outside of ShiftProvider.
 */
export function useShiftContext() {
  const context = useContext(ShiftContext);
  if (context === undefined) {
    throw new Error('useShiftContext must be used within a ShiftProvider');
  }
  return context;
}
