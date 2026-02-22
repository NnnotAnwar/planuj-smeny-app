/**
 * Main app: shift tracking per location, check-in/out, location picker and confirmation popup.
 * Uses in-memory data; in production would load locations/shifts from API.
 */

import { useState, useEffect } from 'react';
import './App.css';
import Dashboard from './components/Dashboard';
import ShiftCards from './components/ShiftCards';
import LocationPopup from './components/LocationPopup';
import LocationSelection from './components/LocationSelection';
import CheckIn from './components/CheckIn';
import { type Shift, type Location, type User } from './types/types';

const DEFAULT_USER: User = {
  username: 'Anuar Kairulla',
  role: 'Supervisor',
};

const defaultShifts: Shift[] = [
  { id: 1, name: 'Ahmed Taha', role: 'Manager', start: '08:00', end: null },
  { id: 2, name: 'Elizabeth Dron', role: 'Supervisor', start: '09:00', end: '18:00' },
  { id: 3, name: 'Petr Hamhalter', role: 'Waiter', start: '10:30', end: '22:00' },
  { id: 4, name: 'Luca Lucio', role: 'Manager', start: null, end: null },
  { id: 5, name: 'Anna Arestova', role: 'Supervisor', start: '07:00', end: '15:00' },
  { id: 6, name: 'Alina Melnikova', role: 'Waitress', start: '14:00', end: '23:30' },
  { id: 7, name: 'Mehded Taha', role: 'Waiter', start: '08:00', end: null },
];

const locations: Location[] = [
  { id: 'san-carlo-dittrichova', name: 'San Carlo - Dittrichova', shifts: defaultShifts },
  { id: 'san-carlo-mala-strana', name: 'San Carlo - Malá Strana', shifts: defaultShifts },
  { id: 'san-carlo-vinohrady', name: 'San Carlo - Vinohrady', shifts: defaultShifts },
  { id: 'san-carlo-karlin', name: 'San Carlo - Karlín', shifts: defaultShifts },
  { id: 'san-carlo-letna', name: 'San Carlo - Letna', shifts: defaultShifts },
  { id: 'san-carlo-holesovice', name: 'San Carlo - Holešovice', shifts: defaultShifts },
];

/** Formats a date string to HH:MM (24h). Demo uses fixed strings; prod would use real timestamps. */
function getFormattedTime(dateString: string): string {
  return new Date(dateString).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getLocationName(locationId: string | null): string {
  return locations.find((l) => l.id === locationId)?.name ?? 'Unknown Location';
}

export default function App() {
  const user: User = DEFAULT_USER;

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
