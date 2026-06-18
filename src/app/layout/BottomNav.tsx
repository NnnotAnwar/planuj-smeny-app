import { Link, useLocation } from 'react-router-dom';
import { SquaresFourIcon, ChartBarIcon, GearIcon, ShieldCheckIcon, type Icon } from '@phosphor-icons/react';
import { useAuthContext } from '@features/auth/AuthContext';
import { canViewAdminPanel } from '@features/admin/permissions';

/**
 * --- BOTTOM NAVIGATION (mobile) ---
 * Persistent native-style tab bar. Replaces the previous hamburger-only nav as
 * the primary way to move around on phones (the hamburger overlay stays for
 * secondary actions: profile, theme, logout, location search). Hidden on md+.
 */

interface NavItem {
    name: string;
    icon: Icon;
    route: string;
}

export function BottomNav() {
    const { user } = useAuthContext();
    const { pathname } = useLocation();

    const items: NavItem[] = [
        { name: 'Home', icon: SquaresFourIcon, route: '/' },
        { name: 'Overview', icon: ChartBarIcon, route: '/overview' },
        ...(user && canViewAdminPanel(user) ? [{ name: 'Admin', icon: ShieldCheckIcon, route: '/admin' }] : []),
        { name: 'Settings', icon: GearIcon, route: '/settings' },
    ];

    return (
        <nav
            aria-label="Primary"
            className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white/90 dark:bg-gray-900/90 backdrop-blur-xl border-t border-gray-200 dark:border-white/10 pb-[env(safe-area-inset-bottom)]"
        >
            <div className="flex items-stretch justify-around h-16">
                {items.map((item) => {
                    const active = item.route === pathname;
                    return (
                        <Link
                            key={item.route}
                            to={item.route}
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
            </div>
        </nav>
    );
}
