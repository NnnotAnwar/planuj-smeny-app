import { type Location, type User } from '../types/types';
import LocationSelection from './LocationSelection';
import Clock from './Clock';

interface DashboardProps {
  user: Pick<User, 'username' | 'first_name' | 'last_name' | 'role'>;
  locations: Location[];
  selectedLocationId: string | null;
  onLocationSelect: (locationId: string | null) => void;
  onLogout: () => void;
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();
}

export default function Dashboard({
  user,
  locations,
  selectedLocationId,
  onLocationSelect,
  onLogout,
}: DashboardProps) {
  return (
    <header className="sticky top-0 z-50 h-auto w-full md:w-1/3 lg:w-1/4 bg-white/80 backdrop-blur-sm shadow-sm border-b border-gray-200 transition-all duration-300">
      <div className="flex flex-col h-full max-w-7xl mx-auto px-4 py-1.5 md:gap-3">

        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3 group">
            <div className="w-10 h-10 bg-linear-to-br from-emerald-400 to-emerald-600 rounded-xl flex items-center justify-center shadow-md shadow-emerald-200 group-hover:shadow-emerald-300 transition-all duration-300 transform group-hover:-translate-y-0.5">
              <span className="text-white font-black text-xl tracking-wider">PS</span>
            </div>
          </div>
          <p className="mb-2 md:hidden text-center text-xl font-bold block">
            <Clock seconds={false} />
          </p>

          <div className="flex items-center gap-4 sm:gap-6">
            {user && (
              <div className="flex items-center gap-3">
                <div className="hidden lg:block text-right">
                  <p className="text-sm font-bold text-gray-900 leading-tight">
                    {user.first_name} {user.last_name}
                  </p>
                  <p className="text-xs font-medium text-emerald-600">{user.role}</p>
                </div>
                <div className="w-10 h-10 rounded-full bg-emerald-100 border-2 border-emerald-200 flex items-center justify-center text-emerald-700 font-bold shadow-sm">
                  {getInitials(user.username)}
                </div>
              </div>
            )}
          </div>
        </div>

        <nav className="hidden md:flex flex-col text-lg gap-2 font-semibold">
          <button className="text-left p-1 rounded-xl hover:bg-gray-50 transition-colors">
            Dashboard
          </button>
          <button className="text-left p-1 rounded-xl bg-gray-100">
            Overview
          </button>
          <button className="text-left p-1 rounded-xl hover:bg-gray-50 transition-colors">
            My Shifts
          </button>
          <button className="text-left p-1 rounded-xl hover:bg-gray-50 transition-colors">
            Settings
          </button>
        </nav>

        <hr className="border-gray-200" />

        <div className="hidden md:flex flex-col gap-2">
          <p className="font-semibold text-md text-gray-700">Locations</p>
          <LocationSelection
            locations={locations}
            selectedLocationId={selectedLocationId}
            onLocationSelect={onLocationSelect}
          />
        </div>

        <div>
          <button
            onClick={onLogout}
            className="hidden md:block text-sm font-medium text-white hover:text-gray-100 transition-colors hover:bg-red-700 border-red-200 rounded p-2 bg-red-600 w-full"
          >
            Logout
          </button>
        </div>

      </div>
    </header>
  );
}