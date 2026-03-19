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
          // PAYLOAD: Contains info about what changed.
          
          if (payload.eventType === 'INSERT') {
            // New shift started!
            if (payload.new.user_id === user.id) {
                // If it's MY shift, update my active shift.
                const { data: myNewShift } = await supabase
                .from('shifts')
                .select('*')
                .eq('id', payload.new.id)
                .single();
              if (myNewShift) {
                setActiveShift(myNewShift);
                setSelectedLocationId(myNewShift.location_id);
              }
            } else {
              // If it's someone ELSE'S shift, add it to the global list.
              const { data: newShift } = await supabase
                .from('shifts')
                .select('*, profiles(username, first_name, last_name)')
                .eq('id', payload.new.id)
                .single();
              if (newShift) {
                setAllActiveShifts((prev) => {
                  if (prev.some(s => s.id === newShift.id)) return prev;
                  return [...prev, newShift];
                });
              }
            }
          } else if (payload.eventType === 'UPDATE') {
            // Shift was updated (could be ended OR location changed).
            
            if (payload.new.ended_at) {
              // 1. SHIFT ENDED
              if (payload.new.user_id === user.id) {
                setActiveShift(null);
                setSelectedLocationId(null);
                refreshData();
              } else {
                setAllActiveShifts((prev) => prev.filter((s) => s.id !== payload.new.id));
              }
            } else {
              // 2. SHIFT UPDATED (Location change)
              if (payload.new.user_id === user.id) {
                // My shift updated (from another device/confirming change)
                const { data: myNewShift } = await supabase
                  .from('shifts')
                  .select('*')
                  .eq('id', payload.new.id)
                  .single();
                if (myNewShift) {
                  setActiveShift(myNewShift);
                  setSelectedLocationId(myNewShift.location_id);
                }
              } else {
                // Someone else moved! Update their shift in the list.
                const { data: updatedShift } = await supabase
                  .from('shifts')
                  .select('*, profiles(username, first_name, last_name)')
                  .eq('id', payload.new.id)
                  .single();
                if (updatedShift) {
                  setAllActiveShifts((prev) => {
                    const exists = prev.some(s => s.id === updatedShift.id);
                    if (exists) {
                      return prev.map(s => s.id === updatedShift.id ? updatedShift : s);
                    }
                    return [...prev, updatedShift];
                  });
                }
              }
            }
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
