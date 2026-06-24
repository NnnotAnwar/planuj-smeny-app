import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useLocation } from 'react-router-dom';
import { SquaresFourIcon, ChartBarIcon, GearIcon, ShieldCheckIcon, ListIcon, XIcon, SignOutIcon, CaretRightIcon, PaletteIcon } from "@phosphor-icons/react";

import { Clock } from '@shared/components/Clock';
import { useAuthContext } from '@features/auth/AuthContext';
import { useShiftContext } from '@features/shifts/ShiftContext';
import { useTheme } from '@app/providers/ThemeContext';
import { LocationSelection } from '@features/locations/components/LocationSelection';
import { canViewAdminPanel } from '@features/admin/permissions';

/**
 * --- DASHBOARD COMPONENT ---
 * The main sidebar/header navigation. 
 * Restored to original visual specifications.
 */

interface DashboardProps {
  onLocationSelect: (locationId: string | null) => void;
}

function getInitials(firstName?: string | null, lastName?: string | null): string {
  const f = firstName?.[0] || '';
  const l = lastName?.[0] || '';
  const initials = (f + l).toUpperCase();
  return initials || '??';
}

export function Dashboard({ onLocationSelect }: DashboardProps) {
  const { user, logout } = useAuthContext();
  const { locations, selectedLocationId } = useShiftContext();

  const navItems = [
    { name: 'Dashboard', icon: SquaresFourIcon, route: '/' },
    { name: 'Overview', icon: ChartBarIcon, route: '/overview' },
    ...(user && canViewAdminPanel(user) ? [{ name: 'Admin Panel', icon: ShieldCheckIcon, route: '/admin' }] : []),
    { name: 'Settings', icon: GearIcon, route: '/settings' }
  ];

  const { setTheme, resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const [searchQuery, setSearchQuery] = useState('');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const currentRoute = useLocation();

  // Lock background scroll while the mobile menu sheet is open.
  useEffect(() => {
    document.body.style.overflow = isMenuOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [isMenuOpen]);

  const fullName =
    user && (user.first_name || user.last_name)
      ? `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim()
      : user?.username ?? '';

  const filteredLocations = locations.filter(loc =>
    // hide archived, but keep the one you're currently clocked into
    (!loc.archived_at || loc.id === selectedLocationId) &&
    loc.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <>
      <header className="sticky top-0 z-50 md:h-dvh w-full md:w-1/3 lg:w-1/4 bg-white/40 dark:bg-gray-900/80 backdrop-blur-xl shadow-sm border-b md:border-b-0 md:border-r border-emerald-500/10 dark:border-white/5 transition-all duration-300">
        <div className="flex flex-col md:h-full max-w-7xl mx-auto px-4 py-1.5 md:gap-2 md:py-4 pt-[calc(0.375rem+env(safe-area-inset-top,0px))]">
          <div className="shrink-0 flex justify-between items-center h-10 md:h-12 relative">
            <div className="flex items-center gap-3 z-10">
              <div className="w-8 h-8 md:w-9 md:h-9 bg-linear-to-br from-emerald-400 to-emerald-600 rounded-lg flex items-center justify-center shadow-lg shadow-emerald-500/30 transition-all">
                <span className="text-white font-black text-sm md:text-base">PS</span>
              </div>
              <span className="hidden lg:block text-base font-black text-gray-800 dark:text-white tracking-tight">Planuj Směny</span>
            </div>

            <div className="hidden md:block z-10">
              <button onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')} className="p-2 rounded-xl hover:bg-emerald-500/5 dark:hover:bg-white/5 text-gray-500 dark:text-gray-400 transition-all cursor-pointer active:scale-90" aria-label="Toggle theme">
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div key={resolvedTheme} initial={{ y: -5, opacity: 0, rotate: -45 }} animate={{ y: 0, opacity: 1, rotate: 0 }} exit={{ y: 5, opacity: 0, rotate: 45 }} transition={{ duration: 0.2 }}>
                    {resolvedTheme === 'dark' ? <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M3 12h2.25m.386-6.364l-1.591 1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M3 12h2.25m.386-6.364l-1.591 1.591M12 7.5a4.5 4.5 0 110 9 4.5 4.5 0 010-9z" /></svg> : <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" /></svg>}
                  </motion.div>
                </AnimatePresence>
              </button>
            </div>

            <div className="absolute inset-0 flex items-center justify-center md:hidden pointer-events-none">
              <div className="text-xl font-bold text-gray-800 dark:text-white tracking-tight"><Clock seconds={false} /></div>
            </div>

            <button onClick={() => setIsMenuOpen(true)} className="md:hidden -mr-2 p-2 rounded-xl text-gray-700 dark:text-gray-200 hover:bg-emerald-500/5 dark:hover:bg-white/5 transition-all cursor-pointer active:scale-90 z-10" aria-label="Open menu">
              <ListIcon weight="bold" className="w-7 h-7" />
            </button>
          </div>

          {user && (
            <div className="hidden md:flex items-center gap-3 p-3 mb-3 bg-white/50 dark:bg-white/5 rounded-2xl border border-gray-100 dark:border-white/5 shadow-xl shadow-emerald-500/5 transition-all">
              <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/40 border-2 border-white dark:border-white/10 shadow-md flex items-center justify-center text-emerald-700 dark:text-emerald-400 text-xs font-black shrink-0">
                {getInitials(user.first_name, user.last_name)}
              </div>
              <div className="overflow-hidden">
                <p className="text-body-strong text-gray-800 dark:text-white truncate">Dobrý den, {user.first_name || user.username}!</p>
                <p className="text-micro text-emerald-600 dark:text-emerald-400 mt-0.5">{user.role.name}</p>
              </div>
            </div>
          )}

          <div className="flex-1 overflow-y-auto scrollbar-hide py-2 hidden md:flex md:flex-col gap-4">
            <nav className="flex flex-col gap-0.5">
              {navItems.map((item) => (
                <Link to={item?.route || '/'} key={item.name} className={`flex items-center p-2 gap-3 w-full rounded-xl transition-all duration-200 cursor-pointer 
                ${item.route === currentRoute.pathname
                    ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-bold'
                    : 'hover:bg-emerald-500/5 text-gray-500 dark:text-gray-400 hover:text-emerald-700 dark:hover:text-gray-200'}`
                }>
                  {item.icon && <item.icon />}
                  <span className="text-body">{item.name}</span>
                </Link>
              ))}
            </nav>
            <hr className="border-emerald-500/10 dark:border-white/5" />
            <AnimatePresence mode="wait">
              {currentRoute.pathname === '/' && (
                <motion.div
                  key="locations-search-block"
                  initial={{ opacity: 0, y: -15, height: 0 }}
                  animate={{
                    opacity: 1,
                    y: 0,
                    height: 'auto',
                    transition: {
                      type: 'spring',
                      bounce: 0.25,
                      duration: 0.5,
                      height: { duration: 0.4 },
                      opacity: { duration: 0.3, delay: 0.1 }
                    }
                  }}
                  exit={{
                    opacity: 0,
                    y: -10,
                    height: 0,
                    transition: { duration: 0.3, ease: 'easeIn' }
                  }}
                  className="flex flex-col gap-2 overflow-hidden">
                  <div className="px-2 flex items-center justify-between">
                    <p className="text-label text-gray-400 dark:text-gray-500">Locations</p>
                    <span className="text-micro bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-1.5 py-0.5 rounded-full">{locations.length}</span>
                  </div>
                  <div className="px-2">
                    <div className="relative">
                      <input type="text" placeholder="Search..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full bg-emerald-500/5 dark:bg-white/5 border border-transparent focus:border-emerald-500/20 rounded-xl py-2 pl-8 pr-3 text-small outline-none transition-all dark:text-white" />
                      <svg className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                    </div>
                  </div>
                  <div className="px-1 overflow-y-auto max-h-[35vh] emerald-scrollbar pb-4 overscroll-contain">
                    <LocationSelection
                      locations={filteredLocations}
                      selectedLocationId={selectedLocationId}
                      onLocationSelect={onLocationSelect}
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="shrink-0 hidden md:block mt-auto pt-4 pb-2">
            <button onClick={logout} className="flex w-full items-center justify-center gap-2 text-body-strong text-red-600 dark:text-red-400 py-2.5 bg-white dark:bg-gray-900/40 rounded-xl border border-red-100 dark:border-red-900/20 shadow-sm cursor-pointer hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-5 w-5"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" /></svg>
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* --- MOBILE "MORE" MENU (sheet over the app) --- */}
      <AnimatePresence>
        {isMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[100] md:hidden bg-black/40 backdrop-blur-sm"
            onClick={() => setIsMenuOpen(false)}
          >
            <motion.aside
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', stiffness: 380, damping: 38 }}
              onClick={(e) => e.stopPropagation()}
              className="absolute right-0 top-0 h-dvh w-[88%] max-w-sm flex flex-col bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl border-l border-gray-100 dark:border-white/10 shadow-2xl"
            >
              {/* Header — just "Menu", no logo */}
              <div className="flex items-center justify-between px-5 h-14 shrink-0 border-b border-gray-100 dark:border-white/5 pt-[env(safe-area-inset-top)]">
                <h2 className="text-title text-gray-900 dark:text-white">Menu</h2>
                <button
                  onClick={() => setIsMenuOpen(false)}
                  aria-label="Close menu"
                  className="-mr-2 p-2 rounded-xl text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors active:scale-90"
                >
                  <XIcon weight="bold" className="w-5 h-5" />
                </button>
              </div>

              {/* Scrollable content */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {/* Profile */}
                {user && (
                  <div className="flex items-center gap-3 p-4 rounded-2xl bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/5">
                    <div className="w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-900/40 border-2 border-white dark:border-white/10 shadow-md flex items-center justify-center text-emerald-700 dark:text-emerald-400 text-title shrink-0">
                      {getInitials(user.first_name, user.last_name)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-body-strong text-gray-900 dark:text-white truncate">{fullName}</p>
                      <p className="text-caption text-gray-500 dark:text-gray-400 truncate">{user.email}</p>
                      <p className="text-micro text-emerald-600 dark:text-emerald-400 truncate normal-case">@{user.username}</p>
                    </div>
                  </div>
                )}

                {/* Services */}
                <div className="rounded-2xl bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/5 overflow-hidden">
                  <Link
                    to="/settings"
                    onClick={() => setIsMenuOpen(false)}
                    className="flex items-center gap-3 p-4 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
                  >
                    <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                      <GearIcon weight="bold" className="w-4 h-4" />
                    </div>
                    <span className="flex-1 text-body-strong text-gray-900 dark:text-white">Settings</span>
                    <CaretRightIcon weight="bold" className="w-4 h-4 text-gray-400" />
                  </Link>

                  <div className="border-t border-gray-100 dark:border-white/5" />

                  <button
                    onClick={() => setTheme(isDark ? 'light' : 'dark')}
                    className="w-full flex items-center gap-3 p-4 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors text-left"
                  >
                    <div className="w-9 h-9 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 flex items-center justify-center shrink-0">
                      <PaletteIcon weight="bold" className="w-4 h-4" />
                    </div>
                    <span className="flex-1 text-body-strong text-gray-900 dark:text-white">Dark mode</span>
                    <span className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${isDark ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-600'}`}>
                      <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${isDark ? 'translate-x-5' : ''}`} />
                    </span>
                  </button>
                </div>
              </div>

              {/* Pinned logout */}
              <div className="shrink-0 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] border-t border-gray-100 dark:border-white/5">
                <button
                  onClick={logout}
                  className="flex w-full items-center justify-center gap-2 py-3.5 rounded-2xl text-body-strong text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/20 active:scale-[0.99] transition-all"
                >
                  <SignOutIcon weight="bold" className="w-5 h-5" />
                  Log out
                </button>
              </div>
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
