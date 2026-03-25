import { useState, useEffect, useCallback } from 'react';
import { shiftService } from '../shiftService';
import { locationService } from '@features/locations/locationService';
import { type Shift, type Location, type User } from '@shared/types';

/**
 * --- USE SHIFTS HOOK ---
 * This is the "brain" for shift management. 
 * It handles the state (active shifts, locations) and the actions (start, end, change location).
 */

export function useShifts(user: User | null) {
  // Global-like state for this feature.
  const [activeShift, setActiveShift] = useState<Shift | null>(null);
  const [allActiveShifts, setAllActiveShifts] = useState<Shift[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [userShifts, setUserShifts] = useState<Shift[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [isStarting, setIsStarting] = useState(false);
  const [isEnding, setIsEnding] = useState(false);
  const [isChangingLocation, setIsChangingLocation] = useState(false);
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);

  /**
   * REFRESH DATA: Fetches everything from the database.
   * We use useCallback so this function doesn't change on every render.
   */
  const refreshData = useCallback(async () => {
    if (!user?.id || !user?.organization_id) return;

    try {
      // Parallel fetch: Do multiple requests at once for speed.
      const [currentShift, locs, activeShiftsData, userShiftsData] = await Promise.all([
        shiftService.getActiveShift(user.id),
        locationService.getLocations(user.organization_id, user.role.name === 'Superadmin'),
        shiftService.getAllActiveShifts(user.organization_id, user.role.name === 'Superadmin'),
        shiftService.getAllUserShifts(user.id)
      ]);

      if (currentShift) {
        setActiveShift(currentShift);
        setSelectedLocationId(currentShift.location_id);
      } else {
        setActiveShift(null);
        setSelectedLocationId(null);
      }

      setLocations(locs);
      setAllActiveShifts(activeShiftsData);
      setUserShifts(userShiftsData);
    } catch (err) {
      console.error('Error refreshing shift data:', err);
    }
  }, [user?.id, user?.role, user?.organization_id]);

  // Load everything on startup.
  useEffect(() => {
    const init = async () => {
      setIsLoading(true);
      await refreshData();
      setIsLoading(false);
    };
    init();
  }, [refreshData]);

  /**
   * ACTION: START SHIFT
   */
  const handleStartShift = async () => {
    if (!selectedLocationId || !user || isStarting) return;
    try {
      setIsStarting(true);
      const data = await shiftService.startShift(user, selectedLocationId);
      setActiveShift(data);
      // Optimistically update lists
      setAllActiveShifts(prev => [...prev, { ...data, profiles: { username: user.username, first_name: user.first_name, last_name: user.last_name } } as Shift]);
    } catch (err) {
      console.error('Error starting shift:', err);
    } finally {
      setIsStarting(false);
    }
  };

  /**
   * ACTION: END SHIFT
   */
  const handleEndShift = async () => {
    if (!activeShift || isEnding) return;
    try {
      setIsEnding(true);
      const endedShift = await shiftService.endShift(activeShift.id);
      setActiveShift(null);
      setSelectedLocationId(null);
      // Remove from active list immediately
      setAllActiveShifts(prev => prev.filter(s => s.id !== activeShift.id));
      // Add to user history
      setUserShifts(prev => [endedShift, ...prev]);
    } catch (err) {
      console.error('Error ending shift:', err);
    } finally {
      setIsEnding(false);
    }
  };

  /**
   * ACTION: CHANGE LOCATION
   * Updates the location of the active shift in the database.
   */
  const handleChangeLocation = async (newLocationId: string) => {
    if (!activeShift || isChangingLocation) return;
    try {
      setIsChangingLocation(true);
      // We pass the current location as the 'previous' one before it gets updated.
      const updatedShift = await shiftService.changeShiftLocation(
        activeShift.id,
        newLocationId,
        activeShift.location_id
      );

      // We manually add the flag to the local state so the UI highlights the move immediately.
      setActiveShift({ ...updatedShift, isChangeLocation: true } as Shift);
      setSelectedLocationId(newLocationId);
    } catch (err) {
      console.error('Error changing shift location:', err);
    } finally {
      setIsChangingLocation(false);
    }
  };

  return {
    activeShift,
    setActiveShift,
    allActiveShifts,
    setAllActiveShifts,
    userShifts,
    setUserShifts,
    locations,
    isLoading,
    isStarting,
    isEnding,
    isChangingLocation,
    selectedLocationId,
    setSelectedLocationId,
    handleStartShift,
    handleEndShift,
    handleChangeLocation,
    refreshData
  };
}
