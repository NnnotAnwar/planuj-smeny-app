import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import {
    SquaresFourIcon,
    ChartBarIcon,
    GearIcon,
    ShieldCheckIcon,
    UserCircleGearIcon,
    ClockUserIcon,
    ClockCounterClockwiseIcon,
    DotsThreeOutlineIcon,
    XIcon,
    SignOutIcon,
    PaletteIcon,
    CaretRightIcon,
    type Icon,
} from '@phosphor-icons/react';
import { useAuthContext } from '@features/auth/AuthContext';
import { useTheme } from '@app/providers/ThemeContext';
import { usePermissions } from '@shared/auth/usePermissions';
import { useTranslation } from '@shared/preferences/PreferencesContext';
import { usePendingNameRequestCount } from '@features/admin/usePendingNameRequests';

function getInitials(firstName?: string | null, lastName?: string | null): string {
    return ((firstName?.[0] ?? '') + (lastName?.[0] ?? '')).toUpperCase() || '?';
}

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
    const { user, logout } = useAuthContext();
    const { resolvedTheme, setTheme } = useTheme();
    const isDark = resolvedTheme === 'dark';
    const { pathname } = useLocation();
    const [menuOpen, setMenuOpen] = useState(false);

    const fullName =
        user && (user.first_name || user.last_name)
            ? `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim()
            : user?.username ?? '';

    const { canViewAdminPanel, canManageEmployees: isAdmin } = usePermissions();
    const t = useTranslation();
    const pending = usePendingNameRequestCount();

    // Primary bar destinations.
    const items: NavItem[] = [
        { name: t('nav.home'), icon: SquaresFourIcon, route: '/' },
        { name: t('nav.overview'), icon: ChartBarIcon, route: '/overview' },
        ...(canViewAdminPanel ? [{ name: t('nav.admin'), icon: ShieldCheckIcon, route: '/admin' }] : []),
    ];

    // Destinations that live inside the "More" sheet.
    const moreItems: NavItem[] = [
        ...(canViewAdminPanel ? [{ name: t('nav.timesheets'), icon: ClockUserIcon, route: '/timesheets' }] : []),
        ...(isAdmin ? [{ name: t('nav.requests'), icon: UserCircleGearIcon, route: '/requests' }] : []),
        ...(isAdmin ? [{ name: t('nav.activity'), icon: ClockCounterClockwiseIcon, route: '/activity' }] : []),
        { name: t('nav.settings'), icon: GearIcon, route: '/settings' },
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
                        className="md:hidden fixed inset-x-0 top-0 z-[60] bottom-[calc(4rem+env(safe-area-inset-bottom,0px))] flex flex-col bg-white/80 dark:bg-gray-900/80 backdrop-blur-2xl pt-[env(safe-area-inset-top,0px)]"
                    >
                        {/* Header — just "Menu", no logo */}
                        <div className="flex justify-between items-center px-5 h-14 shrink-0 border-b border-gray-200/70 dark:border-white/5">
                            <h2 className="text-title text-gray-900 dark:text-white">{t('nav.menu')}</h2>
                            <button
                                onClick={() => setMenuOpen(false)}
                                aria-label="Close menu"
                                className="-mr-2 p-2 rounded-xl text-gray-500 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5 active:scale-90 transition-all"
                            >
                                <XIcon weight="bold" className="w-6 h-6" />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 space-y-4">
                            {/* Profile */}
                            {user && (
                                <motion.div variants={itemVariants}>
                                    <Link
                                        to="/profile"
                                        onClick={() => setMenuOpen(false)}
                                        className="flex items-center gap-3 p-4 rounded-2xl bg-white/70 dark:bg-white/5 border-2 border-gray-200 dark:border-white/20 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
                                    >
                                        <div className="w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-900/40 border-2 border-white dark:border-white/10 ring-1 ring-white/60 dark:ring-white/20 shadow-md flex items-center justify-center text-emerald-700 dark:text-emerald-400 text-title shrink-0">
                                            {getInitials(user.first_name, user.last_name)}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-body-strong text-gray-900 dark:text-white truncate">{fullName}</p>
                                            <p className="text-caption text-gray-500 dark:text-gray-400 truncate">{user.email}</p>
                                            <p className="text-micro text-emerald-600 dark:text-emerald-400 truncate normal-case">@{user.username}</p>
                                        </div>
                                    </Link>
                                </motion.div>
                            )}

                            {/* Services */}
                            <motion.div
                                variants={itemVariants}
                                className="rounded-2xl bg-white/70 dark:bg-white/5 border border-gray-100 dark:border-white/5 overflow-hidden"
                            >
                                {moreItems.map((item, i) => {
                                    const badge = item.route === '/requests' ? moreBadge : 0;
                                    return (
                                        <Link
                                            key={item.route}
                                            to={item.route}
                                            onClick={() => setMenuOpen(false)}
                                            className={`flex items-center gap-3 p-4 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors ${i > 0 ? 'border-t border-gray-100 dark:border-white/5' : ''}`}
                                        >
                                            <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                                                <item.icon weight="bold" className="w-4 h-4" />
                                            </div>
                                            <span className="flex-1 text-body-strong text-gray-900 dark:text-white">{item.name}</span>
                                            {badge > 0 && (
                                                <span className="min-w-5 h-5 px-1.5 rounded-full bg-emerald-600 text-white text-micro flex items-center justify-center">{badge}</span>
                                            )}
                                            <CaretRightIcon weight="bold" className="w-4 h-4 text-gray-400" />
                                        </Link>
                                    );
                                })}

                                {/* Dark mode */}
                                <button
                                    onClick={() => setTheme(isDark ? 'light' : 'dark')}
                                    className="w-full flex items-center gap-3 p-4 border-t border-gray-100 dark:border-white/5 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors text-left"
                                >
                                    <div className="w-9 h-9 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 flex items-center justify-center shrink-0">
                                        <PaletteIcon weight="bold" className="w-4 h-4" />
                                    </div>
                                    <span className="flex-1 text-body-strong text-gray-900 dark:text-white">Dark mode</span>
                                    <span className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${isDark ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-600'}`}>
                                        <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${isDark ? 'translate-x-5' : ''}`} />
                                    </span>
                                </button>
                            </motion.div>
                        </div>

                        {/* Pinned logout */}
                        <motion.div variants={itemVariants} className="shrink-0 p-4 border-t border-gray-200/70 dark:border-white/5">
                            <button
                                onClick={logout}
                                className="flex w-full items-center justify-center gap-2 py-3.5 rounded-2xl text-body-strong text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/20 active:scale-[0.99] transition-all"
                            >
                                <SignOutIcon weight="bold" className="w-5 h-5" />
                                {t('nav.logout')}
                            </button>
                        </motion.div>
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
                        aria-label={t('nav.more')}
                        className={`relative flex flex-col items-center justify-center gap-1 flex-1 min-w-0 active:scale-95 transition-transform ${
                            moreActive ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400 dark:text-gray-500'
                        }`}
                    >
                        <DotsThreeOutlineIcon weight={moreActive ? 'fill' : 'regular'} className="w-6 h-6" />
                        <span className="text-caption">{t('nav.more')}</span>
                        {!menuOpen && moreBadge > 0 && (
                            <span className="absolute top-1.5 right-[calc(50%-1.25rem)] min-w-4 h-4 px-1 rounded-full bg-emerald-600 text-white text-[10px] font-bold flex items-center justify-center">
                                {moreBadge}
                            </span>
                        )}
                    </button>
                </div>
            </nav>
        </>
    );
}
