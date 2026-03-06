import { useState, useEffect, useCallback } from 'react';
import { shiftService } from '../services/shiftService';
import { locationService } from '../services/locationService';
import { type Shift, type Location, type User } from '../types/types';

/**
 * Hook to manage shifts, locations, and active shift actions.
 * @param user - The current authenticated user.
 */
export function useShifts(user: User | null) {
  const [activeShift, setActiveShift] = useState<Shift | null>(null);
  const [allActiveShifts, setAllActiveShifts] = useState<Shift[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isStarting, setIsStarting] = useState(false);
  const [isEnding, setIsEnding] = useState(false);
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);
  const [userShifts, setUserShifts] = useState<Shift[]>([])

  /**
   * Fetches initial shift and location data based on user's organization.
   * Can be called manually to refresh all data from DB.
   */
  const refreshData = useCallback(async () => {
    if (!user?.id || !user?.organization_id) return;

    try {
      const [currentShift, locs, activeShiftsData, userShiftsData] = await Promise.all([
        shiftService.getActiveShift(user.id),
        locationService.getLocations(user.organization_id),
        shiftService.getAllActiveShifts(user.organization_id),
        shiftService.getAllUserShifts(user.id)
      ]);
      if (currentShift) {
        setActiveShift(currentShift);
        setSelectedLocationId(currentShift.location_id);
      } else {
        // If current shift was ended on another device
        setActiveShift(null);
        setSelectedLocationId(null);
      }

      setLocations(locs);
      setAllActiveShifts(activeShiftsData);
      setUserShifts(userShiftsData)
    } catch (err) {
      console.error('Error refreshData:', err);
    }
  }, [user?.id, user?.organization_id]);

  // Initial load
  useEffect(() => {
    const init = async () => {
      setIsLoading(true);
      await refreshData();
      setIsLoading(false);
    };
    init();
  }, [refreshData]);

  /**
   * Handles the logic for starting a new shift.
   */
  const handleStartShift = async () => {
    if (!selectedLocationId || !user || isStarting) return;
    try {
      setIsStarting(true);
      const data = await shiftService.startShift(user, selectedLocationId);
      setActiveShift(data);
    } catch (err) {
      console.error('Error handleStartShift:', err);
    } finally {
      setIsStarting(false);
    }
  };

  /**
   * Handles the logic for ending the currently active shift.
   */
  const handleEndShift = async () => {
    if (!activeShift || isEnding) return;
    try {
      setIsEnding(true);
      await shiftService.endShift(activeShift.id);
      setActiveShift(null);
      setSelectedLocationId(null);
    } catch (err) {
      console.error('Error handleEndShift:', err);
    } finally {
      setIsEnding(false);
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
    selectedLocationId,
    setSelectedLocationId,
    handleStartShift,
    handleEndShift,
    refreshData
  };
}
