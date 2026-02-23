/**
 * Main app: shift tracking per location, check-in/out, location picker and confirmation popup.
 * Uses in-memory data; in production would load locations/shifts from API.
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './App.css';
import Dashboard from './components/Dashboard';
import ShiftCards from './components/ShiftCards';
import LocationPopup from './components/LocationPopup';
import LocationSelection from './components/LocationSelection';
import CheckIn from './components/CheckIn';
import { type Location, type User } from './types/types';
import { supabase } from '../supabaseClient';


/** Formats a date string to HH:MM (24h). Demo uses fixed strings; prod would use real timestamps. */
function getFormattedTime(dateString: string): string {
  return new Date(dateString).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  });
}


export default function App() {

  const navigate = useNavigate();

  const [isAuthChecking, setIsAuthChecking] = useState(true);


  const [startedAt, setStartedAt] = useState<string | null>(null);
  const [endedAt, setEndedAt] = useState<string | null>(null);
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);
  const [isLocationPopupOpen, setIsLocationPopupOpen] = useState(false);
  const [pendingLocation, setPendingLocation] = useState<Location | null>(null);
  const [activeShiftLocationId, setActiveShiftLocationId] = useState<string | null>(null);
  const [isShiftRunning, setIsShiftRunning] = useState(false);
  const [isShiftFinished, setIsShiftFinished] = useState(false);
  const [currentTime, setCurrentTime] = useState(() => new Date());
  const [changeLocation, setChangeLocation] = useState(false);
  const [locations, setLocations] = useState<Location[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [user, setUser] = useState<User>({ username: 'Unknown User', role: "" })

  function getLocationName(locationId: string | null): string {
    return locations.find((l) => l.id === locationId)?.name ?? 'Unknown Location';
  }

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        navigate('/login', { replace: true });
      } else {
        setIsAuthChecking(false);
      }
    };
    checkUser()
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || !session) {
        navigate('/login', { replace: true });
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [navigate]);


  useEffect(() => {
    const fetchLocations = async () => {
      setIsLoading(true)
      const { data, error } = await supabase
        .from('locations')
        .select('*')

      if (error) console.error(error)
      else if (data) {
        const formattedLocations: Location[] = data.map(loc => ({
          id: loc.id,
          name: loc.name,
          shifts: []
        }))
        setLocations(formattedLocations)
      }
      setIsLoading(false)
    }

    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single()
        setUser({
          username: data.username,
          role: data.role
        })
      }
    }
    fetchUser()
    fetchLocations()
  }, [])

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formattedTime = currentTime.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const handleLocationSelect = (locationId: string | null) => {
    const selected = locations.find((loc) => loc.id === locationId);
    if (!selected) return;

    if (locationId === selectedLocationId) {
      if (!isShiftRunning) setSelectedLocationId(null);
      else setIsLocationPopupOpen(true);
      return;
    }

    setPendingLocation(selected);
    setIsLocationPopupOpen(true);
  };

  const handleStartShift = () => {
    if (!selectedLocationId) return;
    setStartedAt(getFormattedTime('February 19, 2026 11:01:30 GMT+01:00'));
    setEndedAt(null);
    setIsShiftRunning(true);
    setIsShiftFinished(false);
    setActiveShiftLocationId(selectedLocationId);
  };

  const handleEndShift = () => {
    setEndedAt(getFormattedTime('February 19, 2026 22:45:30 GMT+01:00'));
    setActiveShiftLocationId(selectedLocationId);
    setSelectedLocationId(null);
    setChangeLocation(false);
    setIsShiftRunning(false);
    setIsShiftFinished(true);
  };

  const shiftStatusMessage = startedAt
    ? isShiftFinished
      ? `Shift finished at ${getLocationName(activeShiftLocationId)}. Started at ${startedAt}, ended at ${endedAt}.`
      : `Shift running at ${getLocationName(selectedLocationId)}. Started at ${startedAt}.`
    : 'You have not started your shift yet.';

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-50 text-emerald-600 font-bold">Loading locations...</div>;
  }

  if (isAuthChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-16 h-16 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="App min-h-screen bg-gray-50 font-sans">
      <Dashboard user={user} />

      <main className="p-6 px-3 pb-32 max-w-7xl mx-auto">
        <div className="mb-6 px-0 lg:px-3 space-y-4">
          <div className="flex gap-4 md:gap-0 justify-between items-center">
            <h1 className="text-2xl sm:text-3xl md:hidden font-bold text-gray-900">
              Planuj Směny
            </h1>
            <div className="flex md:px-4 md:w-auto">
              <span className="text-xl sm:text-2xl font-mono font-bold text-gray-700">
                {formattedTime}
              </span>
            </div>
            {user && (
              <CheckIn
                user={user}
                shiftStatusMessage={shiftStatusMessage}
                selectedLocationId={selectedLocationId}
                isShiftRunning={isShiftRunning}
                handleStartShift={handleStartShift}
                handleEndShift={handleEndShift}
              />
            )}
          </div>
        </div>

        <LocationSelection
          locations={locations}
          selectedLocationId={selectedLocationId}
          onLocationSelect={handleLocationSelect}
        />

        <div className="space-y-6">
          {locations.map((location) => (
            <section key={location.id} id={location.id ?? undefined}>
              <ShiftCards
                locationName={location.name}
                shifts={location.shifts}
                userShift={
                  user && location.id === selectedLocationId
                    ? {
                      name: user.username,
                      role: user.role,
                      start: startedAt,
                      end: endedAt,
                      isChangeLocation: changeLocation,
                    }
                    : undefined
                }
              />
            </section>
          ))}
        </div>
      </main>

      {isLocationPopupOpen && pendingLocation && (
        <LocationPopup
          isChangedLocation={{
            selectedLocationId,
            pendingLocationId: pendingLocation.id,
          }}
          location={pendingLocation}
          setIsLocationPopupOpen={setIsLocationPopupOpen}
          setSelectedLocationId={setSelectedLocationId}
          handleChangeLocation={setChangeLocation}
        />
      )}
    </div>
  );
}
