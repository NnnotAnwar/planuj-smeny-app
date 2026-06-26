import { useMemo } from 'react';
import {
    SquaresFourIcon,
    ChartBarIcon,
    ShieldCheckIcon,
    ClockUserIcon,
    UserCircleGearIcon,
    ClockCounterClockwiseIcon,
    GearIcon,
    type Icon,
} from '@phosphor-icons/react';

import { usePermissions } from '@shared/auth/usePermissions';
import { useTranslation } from '@shared/preferences/PreferencesContext';
import { usePendingNameRequestCount } from '@features/admin/usePendingNameRequests';
import type { TranslationKey } from '@shared/i18n/translations';

/**
 * --- NAVIGATION CONFIG ---
 * The single source of truth for every primary destination, shared by the
 * desktop Sidebar and the mobile BottomNav so the two can never drift. Add a
 * destination here once and it appears (gated, badged, grouped) everywhere.
 */

export type NavSection = 'work' | 'manage' | 'system';

/** Capabilities a nav item can gate on (a subset of usePermissions). */
export interface NavCaps {
    canViewAdminPanel: boolean;
    canManageEmployees: boolean;
}

/** Named live-badge sources, resolved by `useNavItems`. */
type BadgeSource = 'pendingRequests';

export interface NavItemDef {
    id: string;
    /** Full label (sidebar + mobile "More" sheet). */
    labelKey: TranslationKey;
    /** Compact label for the mobile tab bar; defaults to `labelKey`. */
    shortLabelKey?: TranslationKey;
    icon: Icon;
    route: string;
    section: NavSection;
    /** When omitted the item is always visible; otherwise gated on capabilities. */
    visible?: (caps: NavCaps) => boolean;
    /** Lit directly in the mobile bottom bar; the rest live in the "More" sheet. */
    primaryOnMobile?: boolean;
    badge?: BadgeSource;
}

export const NAV_ITEMS: readonly NavItemDef[] = [
    { id: 'dashboard', labelKey: 'nav.dashboard', shortLabelKey: 'nav.home', icon: SquaresFourIcon, route: '/', section: 'work', primaryOnMobile: true },
    { id: 'overview', labelKey: 'nav.overview', icon: ChartBarIcon, route: '/overview', section: 'work', primaryOnMobile: true },
    { id: 'admin', labelKey: 'nav.adminPanel', shortLabelKey: 'nav.admin', icon: ShieldCheckIcon, route: '/admin', section: 'manage', visible: (c) => c.canViewAdminPanel, primaryOnMobile: true },
    { id: 'timesheets', labelKey: 'nav.timesheets', icon: ClockUserIcon, route: '/timesheets', section: 'manage', visible: (c) => c.canViewAdminPanel },
    { id: 'requests', labelKey: 'nav.requests', icon: UserCircleGearIcon, route: '/requests', section: 'manage', visible: (c) => c.canManageEmployees, badge: 'pendingRequests' },
    { id: 'activity', labelKey: 'nav.activity', icon: ClockCounterClockwiseIcon, route: '/activity', section: 'manage', visible: (c) => c.canManageEmployees },
    { id: 'settings', labelKey: 'nav.settings', icon: GearIcon, route: '/settings', section: 'system' },
];

/** A nav item resolved for the current user: visible, translated and badged. */
export interface ResolvedNavItem {
    id: string;
    label: string;
    shortLabel: string;
    icon: Icon;
    route: string;
    section: NavSection;
    primaryOnMobile: boolean;
    badgeCount: number;
}

/**
 * Resolve `NAV_ITEMS` for the current user — filtered by capability, translated,
 * and with live badge counts folded in. Consumed by Sidebar and BottomNav.
 */
export function useNavItems(): ResolvedNavItem[] {
    const { canViewAdminPanel, canManageEmployees } = usePermissions();
    const pendingRequests = usePendingNameRequestCount();
    const t = useTranslation();

    return useMemo(() => {
        const caps: NavCaps = { canViewAdminPanel, canManageEmployees };
        const badges: Record<BadgeSource, number> = { pendingRequests };
        return NAV_ITEMS.filter((i) => !i.visible || i.visible(caps)).map((i) => ({
            id: i.id,
            label: t(i.labelKey),
            shortLabel: t(i.shortLabelKey ?? i.labelKey),
            icon: i.icon,
            route: i.route,
            section: i.section,
            primaryOnMobile: !!i.primaryOnMobile,
            badgeCount: i.badge ? badges[i.badge] : 0,
        }));
    }, [canViewAdminPanel, canManageEmployees, pendingRequests, t]);
}
