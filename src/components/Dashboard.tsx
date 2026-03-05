import { useState, useEffect } from 'react';
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
  closed: { opacity: 0, y: -20 },
  open: { 
    opacity: 1, 
    y: 0,
    transition: { 
      duration: 0.3,
      staggerChildren: 0.05, 
      delayChildren: 0.1 
    } 
  }
};

const itemVariants = {
  closed: { opacity: 0, y: 10 },
  open: { opacity: 1, y: 0 }
};

const navItems = [
  { name: 'Dashboard', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
  { name: 'Overview', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
  { name: 'My Shifts', icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' },
  { name: 'Settings', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z' }
];

function getInitials(name: string): string {
  if (!name) return '??';
  return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
}

export default function Dashboard({ onLocationSelect }: DashboardProps) {
  const { user, logout } = useAuthContext();
  const { locations, selectedLocationId } = useShiftContext();
  const { setTheme, resolvedTheme } = useTheme();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (isMobileMenuOpen) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = 'unset';
    return () => { document.body.style.overflow = 'unset'; };
  }, [isMobileMenuOpen]);

  const filteredLocations = locations.filter(loc => 
    loc.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <>
      <header className="sticky top-0 z-50 h-auto md:min-h-screen w-full md:w-1/3 lg:w-1/4 bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl shadow-sm border-b md:border-b-0 md:border-r border-gray-200 dark:border-white/5 transition-all duration-300">
        <div className="flex flex-col h-full max-w-7xl mx-auto px-4 py-1.5 md:gap-2 md:py-4">

          {/* --- Top Row: Logo & Mobile Toggle --- */}
          <div className="shrink-0 flex justify-between items-center h-10 md:h-12 relative">

            {/* Logo + App Name (Desktop) */}
            <div className="flex items-center gap-3 z-10">
              <div className="w-8 h-8 md:w-9 md:h-9 bg-linear-to-br from-emerald-400 to-emerald-600 rounded-lg flex items-center justify-center shadow-md shadow-emerald-500/20">
                <span className="text-white font-black text-sm md:text-base">PS</span>
              </div>
              <span className="hidden lg:block text-base font-black text-gray-900 dark:text-white tracking-tight">
                Planuj Směny
              </span>
            </div>

            {/* Desktop Theme Toggle */}
            <div className="hidden md:block z-10">
              <button
                onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
                className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-white/5 text-gray-500 dark:text-gray-400 transition-colors cursor-pointer"
                aria-label="Toggle theme"
              >
                {resolvedTheme === 'dark' ? (
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M3 12h2.25m.386-6.364l-1.591 1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M3 12h2.25m.386-6.364l1.591-1.591M12 7.5a4.5 4.5 0 110 9 4.5 4.5 0 010-9z" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
                  </svg>
                )}
              </button>
            </div>


            <div className="absolute inset-0 flex items-center justify-center md:hidden pointer-events-none">
              <div className="text-xl font-bold dark:text-white tracking-tight"><Clock seconds={false} /></div>
            </div>

            <button onClick={() => setIsMobileMenuOpen(true)} className="md:hidden p-2 -mr-2 rounded-xl text-gray-600 dark:text-gray-300 cursor-pointer z-10">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-8 h-8">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
              </svg>
            </button>
          </div>

          {/* --- Desktop User Greeting --- */}
          {user && (
            <div className="hidden md:flex items-center gap-3 px-1 py-3 border-b border-gray-200 dark:border-white/5 mb-1">
              <div className="w-10 h-10 rounded-full bg-linear-to-br from-emerald-100 to-emerald-200 dark:from-emerald-900/40 dark:to-emerald-800/40 border-2 border-white dark:border-white/10 shadow-sm flex items-center justify-center text-emerald-700 dark:text-emerald-400 text-xs font-black shrink-0">
                {getInitials(user.first_name + ' ' + user.last_name)}
              </div>
              <div className="overflow-hidden">
                <p className="text-sm font-bold text-gray-900 dark:text-white truncate">Dobrý den, {user.first_name}!</p>
                <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest leading-none mt-0.5">{user.role}</p>
              </div>
            </div>
          )}

          {/* --- DESKTOP SCROLLABLE CONTENT --- */}
          <div className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-hide py-2 hidden md:flex md:flex-col gap-4">
            <nav className="flex flex-col gap-0.5">
              {navItems.map((item) => (
                <button 
                  key={item.name} 
                  className={`flex items-center gap-3 w-full p-2 rounded-xl transition-all duration-200 cursor-pointer ${
                    item.name === 'Dashboard' 
                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold' 
                      : 'hover:bg-gray-100 dark:hover:bg-white/5 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                  }`}
                >
                  <svg className={`w-4 h-4 ${item.name === 'Dashboard' ? 'text-emerald-500' : 'text-gray-400 dark:text-gray-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={item.icon} />
                  </svg>
                  <span className="text-sm">{item.name}</span>
                </button>
              ))}
            </nav>

            <hr className="border-gray-200 dark:border-white/5" />

            <div className="flex flex-col gap-2">
              <div className="px-2 flex items-center justify-between">
                <p className="font-bold text-[10px] uppercase tracking-widest text-gray-400 dark:text-gray-500">Locations</p>
                <span className="text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-1 py-0.5 rounded-full font-bold">{locations.length}</span>
              </div>
              {locations.length > 5 && (
                <div className="px-2">
                  <div className="relative">
                    <input type="text" placeholder="Search..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full bg-gray-100 dark:bg-white/5 border border-transparent focus:border-emerald-500/50 rounded-xl py-2 pl-8 pr-3 text-xs outline-none transition-all dark:text-white" />
                    <svg className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                  </div>
                </div>
              )}
              <div className="px-1">
                <LocationSelection locations={filteredLocations} selectedLocationId={selectedLocationId} onLocationSelect={onLocationSelect} />
              </div>
            </div>
          </div>

          <div className="shrink-0 hidden md:block mt-auto pt-4 pb-2">
            <button onClick={logout} className="flex w-full items-center justify-center gap-2 text-sm font-bold text-red-600 dark:text-red-400 py-2.5 bg-white dark:bg-gray-900/40 rounded-xl border border-red-100 dark:border-red-900/20 shadow-sm cursor-pointer hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-5 w-5"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" /></svg>
              Logout
            </button>
          </div>
        </div>
      </header>

      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div initial="closed" animate="open" exit="closed" variants={menuVariants} className="fixed inset-0 z-[100] md:hidden bg-linear-to-br from-gray-50 via-white to-gray-100 dark:from-gray-950 dark:via-gray-900 dark:to-slate-950 flex flex-col">
            <div className="flex justify-between items-center px-4 py-3 h-12 shrink-0 border-b border-gray-200 dark:border-white/5">
              <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center shadow-lg">
                <span className="text-white font-black text-sm">PS</span>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')} className="p-2 rounded-xl text-gray-600 dark:text-gray-300">
                  {resolvedTheme === 'dark' ? <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M3 12h2.25m.386-6.364l-1.591 1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M3 12h2.25m.386-6.364l-1.591 1.591M12 7.5a4.5 4.5 0 110 9 4.5 4.5 0 010-9z" /></svg> : <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" /></svg>}
                </button>
                <button onClick={() => setIsMobileMenuOpen(false)} className="p-2 -mr-2 text-gray-900 dark:text-white">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-6">
              {user && (
                <motion.div variants={itemVariants} className="flex items-center gap-4 mb-8 p-4 bg-white/50 dark:bg-white/5 rounded-2xl border border-white/20 dark:border-white/5 shadow-sm">
                  <div className="w-14 h-14 rounded-full bg-linear-to-br from-emerald-100 to-emerald-200 dark:from-emerald-900/40 dark:to-emerald-800/40 border-2 border-white dark:border-white/10 shadow-md flex items-center justify-center text-emerald-700 dark:text-emerald-400 text-xl font-black shrink-0">
                    {getInitials(user.first_name + ' ' + user.last_name)}
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <p className="text-lg font-bold text-gray-900 dark:text-white truncate">Dobrý den, {user.first_name}!</p>
                    <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">{user.role}</p>
                  </div>
                </motion.div>
              )}

              <nav className="flex flex-col gap-1">
                {navItems.map((item) => (
                  <motion.button key={item.name} variants={itemVariants} className="flex items-center gap-4 w-full p-4 rounded-2xl hover:bg-gray-100 dark:hover:bg-white/5 transition-colors text-gray-700 dark:text-gray-300">
                    <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={item.icon} /></svg>
                    <span className="text-lg font-bold">{item.name}</span>
                  </motion.button>
                ))}
              </nav>
            </div>

            <div className="mt-auto p-6 shrink-0 border-t border-gray-200 dark:border-white/5">
              <motion.button variants={itemVariants} onClick={logout} className="flex items-center justify-center gap-3 w-full py-4 text-lg font-bold text-red-600 bg-red-50 dark:bg-red-900/20 rounded-2xl cursor-pointer">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                Logout
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
