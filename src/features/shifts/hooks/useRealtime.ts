import { useEffect } from 'react';
import { supabase } from '@shared/api/supabaseClient';
import { type Shift, type User } from '@shared/types';
import { App } from '@capacitor/app';
import { Capacitor, type PluginListenerHandle } from '@capacitor/core';

/**
 * --- USE REALTIME HOOK ---
 * This hook listens for changes in the database (Supabase) and updates the app automatically.
 * 
 * Why?
 * If another worker starts a shift, you will see it instantly without refreshing the page.
 */

interface RealtimeParams {
  user: User | null;
  setActiveShift: (shift: Shift | null) => void;
  setSelectedLocationId: (id: string | null) => void;
  setAllActiveShifts: React.Dispatch<React.SetStateAction<Shift[]>>;
  setUserShifts: React.Dispatch<React.SetStateAction<Shift[]>>;
  refreshData: () => Promise<void>;
}

export function useRealtime({
  user,
  setActiveShift,
  setSelectedLocationId,
  setAllActiveShifts,
  setUserShifts,
  refreshData
}: RealtimeParams) {
  useEffect(() => {
    if (!user?.organization_id || !user?.id) return;

    // 1. MOBILE ONLY: Refresh data when user re-opens the app from background.
    let listener: PluginListenerHandle | null = null;
    if (Capacitor.isNativePlatform()) {
      App.addListener('appStateChange', ({ isActive }) => {
        if (isActive) refreshData();
      }).then(l => listener = l);
    }

    // 2. REALTIME SUBSCRIPTION: Listen for 'shifts' table changes.
    const channel = supabase
      .channel('realtime_shifts')
      .on(
        'postgres_changes',
        {
          event: '*', // Listen for ALL events (Insert, Update, Delete)
          schema: 'public',
          table: 'shifts',
          filter: `organization_id=eq.${user.organization_id}` // Only for my organization.
        },
        async (payload) => {
          // Optimization: Use payload data directly when possible
          const updatedShiftRaw = payload.new as Shift;

          if (payload.eventType === 'INSERT') {
            // New shift started!
            if (updatedShiftRaw.user_id === user.id) {
              // If it's MY shift, update my active shift.
              // Since it's a new shift, we might still want to fetch it once 
              // to ensure we have any default database values or joined data.
              const { data: myNewShift } = await supabase
                .from('shifts')
                .select('*')
                .eq('id', updatedShiftRaw.id)
                .single();
              if (myNewShift) {
                setActiveShift(myNewShift);
                setSelectedLocationId(myNewShift.location_id);
              }
            } else {
              // Someone else started a shift. We NEED their profile for the UI.
              const { data: newShiftWithProfile } = await supabase
                .from('shifts')
                .select('*, profiles(username, first_name, last_name)')
                .eq('id', updatedShiftRaw.id)
                .single();
              if (newShiftWithProfile) {
                setAllActiveShifts((prev) => {
                  if (prev.some(s => s.id === newShiftWithProfile.id)) return prev;
                  return [...prev, newShiftWithProfile];
                });
              }
            }
          } else if (payload.eventType === 'UPDATE') {
            // Shift was updated (could be ended OR location changed).
            
            if (updatedShiftRaw.ended_at) {
              // 1. SHIFT ENDED
              if (updatedShiftRaw.user_id === user.id) {
                setActiveShift(null);
                setSelectedLocationId(null);
              }
              setAllActiveShifts((prev) => prev.filter((s) => s.id !== updatedShiftRaw.id));
              // Also update history lists without full refresh
              refreshData(); 
            } else {
              // 2. SHIFT UPDATED (Location change)
              if (updatedShiftRaw.user_id === user.id) {
                // My shift updated (from another device/confirming change)
                setActiveShift(updatedShiftRaw);
                setSelectedLocationId(updatedShiftRaw.location_id);
              } else {
                // Someone else moved! Update their shift in the list.
                // If we already have the profile, we don't need to re-fetch it!
                setAllActiveShifts((prev) => {
                  return prev.map(s => {
                    if (s.id === updatedShiftRaw.id) {
                      // Preserve the profiles object while updating shift data
                      return { ...s, ...updatedShiftRaw };
                    }
                    return s;
                  });
                });
              }
            }
          } else if (payload.eventType === 'DELETE') {
            if (payload.old.id === user.id) {
              setActiveShift(null);
            }
            setAllActiveShifts(prev => prev.filter(s => s.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    // CLEANUP: Close connections when component is unmounted.
    return () => {
      supabase.removeChannel(channel);
      if (listener) listener.remove();
    };
  }, [user?.organization_id, user?.id, setActiveShift, setUserShifts, setSelectedLocationId, setAllActiveShifts, refreshData]);
}
