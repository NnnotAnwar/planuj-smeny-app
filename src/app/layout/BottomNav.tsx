import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import {
    SquaresFourIcon,
    ChartBarIcon,
    GearIcon,
    ShieldCheckIcon,
    UserCircleGearIcon,
    DotsThreeOutlineIcon,
    XIcon,
    type Icon,
} from '@phosphor-icons/react';
import { useAuthContext } from '@features/auth/AuthContext';
import { canViewAdminPanel, canManageEmployees } from '@features/admin/permissions';
import { usePendingNameRequestCount } from '@features/admin/usePendingNameRequests';

/**
 * --- BOTTOM NAVIGATION (mobile) ---
 * Persistent native-style tab bar (hidden on md+). Primary destinations live in
 * the bar; secondary ones (Settings, and Requests for admins) are tucked into a
 * "More" sheet that slides in above — but never covers — the bar.
 */

interface NavItem {
    name: string;
    icon: Icon;
    route: string;
}

// Burger-style slide-in (mirrors the old fullscreen menu): the panel springs in
// from the right and staggers its items.
const sheetVariants: Variants = {
    closed: { opacity: 0, x: '100%' },
    open: {
        opacity: 1,
        x: 0,
        transition: { type: 'spring', stiffness: 320, damping: 32, staggerChildren: 0.06, delayChildren: 0.08 },
    },
};

const itemVariants: Variants = {
    closed: { opacity: 0, x: 24 },
    open: { opacity: 1, x: 0 },
};

export function BottomNav() {
    const { user } = useAuthContext();
    const { pathname } = useLocation();
    const [menuOpen, setMenuOpen] = useState(false);

    const isAdmin = !!user && canManageEmployees(user);
    const pending = usePendingNameRequestCount();

    // Primary bar destinations.
    const items: NavItem[] = [
        { name: 'Home', icon: SquaresFourIcon, route: '/' },
        { name: 'Overview', icon: ChartBarIcon, route: '/overview' },
        ...(user && canViewAdminPanel(user) ? [{ name: 'Admin', icon: ShieldCheckIcon, route: '/admin' }] : []),
    ];

    // Destinations that live inside the "More" sheet.
    const moreItems: NavItem[] = [
        ...(isAdmin ? [{ name: 'Requests', icon: UserCircleGearIcon, route: '/requests' }] : []),
        { name: 'Settings', icon: GearIcon, route: '/settings' },
    ];

    // When the sheet is open only "More" is lit; otherwise it's lit on its routes.
    const moreActive = menuOpen || moreItems.some((i) => i.route === pathname);
    const moreBadge = isAdmin ? pending : 0;

    // Lock body scroll while the sheet is open.
    useEffect(() => {
        document.body.style.overflow = menuOpen ? 'hidden' : 'unset';
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [menuOpen]);

    return (
        <>
            {/* FULL-SCREEN "MORE" SHEET — slides in above the bar (never over it). */}
            <AnimatePresence>
                {menuOpen && (
                    <motion.div
                        variants={sheetVariants}
                        initial="closed"
                        animate="open"
                        exit="closed"
                        className="md:hidden fixed inset-x-0 top-0 z-[60] bottom-[calc(4rem+env(safe-area-inset-bottom,0px))] flex flex-col bg-gradient-to-br from-white via-emerald-50 to-gray-100 dark:from-gray-950 dark:via-gray-900 dark:to-slate-950 pt-[env(safe-area-inset-top,0px)]"
                    >
                        <div className="flex justify-between items-center px-5 py-4 shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 bg-linear-to-br from-emerald-400 to-emerald-600 rounded-lg flex items-center justify-center shadow-lg shadow-emerald-500/30">
                                    <span className="text-white font-black text-base">PS</span>
                                </div>
                                <h2 className="text-title text-gray-900 dark:text-white">Menu</h2>
                            </div>
                            <button
                                onClick={() => setMenuOpen(false)}
                                aria-label="Close menu"
                                className="-mr-2 p-1 text-gray-600 dark:text-gray-300 active:scale-90 transition-transform"
                            >
                                <XIcon weight="bold" className="w-7 h-7" />
                            </button>
                        </div>

                        <nav className="flex-1 overflow-y-auto px-4 pb-6 flex flex-col gap-3">
                            {moreItems.map((item) => {
                                const active = item.route === pathname;
                                const badge = item.route === '/requests' ? moreBadge : 0;
                                return (
                                    <motion.div key={item.route} variants={itemVariants}>
                                        <Link
                                            to={item.route}
                                            onClick={() => setMenuOpen(false)}
                                            className={`flex items-center gap-5 w-full p-4 rounded-2xl transition-all ${
                                                active
                                                    ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                                                    : 'bg-white/60 dark:bg-white/5 text-gray-700 dark:text-gray-200 active:scale-[0.98]'
                                            }`}
                                        >
                                            <item.icon weight="bold" className="w-7 h-7 shrink-0" />
                                            <span className="text-xl font-bold tracking-tight">{item.name}</span>
                                            {badge > 0 && (
                                                <span className="ml-auto min-w-6 h-6 px-2 rounded-full bg-emerald-500 text-white text-xs font-bold flex items-center justify-center">
                                                    {badge}
                                                </span>
                                            )}
                                        </Link>
                                    </motion.div>
                                );
                            })}
                        </nav>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* BOTTOM BAR */}
            <nav
                aria-label="Primary"
                className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white/90 dark:bg-gray-900/90 backdrop-blur-xl border-t border-gray-200 dark:border-white/10 pb-[env(safe-area-inset-bottom)]"
            >
                <div className="flex items-stretch justify-around h-16">
                    {items.map((item) => {
                        // While the sheet is open, the bar shows nothing as active
                        // (only "More" is lit) — fixes the double-highlight.
                        const active = !menuOpen && item.route === pathname;
                        return (
                            <Link
                                key={item.route}
                                to={item.route}
                                onClick={() => setMenuOpen(false)}
                                aria-current={active ? 'page' : undefined}
                                className={`flex flex-col items-center justify-center gap-1 flex-1 min-w-0 active:scale-95 transition-transform ${
                                    active ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400 dark:text-gray-500'
                                }`}
                            >
                                <item.icon weight={active ? 'fill' : 'regular'} className="w-6 h-6" />
                                <span className="text-caption">{item.name}</span>
                            </Link>
                        );
                    })}

                    {/* MORE — toggles the sheet. */}
                    <button
                        onClick={() => setMenuOpen((v) => !v)}
                        aria-expanded={menuOpen}
                        aria-label="More"
                        className={`relative flex flex-col items-center justify-center gap-1 flex-1 min-w-0 active:scale-95 transition-transform ${
                            moreActive ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400 dark:text-gray-500'
                        }`}
                    >
                        <DotsThreeOutlineIcon weight={moreActive ? 'fill' : 'regular'} className="w-6 h-6" />
                        <span className="text-caption">More</span>
                        {!menuOpen && moreBadge > 0 && (
                            <span className="absolute top-1.5 right-[calc(50%-1.25rem)] min-w-4 h-4 px-1 rounded-full bg-emerald-500 text-white text-[10px] font-bold flex items-center justify-center">
                                {moreBadge}
                            </span>
                        )}
                    </button>
                </div>
            </nav>
        </>
    );
}
