
import { useState } from 'react';
import './App.css';
import Dashboard from './components/Dashboard';
import ShiftCards from './components/ShiftCards';

type Shift = {
  id: number;
  name: string;
  role: string;
  start: string | null;
  end: string | null;
};

type Location = {
  id: string;
  name: string;
  shifts: Shift[];
};

const defaultShifts: Shift[] = [
  { id: 1, name: 'Ahmed Taha', role: 'Manager', start: '08:00', end: null },
  { id: 2, name: 'Elizabeth Dron', role: 'Supervisor', start: '09:00', end: '18:00' },
  { id: 3, name: 'Petr Hamhalter', role: 'Supervisor', start: '10:30', end: '22:00' },
  { id: 4, name: 'Luca Lucio', role: 'Manager', start: null, end: null },
  { id: 5, name: 'Anna Arestova', role: 'Supervisor', start: '07:00', end: '15:00' },
  { id: 6, name: 'Alina Melnikova', role: 'Waitress', start: '14:00', end: '23:30' },
  { id: 7, name: 'Mehded Taha', role: 'Waiter', start: '08:00', end: null },
];

const locations: Location[] = [
  {
    id: 'san-carlo-dittrichova',
    name: 'San Carlo - Dittrichova',
    shifts: defaultShifts,
  },
  {
    id: 'san-carlo-mala-strana',
    name: 'San Carlo - Malá Strana',
    shifts: defaultShifts,
  },
  {
    id: 'san-carlo-vinohrady',
    name: 'San Carlo - Vinohrady',
    shifts: defaultShifts,
  },
  {
    id: 'san-carlo-karlin',
    name: 'San Carlo - Karlín',
    shifts: defaultShifts,
  },
  {
    id: 'san-carlo-letna',
    name: 'San Carlo - Letna',
    shifts: defaultShifts,
  },
  {
    id: 'san-carlo-holesovice',
    name: 'San Carlo - Holešovice',
    shifts: defaultShifts,
  },
];

export default function App() {
  const user = {
    username: 'Ahmed Taha',
    role: 'Admin',
  };

  interface Location {
    id: string;
    name: string;
  }

  const [startedAt, setStartedAt] = useState<string | null>(null);
  const [endedAt, setEndedAt] = useState<string | null>(null);
  // track the currently selected location id while picking a place to start a shift
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);
  const [isLocationPopupOpen, setIsLocationPopupOpen] = useState(false);
  const [location, setLocation] = useState<Location | null>(null);
  const [isChangedLocation, setIsChangedLocation] = useState(false);


  const handleStartShift = () => {
    if (!selectedLocationId) {
      // guard: don't start a shift without choosing a location first
      alert('Please pick a location before starting your shift.');
      return;
    }

    const now = new Date("February 19, 2026 11:01:30 GMT+01:00"); // Add 2 hours to current time
    const time = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    setStartedAt(time);
    setEndedAt(null);
  };

  const handleEndShift = () => {
    const now = new Date("February 19, 2026 22:45:30 GMT+01:00"); // Add 2 hours to current time
    const time = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    setEndedAt(time);
    // setSelectedLocationId(null); // reset selected location after ending the shift
  };



  return (
    <div className="App min-h-screen bg-gray-50 font-sans">
      <Dashboard />

      <main className="p-6 max-w-7xl mx-auto">
        <div className="mb-6 space-y-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Shift Tracker</h1>
            <p className="text-gray-500 mt-1">
              Quickly see who is working in each location and manage attendance.
            </p>
          </div>

          {user && (
            <section className="bg-white border border-gray-200 rounded-lg p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4 shadow-sm">
              <div>
                <p className="text-sm font-semibold text-gray-700">
                  Your shift, {user.role}:
                </p>
                <p className="text-sm text-gray-600 mt-1">
                  {startedAt
                    ? endedAt
                      ? `Shift finished at ${locations.find(l => l.id === selectedLocationId)?.name || 'unknown location'}. Started at ${startedAt}, ended at ${endedAt}.`
                      : `Shift running at ${locations.find(l => l.id === selectedLocationId)?.name || 'unknown location'}. Started at ${startedAt}.`
                    : 'You have not started your shift yet.'}
                </p>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleStartShift}
                  className="px-4 py-2 text-sm font-semibold rounded-md bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
                  disabled={!!startedAt && !endedAt || !selectedLocationId}
                >
                  Start shift
                </button>
                <button
                  type="button"
                  onClick={handleEndShift}
                  className="px-4 py-2 text-sm font-semibold rounded-md bg-gray-100 text-gray-800 hover:bg-gray-200 border border-gray-200 disabled:opacity-60 disabled:cursor-not-allowed"
                  disabled={!startedAt || !!endedAt}
                >
                  End shift
                </button>
              </div>
            </section>
          )}
        </div>

        <nav className="flex flex-wrap gap-2 mb-8">

          {/* <p className="text-sm text-gray-500">
              Your shift is running at {locations.find(l => l.id === selectedLocationId)?.name || 'Unknown Location'}
            </p> */}

          {locations.map((location) => (
            <button
              key={location.id}
              type="button"
              onClick={() => {
                setIsLocationPopupOpen(true)
                if (selectedLocationId && selectedLocationId !== location.id) {
                  setIsChangedLocation(true)
                } else {
                  setIsChangedLocation(false)
                }
                setLocation({ id: location.id, name: location.name })
              }}

              className={`px-3 py-1.5 rounded-full text-sm border border-gray-200 bg-white text-gray-700 hover:bg-gray-100 hover:border-gray-300 transition-colors shadow-sm ${selectedLocationId === location.id ? 'ring-2 ring-emerald-500' : ''
                }`}
            >
              {location.name}
            </button>
          ))}
        </nav>

        <div className="space-y-6">
          {locations.map((location) => (
            <section key={location.id} id={location.id}>
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
                    }
                    : undefined
                }
              />
            </section>
          ))}
        </div>
      </main>
      {
        isLocationPopupOpen && (

          <div className='fixed inset-0 z-100 flex items-center justify-center bg-black/50 backdrop-blur-sm transition-opacity'>
            <div className="bg-white p-6 rounded-2xl shadow-xl w-full max-w-md transform transition-all">
              {isChangedLocation ? (
                <h2 className="text-2xl font-bold text-amber-600 mb-4">Change Your Location Shift to </h2>
              ) : (
                <h2 className="text-2xl font-bold text-emerald-600 mb-4">Confirm Location Shift as </h2>
              )}
              <h3 className="text-lg font-semibold text-gray-700">{location?.name}</h3>
              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={() => {
                    setIsLocationPopupOpen(false)
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-md hover:bg-emerald-700 transition-colors shadow-sm"
                  onClick={() => {
                    setSelectedLocationId(location?.id || null)
                    setIsLocationPopupOpen(false)
                  }}
                >
                  Yes
                </button>
              </div>
            </div>
          </div>
        )
      }
    </div >
  );
}