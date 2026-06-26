import React, { createContext, useContext, useState } from 'react';
import { useAuthContext } from '@features/auth/AuthContext';
import { usePreferences } from '@shared/preferences/PreferencesContext';
import { type Shift, type ShiftWithProfile, type Location } from '@shared/types';
import { useShiftQueries } from './hooks/useShiftQueries';
import { useShiftMutations } from './hooks/useShiftMutations';
import { useShiftRealtime } from './hooks/useRealtime';

/**
 * --- SHIFT CONTEXT ---
 * Composes the shift server state (useShiftQueries), the actions
 * (useShiftMutations) and live updates (useShiftRealtime). State is owned by
 * React Query; the only local UI state is `selectedLocationId` (where to clock
 * in / the active shift's current location).
 *
 * The public API mirrors the old hand-rolled hook so consumers are unchanged,
 * minus the raw setState setters (an internal realtime detail that now writes
 * to the cache) and `actionError` (failed actions surface via the toast store).
 */
interface ShiftContextType {
    activeShift: Shift | null;
    allActiveShifts: ShiftWithProfile[];
    userShifts: Shift[];
    locations: Location[];
    isLoading: boolean;
    isStarting: boolean;
    isEnding: boolean;
    isChangingLocation: boolean;
    selectedLocationId: string | null;
    setSelectedLocationId: React.Dispatch<React.SetStateAction<string | null>>;
    handleStartShift: () => void;
    handleEndShift: () => void;
    handleChangeLocation: (newLocationId: string) => void;
}

const ShiftContext = createContext<ShiftContextType | undefined>(undefined);

export function ShiftProvider({ children }: { children: React.ReactNode }) {
    const { user } = useAuthContext();

    const { activeShift, board, history, locations } = useShiftQueries(user);
    useShiftRealtime(user);
    const mutations = useShiftMutations(user);

    const { defaultLocationId } = usePreferences();
    const activeShiftData = activeShift.data ?? null;

    // When a shift is active its location is the source of truth; otherwise the
    // selection is the user's manual pick, falling back to their configured
    // default clock-in location. Derived (no effect) so it stays in sync with the
    // active-shift query without cascading renders.
    const [pickedLocationId, setPickedLocationId] = useState<string | null>(null);
    const selectedLocationId = activeShiftData?.location_id ?? pickedLocationId ?? defaultLocationId;

    const handleStartShift = () => {
        if (!user || !selectedLocationId || mutations.startShift.isPending) return;
        mutations.startShift.mutate(selectedLocationId);
    };

    const handleEndShift = () => {
        if (!activeShiftData || mutations.endShift.isPending) return;
        mutations.endShift.mutate(activeShiftData.id);
        // Mirror the old behaviour: clear the manual pick so the picker resets
        // once the shift is gone (the active shift no longer drives selection).
        setPickedLocationId(null);
    };

    const handleChangeLocation = (newLocationId: string) => {
        if (!activeShiftData || mutations.changeLocation.isPending) return;
        mutations.changeLocation.mutate({
            shiftId: activeShiftData.id,
            newLocationId,
            previousLocationId: activeShiftData.location_id,
        });
    };

    const value: ShiftContextType = {
        activeShift: activeShiftData,
        allActiveShifts: board.data ?? [],
        userShifts: history.data ?? [],
        locations: locations.data ?? [],
        // First-load spinner only: React Query's isLoading is false on background refetches.
        isLoading: activeShift.isLoading || board.isLoading || locations.isLoading || history.isLoading,
        isStarting: mutations.startShift.isPending,
        isEnding: mutations.endShift.isPending,
        isChangingLocation: mutations.changeLocation.isPending,
        selectedLocationId,
        setSelectedLocationId: setPickedLocationId,
        handleStartShift,
        handleEndShift,
        handleChangeLocation,
    };

    return <ShiftContext.Provider value={value}>{children}</ShiftContext.Provider>;
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
