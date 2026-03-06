import { useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { type Shift, type User } from '../types/types';
import { App } from '@capacitor/app';
import { Capacitor, type PluginListenerHandle } from '@capacitor/core';

interface RealtimeParams {
  user: User | null;
  setActiveShift: (shift: Shift | null) => void;
  setSelectedLocationId: (id: string | null) => void;
  setAllActiveShifts: React.Dispatch<React.SetStateAction<Shift[]>>;
  setUserShifts: React.Dispatch<React.SetStateAction<Shift[]>>;
  refreshData: () => Promise<void>;
}

/**
 * Hook to handle real-time database synchronization via Supabase Channels.
 * Also handles app lifecycle events to refresh data when returning from background.
 */
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

    // 1. Listen for App Lifecycle events (Mobile Only)
    let listener: PluginListenerHandle | null = null;
    if (Capacitor.isNativePlatform()) {
      App.addListener('appStateChange', ({ isActive }) => {
        if (isActive) {
          // App returned to foreground - force full refresh from DB
          refreshData();
        }
      }).then(l => listener = l);
    }

    // 2. Setup Realtime Subscription
    const channel = supabase
      .channel('realtime_shifts')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'shifts',
          filter: `organization_id=eq.${user.organization_id}`
        },
        async (payload) => {
          if (payload.eventType === 'INSERT') {
            if (payload.new.user_id === user.id) {
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
              const { data: newShift } = await supabase
                .from('shifts')
                .select('*, profiles(username, first_name, last_name)')
                .eq('id', payload.new.id)
                .single();
              if (newShift) {
                setAllActiveShifts((prev) => {
                  // Prevent duplication
                  if (prev.some(s => s.id === newShift.id)) return prev;
                  return [...prev, newShift];
                });
              }
            }
          } else if (payload.eventType === 'UPDATE') {
            if (payload.new.ended_at) {
              if (payload.new.user_id === user.id) {
                const { data: myShifts } = await supabase
                  .from('shifts')
                  .select('*')
                  .eq("user_id", user.id)
                if (myShifts) {
                  setUserShifts([...myShifts])
                }
                setActiveShift(null);
                setSelectedLocationId(null);
              } else {
                setAllActiveShifts((prev) => prev.filter((s) => s.id !== payload.new.id));
              }
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      if (listener) listener.remove();
    };
  }, [user?.organization_id, user?.id, setActiveShift, setUserShifts, setSelectedLocationId, setAllActiveShifts, refreshData]);
}
