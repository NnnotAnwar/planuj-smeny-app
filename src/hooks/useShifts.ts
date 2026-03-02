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
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);

  /**
   * Fetches initial shift and location data based on user's organization.
   */
  const initData = useCallback(async () => {
    if (!user?.id || !user?.organization_id) return;

    try {
      setIsLoading(true);
      const [currentShift, locs, activeShiftsData] = await Promise.all([
        shiftService.getActiveShift(user.id),
        locationService.getLocations(user.organization_id),
        shiftService.getAllActiveShifts(user.organization_id)
      ]);

      if (currentShift) {
        setActiveShift(currentShift);
        setSelectedLocationId(currentShift.location_id);
      }

      setLocations(locs);
      setAllActiveShifts(activeShiftsData);
    } catch (err) {
      console.error('Error initData:', err);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, user?.organization_id]);

  useEffect(() => {
    initData();
  }, [initData]);

  /**
   * Handles the logic for starting a new shift.
   */
  const handleStartShift = async () => {
    if (!selectedLocationId || !user) return;
    try {
      const data = await shiftService.startShift(user, selectedLocationId);
      setActiveShift(data);
    } catch (err) {
      console.error('Error handleStartShift:', err);
    }
  };

  /**
   * Handles the logic for ending the currently active shift.
   */
  const handleEndShift = async () => {
    if (!activeShift) return;
    try {
      await shiftService.endShift(activeShift.id);
      setActiveShift(null);
      setSelectedLocationId(null);
    } catch (err) {
      console.error('Error handleEndShift:', err);
    }
  };

  return {
    activeShift,
    setActiveShift,
    allActiveShifts,
    setAllActiveShifts,
    locations,
    isLoading,
    selectedLocationId,
    setSelectedLocationId,
    handleStartShift,
    handleEndShift
  };
}
