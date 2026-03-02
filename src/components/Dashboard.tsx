import { useState } from 'react';
import LocationSelection from './LocationSelection';
import Clock from './Clock';
import { useAuthContext } from '../context/AuthContext';
import { useShiftContext } from '../context/ShiftContext';

interface DashboardProps {
  onLocationSelect: (locationId: string | null) => void;
}

function getInitials(name: string): string {
  if (!name) return '??';
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();
}

export default function Dashboard({
  onLocationSelect,
}: DashboardProps) {
  const { user, logout } = useAuthContext();
  const { locations, selectedLocationId } = useShiftContext();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 h-auto w-full md:w-1/3 lg:w-1/4 bg-white/80 backdrop-blur-sm shadow-sm border-b border-gray-200 transition-all duration-300">
      <div className="flex flex-col h-full max-w-7xl mx-auto px-4 py-1.5 md:gap-3 md:py-4">

        {/* --- Top Row: Logo, Clock & User Profile --- */}
        <div className="flex justify-between items-center">

          <div className="flex items-center gap-3 group">
            <div className="w-10 h-10 bg-linear-to-br from-emerald-400 to-emerald-600 rounded-xl flex items-center justify-center shadow-md shadow-emerald-200 group-hover:shadow-emerald-300 transition-all duration-300 transform group-hover:-translate-y-0.5">
              <span className="text-white font-black text-xl tracking-wider">PS</span>
            </div>
          </div>

          <p className="mb-0 md:hidden text-center text-xl font-bold block">
            <Clock seconds={false} />
          </p>

          {/* User Section (Relative for dropdown positioning) */}
          <div className="relative flex items-center gap-4 sm:gap-6">
            {user && (
              <div className="flex items-center gap-3">
                <div className="hidden lg:block text-right">
                  <p className="text-sm font-bold text-gray-900 leading-tight">
                    {user.first_name} {user.last_name}
                  </p>
                  <p className="text-xs font-medium text-emerald-600">{user.role}</p>
                </div>

                {/* Avatar Button (Opens menu on mobile, static on desktop) */}
                <button
                  onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                  className="w-10 h-10 rounded-full bg-emerald-100 border-2 border-emerald-200 flex items-center justify-center text-emerald-700 font-bold shadow-sm transition-transform active:scale-95 md:pointer-events-none"
                  aria-label="User menu"
                >
                  {getInitials(user.username)}
                </button>
              </div>
            )}

            {/* --- MOBILE DROPDOWN MENU --- */}
            {isMobileMenuOpen && (
              <div className="absolute right-0 top-12 mt-2 w-56 rounded-2xl border border-gray-100 bg-white p-2 shadow-xl md:hidden">

                {/* Mobile User Info inside dropdown */}
                <div className="mb-2 border-b border-gray-100 px-2 pb-2">
                  <p className="text-sm font-bold text-gray-900">
                    {user?.first_name} {user?.last_name}
                  </p>
                  <p className="text-xs font-medium text-emerald-600">{user?.role}</p>
                </div>

                <nav className="flex flex-col gap-1">
                  <button className="rounded-xl bg-gray-50 p-2 text-left text-sm font-semibold text-gray-900">
                    Dashboard
                  </button>
                  <button className="rounded-xl p-2 text-left text-sm font-semibold text-gray-600 transition-colors hover:bg-gray-50 hover:text-gray-900">
                    Overview
                  </button>
                  <button className="rounded-xl p-2 text-left text-sm font-semibold text-gray-600 transition-colors hover:bg-gray-50 hover:text-gray-900">
                    My Shifts
                  </button>
                  <button className="rounded-xl p-2 text-left text-sm font-semibold text-gray-600 transition-colors hover:bg-gray-50 hover:text-gray-900">
                    Settings
                  </button>

                  <hr className="my-1 border-gray-100" />

                  {/* Mobile Logout Button */}
                  <button
                    onClick={logout}
                    className="flex w-full items-center gap-2 rounded-xl p-2 text-left text-sm font-bold text-red-600 transition-colors hover:bg-red-50"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-4 w-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
                    </svg>
                    Logout
                  </button>
                </nav>
              </div>
            )}
          </div>
        </div>

        {/* --- DESKTOP ONLY: Navigation Links --- */}
        <nav className="hidden md:flex flex-col text-lg gap-2 font-semibold mt-4">
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

        <hr className="hidden md:block border-gray-200 mt-2" />

        {/* --- DESKTOP ONLY: Location Selection --- */}
        <div className="hidden md:flex flex-col gap-2 mt-2">
          <p className="font-semibold text-md text-gray-700">Locations</p>
          <LocationSelection
            locations={locations}
            selectedLocationId={selectedLocationId}
            onLocationSelect={onLocationSelect}
          />
        </div>

        {/* --- DESKTOP ONLY: Logout Button --- */}
        <div className="hidden md:block mt-auto pt-4">
          <button
            onClick={logout}
            className="flex w-full items-center justify-center gap-2 text-sm font-medium text-red-600 hover:text-red-700 transition-colors hover:bg-red-50 border border-red-100 rounded-xl p-2.5 bg-white shadow-sm"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-5 w-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
            </svg>
            Logout
          </button>
        </div>

      </div>
    </header>
  );
}
