import { useState } from 'react';
import LocationSelection from './LocationSelection';
import Clock from './Clock';
import { useAuthContext } from '../context/AuthContext';
import { useShiftContext } from '../context/ShiftContext';
import { useTheme } from '../context/ThemeContext';
import { motion, AnimatePresence } from 'framer-motion';

interface DashboardProps {
  onLocationSelect: (locationId: string | null) => void;
}

const menuVariants = {
  closed: { opacity: 0, backdropFilter: "blur(0px)" },
  open: { 
    opacity: 1, 
    backdropFilter: "blur(20px)",
    transition: { staggerChildren: 0.05, delayChildren: 0.1 } 
  }
};

const itemVariants = {
  closed: { opacity: 0, y: 10 },
  open: { opacity: 1, y: 0 }
};

export default function Dashboard({
  onLocationSelect,
}: DashboardProps) {
  const { user, logout } = useAuthContext();
  const { locations, selectedLocationId } = useShiftContext();
  const { setTheme, resolvedTheme } = useTheme();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredLocations = locations.filter(loc => 
    loc.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <>
      <header className="sticky top-0 z-50 h-auto md:min-h-screen w-full md:w-1/3 lg:w-1/4 bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl shadow-sm border-b md:border-b-0 md:border-r border-gray-200 dark:border-white/5 transition-all duration-300">
        <div className="flex flex-col h-full max-w-7xl mx-auto px-4 py-1.5 md:gap-3 md:py-6">

          {/* --- Top Row: Logo, Centered Clock (Mobile), & Menu Toggle --- */}
          <div className="shrink-0 flex justify-between items-center h-12 md:h-auto relative">
            <div className="flex items-center z-10">
              <div className="w-10 h-10 bg-linear-to-br from-emerald-400 to-emerald-600 rounded-xl flex items-center justify-center shadow-md shadow-emerald-500/20">
                <span className="text-white font-black text-xl tracking-wider">PS</span>
              </div>
            </div>

            <div className="absolute inset-0 flex items-center justify-center md:hidden pointer-events-none">
              <div className="text-xl font-bold dark:text-white tracking-tight">
                <Clock seconds={false} />
              </div>
            </div>

            <div className="hidden md:flex items-center gap-3">
              {user && (
                <div className="text-right">
                  <p className="text-sm font-bold text-gray-900 dark:text-gray-100 leading-tight">
                    {user.first_name} {user.last_name}
                  </p>
                  <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">{user.role}</p>
                </div>
              )}
            </div>

            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="md:hidden p-2 -mr-2 rounded-xl text-gray-600 dark:text-gray-300 cursor-pointer z-10"
              aria-label="Open menu"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-8 h-8">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
              </svg>
            </button>
          </div>

          {/* --- DESKTOP SCROLLABLE CONTENT --- */}
          <div className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-hide py-4 hidden md:flex md:flex-col gap-6">
            <nav className="flex flex-col gap-1">
              {['Dashboard', 'Overview', 'My Shifts', 'Settings'].map((item) => (
                <button key={item} className={`text-left p-2 rounded-xl transition-all duration-200 cursor-pointer ${item === 'Dashboard' ? 'bg-gray-100 dark:bg-white/10 dark:text-white font-bold shadow-xs' : 'hover:bg-gray-50 dark:hover:bg-white/5 dark:text-gray-300 text-gray-600'}`}>
                  {item}
                </button>
              ))}
            </nav>

            <hr className="border-gray-200 dark:border-white/5" />

            <div className="flex flex-col gap-3">
              <div className="px-2 flex items-center justify-between">
                <p className="font-bold text-xs uppercase tracking-widest text-gray-500 dark:text-gray-400">Locations</p>
                <span className="text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-1.5 py-0.5 rounded-full font-bold">{locations.length}</span>
              </div>

              {locations.length > 5 && (
                <div className="px-2">
                  <div className="relative">
                    <input 
                      type="text"
                      placeholder="Search..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full bg-gray-100 dark:bg-white/5 border border-transparent focus:border-emerald-500/50 rounded-xl py-2 pl-8 pr-3 text-xs outline-none transition-all dark:text-white"
                    />
                    <svg className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                </div>
              )}

              <div className="px-1">
                <LocationSelection 
                  locations={filteredLocations} 
                  selectedLocationId={selectedLocationId} 
                  onLocationSelect={onLocationSelect} 
                />
              </div>
            </div>
          </div>

          {/* --- DESKTOP ONLY: Logout Button --- */}
          <div className="shrink-0 hidden md:block mt-auto pt-4 pb-2">
            <button
              onClick={logout}
              className="flex w-full items-center justify-center gap-2 text-sm font-bold text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 transition-all hover:bg-red-50 dark:hover:bg-red-900/10 border border-red-100 dark:border-red-900/20 rounded-xl p-2.5 bg-white dark:bg-gray-900/40 shadow-sm cursor-pointer"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-5 w-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
              </svg>
              Logout
            </button>
          </div>
        </div>
      </header>

      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div initial="closed" animate="open" exit="closed" variants={menuVariants} className="fixed inset-0 z-[100] md:hidden bg-white/95 dark:bg-gray-950/95 flex flex-col p-6">
            <div className="flex justify-between items-center mb-12">
              <div className="w-9 h-9 bg-emerald-500 rounded-lg flex items-center justify-center shadow-lg">
                <span className="text-white font-black text-lg">PS</span>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')} className="p-2 rounded-xl bg-gray-100 dark:bg-white/10 text-gray-900 dark:text-white">
                  {resolvedTheme === 'dark' ? <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M3 12h2.25m.386-6.364l-1.591 1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M3 12h2.25m.386-6.364l1.591-1.591M12 7.5a4.5 4.5 0 110 9 4.5 4.5 0 010-9z" /></svg> : <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" /></svg>}
                </button>
                <button onClick={() => setIsMobileMenuOpen(false)} className="p-2 text-gray-900 dark:text-white"><svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>
              </div>
            </div>

            <div className="flex flex-col items-center justify-center flex-1 gap-8">
              {user && (
                <motion.div variants={itemVariants} className="text-center">
                  <p className="text-xl font-bold dark:text-white">{user.first_name} {user.last_name}</p>
                  <p className="text-emerald-500 text-sm font-medium">{user.role}</p>
                </motion.div>
              )}
              <nav className="flex flex-col items-center gap-6">
                {['Dashboard', 'Overview', 'My Shifts', 'Settings'].map((item) => (
                  <motion.button key={item} variants={itemVariants} className={`text-xl font-bold ${item === 'Dashboard' ? 'text-emerald-500' : 'text-gray-500 dark:text-gray-400'}`}>
                    {item}
                  </motion.button>
                ))}
              </nav>
            </div>

            <motion.div variants={itemVariants} className="mt-auto pb-10 flex justify-center w-full px-4">
              <button onClick={logout} className="text-lg font-bold text-red-500 px-8 py-3 rounded-2xl bg-red-50 dark:bg-red-900/20 w-full max-w-[200px]">Logout</button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
