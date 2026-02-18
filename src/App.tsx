
import { useState } from 'react';
import './App.css';
import Dashboard from './components/Dashboard';
import ShiftCards from './components/ShiftCards';
import { useAuth } from './auth/AuthContext';

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
  { id: 6, name: 'Alina Melnikova', role: 'Waiter', start: '14:00', end: '23:30' },
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
  const { user } = useAuth();
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const [endedAt, setEndedAt] = useState<string | null>(null);

  const scrollToLocation = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleStartShift = () => {
    const now = new Date();
    const time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setStartedAt(time);
    setEndedAt(null);
  };

  const handleEndShift = () => {
    const now = new Date();
    const time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setEndedAt(time);
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
                  Your shift, {user.role === 'Admin' ? 'Admin' : 'Supervisor'}:
                </p>
                <p className="text-sm text-gray-600 mt-1">
                  {startedAt
                    ? endedAt
                      ? `Shift finished. Started at ${startedAt}, ended at ${endedAt}.`
                      : `Shift running. Started at ${startedAt}.`
                    : 'You have not started your shift yet.'}
                </p>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleStartShift}
                  className="px-4 py-2 text-sm font-semibold rounded-md bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
                  disabled={!!startedAt && !endedAt}
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
          {locations.map((location) => (
            <button
              key={location.id}
              type="button"
              onClick={() => scrollToLocation(location.id)}
              className="px-3 py-1.5 rounded-full text-sm border border-gray-200 bg-white text-gray-700 hover:bg-gray-100 hover:border-gray-300 transition-colors shadow-sm"
            >
              {location.name}
            </button>
          ))}
        </nav>

        <div className="space-y-6">
          {locations.map((location, index) => (
            <section key={location.id} id={location.id}>
              <ShiftCards
                locationName={location.name}
                shifts={location.shifts}
                userShift={
                  index === 0 && user
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
    </div>
  );
}