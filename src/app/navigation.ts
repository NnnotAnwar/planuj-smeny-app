import { useMemo } from 'react';
import {
    SquaresFourIcon,
    ChartBarIcon,
    CalendarBlankIcon,
    ShieldCheckIcon,
    ClockUserIcon,
    UserCircleGearIcon,
    ClockCounterClockwiseIcon,
    GearIcon,
    MegaphoneIcon,
    type Icon,
} from '@phosphor-icons/react';

import { usePermissions } from '@shared/auth/usePermissions';
import { useTranslation } from '@shared/preferences/PreferencesContext';
import { useRequestsBadge } from '@features/requests/useRequests';
import { useUnreadAnnouncementCount } from '@features/announcements/useUnreadAnnouncementCount';
import type { TranslationKey } from '@shared/i18n/translations';

/**
 * --- NAVIGATION CONFIG ---
 * The single source of truth for every primary destination, shared by the
 * desktop Sidebar and the mobile BottomNav so the two can never drift. Add a
 * destination here once and it appears (gated, badged, grouped) everywhere.
 */

export type NavSection = 'work' | 'manage' | 'system';

/** Render order of the sidebar sections. */
export const NAV_SECTIONS: readonly NavSection[] = ['work', 'manage', 'system'];

/** Section header labels. */
export const SECTION_LABEL_KEYS: Record<NavSection, TranslationKey> = {
    work: 'nav.sectionWork',
    manage: 'nav.sectionManage',
    system: 'nav.sectionSystem',
};

/** Capabilities a nav item can gate on (a subset of usePermissions). */
export interface NavCaps {
    canViewAdminPanel: boolean;
    canManageEmployees: boolean;
}

/** Named live-badge sources, resolved by `useNavItems`. */
type BadgeSource = 'pendingRequests' | 'unreadAnnouncements';

/**
 * Who the mobile tab bar is laid out for. Staff (rank < 20) live in their own
 * schedule and hours; managers and up live in the rota, timesheets and team.
 */
export type MobileAudience = 'staff' | 'manager';

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
    /**
     * Slot in the mobile tab bar per audience (lower = further left); items
     * without a slot for the current audience live in the "More" sheet. The bar
     * holds at most four destinations + "More" (the 3–5 tab rule).
     */
    mobileSlot?: Partial<Record<MobileAudience, number>>;
    badge?: BadgeSource;
}

export const NAV_ITEMS: readonly NavItemDef[] = [
    { id: 'dashboard', labelKey: 'nav.dashboard', shortLabelKey: 'nav.home', icon: SquaresFourIcon, route: '/', section: 'work', mobileSlot: { staff: 1, manager: 1 } },
    { id: 'schedule', labelKey: 'nav.schedule', icon: CalendarBlankIcon, route: '/schedule', section: 'work', mobileSlot: { staff: 2, manager: 2 } },
    { id: 'overview', labelKey: 'nav.myHours', icon: ChartBarIcon, route: '/overview', section: 'work', mobileSlot: { staff: 3 } },
    { id: 'announcements', labelKey: 'nav.announcements', icon: MegaphoneIcon, route: '/announcements', section: 'work', mobileSlot: { staff: 4 }, badge: 'unreadAnnouncements' },
    { id: 'requests', labelKey: 'nav.requests', icon: UserCircleGearIcon, route: '/requests', section: 'work', badge: 'pendingRequests' },
    { id: 'timesheets', labelKey: 'nav.timesheets', icon: ClockUserIcon, route: '/timesheets', section: 'manage', visible: (c) => c.canViewAdminPanel, mobileSlot: { manager: 3 } },
    { id: 'admin', labelKey: 'nav.team', icon: ShieldCheckIcon, route: '/admin', section: 'manage', visible: (c) => c.canViewAdminPanel, mobileSlot: { manager: 4 } },
    
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
    /** Tab-bar slot for the current user's audience, or null = "More" sheet. */
    mobileSlot: number | null;
    badgeCount: number;
}

/**
 * Resolve `NAV_ITEMS` for the current user — filtered by capability, translated,
 * and with live badge counts folded in. Consumed by Sidebar and BottomNav.
 */
export function useNavItems(): ResolvedNavItem[] {
    const { canViewAdminPanel, canManageEmployees } = usePermissions();
    // Deciders: requests waiting for them; everyone else: unseen decisions on their own.
    const pendingRequests = useRequestsBadge();
    const unreadAnnouncements = useUnreadAnnouncementCount();
    const t = useTranslation();

    return useMemo(() => {
        const caps: NavCaps = { canViewAdminPanel, canManageEmployees };
        const audience: MobileAudience = canViewAdminPanel ? 'manager' : 'staff';
        const badges: Record<BadgeSource, number> = { pendingRequests, unreadAnnouncements };
        return NAV_ITEMS.filter((i) => !i.visible || i.visible(caps)).map((i) => ({
            id: i.id,
            label: t(i.labelKey),
            shortLabel: t(i.shortLabelKey ?? i.labelKey),
            icon: i.icon,
            route: i.route,
            section: i.section,
            mobileSlot: i.mobileSlot?.[audience] ?? null,
            badgeCount: i.badge ? badges[i.badge] : 0,
        }));
    }, [canViewAdminPanel, canManageEmployees, pendingRequests, unreadAnnouncements, t]);
}
