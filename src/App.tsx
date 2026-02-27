import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './App.css';
import Dashboard from './components/Dashboard';
import ShiftCards from './components/ShiftCards';
import LocationPopup from './components/LocationPopup';
import LocationSelection from './components/LocationSelection';
import CheckIn from './components/CheckIn';
import { type Location, type User, type Shift, type ShiftDisplayData } from './types/types';
import { supabase } from '../supabaseClient';
import ActiveShift from './components/ActiveShift';
import Clock from './components/Clock';

export default function App() {
  const navigate = useNavigate();

  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [activeShift, setActiveShift] = useState<Shift | null>(null);
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);
  const [isLocationPopupOpen, setIsLocationPopupOpen] = useState(false);
  const [pendingLocation, setPendingLocation] = useState<Location | null>(null);
  const [locations, setLocations] = useState<Location[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<User>({ id: '', username: 'Unknown User', role: "", organization_id: "" });
  const [allActiveShifts, setAllActiveShifts] = useState<Shift[]>([]);

  // function getLocationName(locationId: string | null): string {
  //   return locations.find((l) => l.id === locationId)?.name ?? 'Unknown Location';
  // }

  useEffect(() => {
    const initData = async () => {
      setIsLoading(true);
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        navigate('/login', { replace: true });
        return;
      }

      // 1. Загружаем профиль
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, username, first_name, last_name, role, organization_id')
        .eq('id', session.user.id)
        .single();


      if (profile) {
        const userData: User = {
          id: profile.id,
          username: profile.username,
          first_name: profile.first_name,
          last_name: profile.last_name,
          role: profile.role,
          organization_id: profile.organization_id
        };
        setUser(userData);

        // 2. Ищем активную смену
        const { data: currentShift } = await supabase
          .from('shifts')
          .select('*')
          .eq('user_id', session.user.id)
          .is('ended_at', null)
          .maybeSingle();

        if (currentShift) {
          setActiveShift(currentShift);
          setSelectedLocationId(currentShift.location_id);
        }

        // 3. Загружаем локации организации
        const { data: locs } = await supabase
          .from('locations')
          .select('*')
          .eq('organization_id', profile.organization_id);

        if (locs) {
          setLocations(locs.map(l => ({ id: l.id, name: l.name, shifts: [] })));
        }

        const { data: activeShiftsData } = await supabase
          .from('shifts')
          .select('*, profiles(username, first_name, last_name)')
          .eq('organization_id', profile.organization_id)
          .is('ended_at', null);

        if (activeShiftsData) {
          setAllActiveShifts(activeShiftsData);
        }
      }
      setIsLoading(false);
      setIsAuthChecking(false);
    };

    initData();

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || !session) {
        navigate('/login', { replace: true });
      }
    });

    return () => authListener.subscription.unsubscribe();
  }, [navigate]);

  useEffect(() => {
    if (!user.organization_id) return;

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
            const { data: newShift } = await supabase
              .from('shifts')
              .select('*, profiles(username, first_name, last_name)')
              .eq('id', payload.new.id)
              .single();

            if (newShift) {
              setAllActiveShifts((prev) => [...prev, newShift]);
            }
          } else if (payload.eventType === 'UPDATE') {
            if (payload.new.ended_at) {
              setAllActiveShifts((prev) => prev.filter(s => s.id !== payload.new.id));
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user.organization_id]);

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (!error) {
      navigate('/login', { replace: true });
    } else {
      console.error("Error logging out:", error.message);
    }
  };

  const handleLocationSelect = (locationId: string | null) => {
    const selected = locations.find((loc) => loc.id === locationId);
    if (!selected) return;
    if (locationId === selectedLocationId && activeShift) {
      setIsLocationPopupOpen(true);
      return;
    }
    setPendingLocation(selected);
    setIsLocationPopupOpen(true);
  };

  const handleStartShift = async () => {
    if (!selectedLocationId || !user) return;

    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) return;

    const { data, error } = await supabase
      .from('shifts')
      .insert({
        user_id: authUser.id,
        location_id: selectedLocationId,
        organization_id: user.organization_id,
        started_at: new Date().toISOString(),
        role: user.role
      })
      .select()
      .single();

    if (data) {
      setActiveShift(data);
    } else if (error) {
      console.error("Error starting shift:", error.message);
    }
  };

  const handleEndShift = async () => {
    if (!activeShift) return;

    const { data, error } = await supabase
      .from('shifts')
      .update({ ended_at: new Date().toISOString() })
      .eq('id', activeShift.id)
      .select()
      .single();

    if (data) {
      setActiveShift(null);
      setSelectedLocationId(null);
    } else if (error) {
      console.error("Error ending shift:", error.message);
    }
  };

  if (isLoading || isAuthChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-16 h-16 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="App min-h-screen bg-gray-50 font-sans md:flex md:flex-row">
      <Dashboard
        user={user}
        locProbs={{
          locations: locations,
          selectedLocationId: selectedLocationId,
          handleLocationSelect: handleLocationSelect
        }}
        onLogout={handleLogout} />
      <main className="p-3 pb-32 max-w-7xl w-full md:w-2/3 lg:w-3/4">
        <p className="text-xl font-bold text-center mb-2 hidden md:block">
          <Clock />
        </p>
        <ActiveShift activeShift={activeShift} />

        <CheckIn
          selectedLocationId={selectedLocationId}
          isShiftRunning={!!activeShift}
          handleStartShift={handleStartShift}
          handleEndShift={handleEndShift}
        />

        <div className="md:hidden">
          <LocationSelection
            locations={locations}
            selectedLocationId={selectedLocationId}
            onLocationSelect={handleLocationSelect}
          />
        </div>
        <div className="space-y-4">
          {locations.map((location) => {
            const userFullName = `${user.first_name} ${user.last_name || ''}`

            const colleaguesInLocation: ShiftDisplayData[] = allActiveShifts
              .filter((s) => s.location_id === location.id && s.user_id !== user.id)
              .map((s) => ({
                id: s.id,
                start: new Date(s.started_at).toLocaleTimeString('en-GB', {
                  hour: '2-digit',
                  minute: '2-digit'
                }),
                name: `${s.profiles?.first_name || 'Employee'} ${s.profiles?.last_name || ''}`,
                role: s.role,
                end: null
              }));

            const currentUserShiftData: ShiftDisplayData | undefined = (activeShift && location.id === selectedLocationId)
              ? {
                name: userFullName,
                role: user.role,
                start: new Date(activeShift.started_at).toLocaleTimeString('en-GB', {
                  hour: '2-digit',
                  minute: '2-digit'
                }),
                end: null,
                isChangeLocation: false,
              }
              : undefined;

            return (
              <section key={location.id}>
                <ShiftCards
                  locationName={location.name}
                  shifts={colleaguesInLocation}
                  userShift={currentUserShiftData}
                />
              </section>
            );
          })}
        </div>
      </main>

      {isLocationPopupOpen && pendingLocation && (
        <LocationPopup
          isChangedLocation={{ selectedLocationId, pendingLocationId: pendingLocation.id }}
          location={pendingLocation}
          setIsLocationPopupOpen={setIsLocationPopupOpen}
          setSelectedLocationId={setSelectedLocationId}
          handleChangeLocation={() => { }}
        />
      )}
    </div>
  );
}