import { useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { type Shift, type User } from '../types/types';

interface RealtimeParams {
  user: User | null;
  setActiveShift: (shift: Shift | null) => void;
  setSelectedLocationId: (id: string | null) => void;
  setAllActiveShifts: React.Dispatch<React.SetStateAction<Shift[]>>;
}

/**
 * Hook to handle real-time database synchronization via Supabase Channels.
 * Ensures shifts are updated across multiple devices/tabs instantly.
 */
export function useRealtime({
  user,
  setActiveShift,
  setSelectedLocationId,
  setAllActiveShifts
}: RealtimeParams) {
  useEffect(() => {
    if (!user?.organization_id || !user?.id) return;

    // Create a channel for shifts within the user's organization
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
            // Handle new shift created (could be by current user on another device or a colleague)
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
              // Colleague started a shift
              const { data: newShift } = await supabase
                .from('shifts')
                .select('*, profiles(username, first_name, last_name)')
                .eq('id', payload.new.id)
                .single();
              if (newShift) setAllActiveShifts((prev) => [...prev, newShift]);
            }
          } else if (payload.eventType === 'UPDATE') {
            // Handle shift ended
            if (payload.new.ended_at) {
              if (payload.new.user_id === user.id) {
                // Current user ended shift on another device
                setActiveShift(null);
                setSelectedLocationId(null);
              } else {
                // Colleague ended their shift
                setAllActiveShifts((prev) => prev.filter((s) => s.id !== payload.new.id));
              }
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.organization_id, user?.id, setActiveShift, setSelectedLocationId, setAllActiveShifts]);
}
