import { type Location, type User } from '../types/types'
import { useState, useEffect } from 'react'
import LocationSelection from './LocationSelection';
/** Props for the app header: current user or null. */
interface DashboardProps {
  user: Pick<User, 'username' | 'first_name' | 'last_name' | 'role'>
  locProbs: LocationProbs
  onLogout: () => void
}

interface LocationProbs {
  locations: Location[],
  selectedLocationId: string | null,
  handleLocationSelect: (locationId: string | null) => void
}


/** Builds initials from full name (e.g. "Ahmed Taha" → "AT"). */
function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();
}

/**
 * Sticky app header: logo, title, and current user avatar + role.
 * No nav actions (login/admin) while auth is disabled.
 */
export default function Dashboard({ user, locProbs, onLogout }: DashboardProps) {

  const [currentTime, setCurrentTime] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formattedTime = currentTime.toLocaleTimeString('en-GB', {
    hour: '2-digit', minute: '2-digit'
  });

  return (
    <header className="sticky top-0 z-50 h-auto w-full md:w-1/3 lg:w-1/4 bg-white/80 backdrop-blur-sm shadow-sm border-b border-gray-200 transition-all duration-300">
      <div className="flex flex-col h-full max-w-7xl mx-auto px-4 py-1.5 md:gap-3">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3 group">
            <div className="w-10 h-10 bg-linear-to-br from-emerald-400 to-emerald-600 rounded-xl flex items-center justify-center shadow-md shadow-emerald-200 group-hover:shadow-emerald-300 transition-all duration-300 transform group-hover:-translate-y-0.5">
              <span className="text-white font-black text-xl tracking-wider">PS</span>
            </div>
            {/* <span className="font-extrabold text-gray-800 tracking-tight hidden md:inline text-2xl">
              Planuj Směny
            </span> */}
          </div>
          <div className="text-xl font-bold md:hidden">{formattedTime}</div>

          <div className="flex items-center gap-4 sm:gap-6">
            {user && (
              <div className="flex items-center gap-3">
                <div className="hidden lg:block text-right">
                  <p className="text-sm font-bold text-gray-900 leading-tight">{user.first_name} {user.last_name}</p>
                  <p className="text-xs font-medium text-emerald-600">{user.role}</p>
                </div>
                <div className="w-10 h-10 rounded-full bg-emerald-100 border-2 border-emerald-200 flex items-center justify-center text-emerald-700 font-bold shadow-sm">
                  {getInitials(user.username)}
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="hidden md:flex flex-col text-lg gap-2 font-semibold">
          <button className='text-left p-1 rounded-xl'>
            Dashboard
          </button>
          <button className='text-left p-1 rounded-xl bg-gray-100'>
            Overview
          </button>
          <button className='text-left p-1 rounded-xl'>
            My Shifts
          </button>
          <button className='text-left p-1 rounded-xl'>
            Settings
          </button>
        </div>

        <hr className="border-gray-200" />
        <div className="hidden md:flex flex-col gap-2">
          <p className="font-semibold text-md text-gray-700">Locations</p>
          <LocationSelection
            locations={locProbs.locations}
            selectedLocationId={locProbs.selectedLocationId}
            onLocationSelect={locProbs.handleLocationSelect}
          />
        </div>
        <div className="">
          <button
            onClick={onLogout}
            className="hidden md:inline text-sm font-medium text-white hover:text-gray-100 transition-colors hover:bg-red-800 border-red-200 rounded p-2 bg-red-600"
          >
            Logout
          </button>
        </div>
      </div>

    </header>
  );
}
