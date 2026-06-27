import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { Link, useLocation } from 'react-router-dom';

import { formatTime } from '@shared/utils/date';
import { Clock } from '@shared/components/Clock';
import { MapPinIcon, SignOutIcon, CaretRightIcon } from '@phosphor-icons/react';

import { useAuthContext } from '@features/auth/AuthContext';
import { useShiftContext } from '@features/shifts/ShiftContext';
import { useTranslation } from '@shared/preferences/PreferencesContext';
import { getFullInitials } from '@shared/utils/getInitials';
import { useNavItems, NAV_SECTIONS, SECTION_LABEL_KEYS, type ResolvedNavItem } from '../navigation';
import { useRecentLocations } from '@features/locations/useRecentLocations';
import { LocationPicker } from '@features/locations/components/LocationPicker';

import { type Shift } from '@shared/types';

type TranslateFn = ReturnType<typeof useTranslation>;
import { NotificationsBell } from '@features/notifications/NotificationsBell';

/**
 * Sidebar
 *
 * The persistent left navigation / dispatch panel (desktop) and top header (mobile).
 * Designed as a "command board" — the most important information is always the user's current physical post.
 *
 * This was previously misnamed "Dashboard". It is layout/navigation, not the home dashboard content.
 */

interface SidebarProps {
  onLocationSelect: (locationId: string | null) => void;
}

/** The signature element — shows the active shift location ("Aktuální směna").
 *  Only rendered when a shift has been started (no "Vybraná směna" panel when idle).
 */
function CurrentPost({
  currentLocation,
  activeShift,
  onSelect,
  t,
}: {
  currentLocation?: { id: string; name: string };
  activeShift: Shift;
  onSelect: () => void;
  t: TranslateFn;
}) {
  return (
    <div
      onClick={onSelect}
      className="group mb-4 rounded-2xl border p-3 cursor-pointer transition-all active:scale-[0.985] bg-gray-100 dark:bg-[color-mix(in_srgb,var(--grad-to)_85%,black)] border-emerald-200 dark:border-emerald-400/40 hover:border-emerald-300 dark:hover:border-emerald-400/70"
    >
      <div className="flex items-center justify-between mb-1">
        <div className="uppercase text-[10px] font-semibold tracking-[1px] text-gray-500 dark:text-slate-400">
          {t('sidebar.currentPost')}
        </div>
        <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse" />
          <span className="text-[10px] font-medium tracking-wider">{t('sidebar.onShift')}</span>
        </div>
      </div>

      <div className="flex items-start gap-2.5">
        <div className="mt-0.5 rounded-lg p-1 bg-emerald-100 dark:bg-emerald-400/10 text-emerald-600 dark:text-emerald-400">
          <MapPinIcon className="w-4 h-4" weight="fill" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[15px] font-semibold leading-tight tracking-[-0.2px] text-gray-900 dark:text-white">
            {currentLocation?.name || t('common.unknown')}
          </div>

          {activeShift && (
            <div className="mt-0.5 text-xs text-gray-500 dark:text-slate-400 flex items-center gap-1.5">
              <span>{t('sidebar.started')}</span>
              <span className="font-mono tabular-nums">
                {formatTime(activeShift.started_at)}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** One labelled navigation section (header + vertical list with active state). */
function SidebarNavSection({
  title,
  items,
  currentPath,
}: {
  title: string;
  items: ResolvedNavItem[];
  currentPath: string;
}) {
  if (items.length === 0) return null;
  return (
    <div className="mb-2.5">
      <div className="uppercase text-[10px] font-semibold tracking-[1px] text-gray-500 dark:text-slate-500 mb-1 px-3">
        {title}
      </div>
      <nav className="flex flex-col gap-0.5">
        {items.map((item) => {
        const active = currentPath === item.route;
        return (
          <Link
            key={item.route}
            to={item.route}
            className={`group flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm transition-all ${
              active
                ? 'bg-gray-100 dark:bg-[color-mix(in_srgb,var(--grad-to)_85%,black)] text-gray-900 dark:text-white font-medium border-l-2 border-emerald-500 -ml-0.5 pl-3.5'
                : 'text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-(--grad-to)/80 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            <item.icon className="w-4 h-4 opacity-80" />
            <span className="flex-1">{item.label}</span>
            {item.badgeCount > 0 && (
              <span className="ml-auto bg-emerald-500 dark:bg-emerald-400 text-white dark:text-[#0B1120] text-[10px] font-bold px-1.5 rounded-full min-w-4.25 h-4.25 flex items-center justify-center">
                {item.badgeCount}
              </span>
            )}
          </Link>
        );
        })}
      </nav>
    </div>
  );
}

/** Picker trigger card — mirrors CurrentPost's size exactly so swapping between
 *  the two never shifts the layout. */
function LocationPickerTrigger({
  selected,
  onClick,
  t,
}: {
  selected?: { name: string };
  onClick: () => void;
  t: TranslateFn;
}) {
  return (
    <button
      onClick={onClick}
      className="group w-full text-left rounded-2xl border p-3 cursor-pointer transition-all active:scale-[0.985] bg-gray-100 dark:bg-[color-mix(in_srgb,var(--grad-to)_85%,black)] border-gray-200 dark:border-slate-700 hover:border-emerald-300 dark:hover:border-emerald-400/60"
    >
      <div className="flex items-center justify-between mb-1">
        <div className="uppercase text-[10px] font-semibold tracking-[1px] text-gray-500 dark:text-slate-400">
          {t('sidebar.availablePosts')}
        </div>
        <CaretRightIcon className="w-3.5 h-3.5 text-gray-400 transition-transform group-hover:translate-x-0.5" />
      </div>
      <div className="flex items-start gap-2.5">
        <div className="mt-0.5 rounded-lg p-1 bg-emerald-100 dark:bg-emerald-400/10 text-emerald-600 dark:text-emerald-400">
          <MapPinIcon className="w-4 h-4" weight="fill" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[15px] font-semibold leading-tight tracking-[-0.2px] text-gray-900 dark:text-white truncate">
            {selected ? selected.name : t('location.select')}
          </div>
          <div className="mt-0.5 text-xs text-gray-500 dark:text-slate-400">{t('location.change')}</div>
        </div>
      </div>
    </button>
  );
}

/**
 * The sidebar "hero" slot. On the dashboard it shows the location picker trigger;
 * elsewhere (while on shift) it shows the live CurrentPost — both the same height,
 * so navigating never shifts the layout. Tapping either opens the shared
 * LocationPicker in a flyout popover anchored to the RIGHT of the sidebar, so it
 * never overlaps the nav.
 */
function LocationHero({
  locations,
  selectedLocationId,
  activeShift,
  currentLocation,
  isDashboard,
  onLocationSelect,
  t,
}: {
  locations: Array<{ id: string; name: string; archived_at?: string | null }>;
  selectedLocationId: string | null;
  activeShift: Shift | null;
  currentLocation?: { id: string; name: string };
  isDashboard: boolean;
  onLocationSelect: (id: string) => void;
  t: TranslateFn;
}) {
  const { recentIds, recordPick } = useRecentLocations();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  const selected = locations.find((l) => l.id === selectedLocationId);
  const showPost = !!activeShift && !isDashboard;

  const place = useCallback(() => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    // Flyout sits just to the right of the sidebar, vertically clamped to stay on screen.
    const top = Math.max(8, Math.min(r.top, window.innerHeight - 420));
    setPos({ left: r.right + 8, top });
  }, []);

  useLayoutEffect(() => {
    if (open) place();
  }, [open, place]);

  useEffect(() => {
    if (!open) return;
    const onMove = () => place();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('resize', onMove);
    window.addEventListener('scroll', onMove, true);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('resize', onMove);
      window.removeEventListener('scroll', onMove, true);
      window.removeEventListener('keydown', onKey);
    };
  }, [open, place]);

  const handleSelect = (id: string) => {
    recordPick(id);
    onLocationSelect(id);
    setOpen(false);
  };

  return (
    <div ref={ref} className="mb-4">
      {showPost && activeShift ? (
        <CurrentPost currentLocation={currentLocation} activeShift={activeShift} onSelect={() => setOpen(true)} t={t} />
      ) : (
        <LocationPickerTrigger selected={selected} onClick={() => setOpen(true)} t={t} />
      )}

      {open &&
        pos &&
        createPortal(
          <>
            <div className="fixed inset-0 z-59" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, x: -8, scale: 0.98 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
              role="dialog"
              className="fixed z-60 w-72 max-h-[70vh] flex flex-col rounded-2xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-(--grad-to) shadow-2xl p-2"
              style={{ left: pos.left, top: pos.top }}
            >
              <LocationPicker
                locations={locations}
                selectedLocationId={selectedLocationId}
                recentIds={recentIds}
                isOnShift={!!activeShift}
                onSelect={handleSelect}
              />
            </motion.div>
          </>,
          document.body,
        )}
    </div>
  );
}

export function Sidebar({ onLocationSelect }: SidebarProps) {
  const { user, logout } = useAuthContext();
  const { locations, selectedLocationId, activeShift } = useShiftContext();
  const t = useTranslation();
  const navItems = useNavItems();
  const currentRoute = useLocation();

  // Current location is the heart of the experience
  const currentLocation = locations.find((l) => l.id === selectedLocationId);

  return (
    <header className="sticky top-0 z-50 md:h-dvh w-full md:w-80 bg-white/90 dark:bg-(--grad-to) backdrop-blur-xl text-gray-900 dark:text-slate-100 border-b md:border-b-0 md:border-r border-gray-200 dark:border-slate-800 flex flex-col">
      <div className="flex flex-col h-full px-3 pt-[calc(0.25rem+env(safe-area-inset-top,0px))] pb-1 md:pt-2.5 md:pb-2.5">
        {/* Top brand row - restore original mobile header with centered time */}
        <div className="shrink-0 flex justify-between items-center h-10 md:h-12 relative md:mb-4">
          <div className="flex items-center gap-3 z-10">
            <div className="w-8 h-8 md:w-9 md:h-9 bg-linear-to-br from-emerald-400 to-emerald-600 rounded-lg flex items-center justify-center shadow-sm">
              <span className="text-white font-black text-sm md:text-base tracking-[-0.5px]">PS</span>
            </div>
            <span className="hidden lg:block font-semibold tracking-[-0.2px] text-base text-gray-900 dark:text-white">Planuj Směny</span>
          </div>

          {/* Desktop: notifications bell */}
          <div className="hidden md:block z-10">
            <NotificationsBell />
          </div>

          {/* Mobile: centered clock */}
          <div className="absolute inset-0 flex items-center justify-center md:hidden pointer-events-none">
            <div className="text-xl font-bold text-gray-800 dark:text-white tracking-tight">
              <Clock seconds={false} />
            </div>
          </div>

          {/* Mobile: notifications bell */}
          <div className="md:hidden z-10">
            <NotificationsBell />
          </div>
        </div>

        {/* All heavy sidebar content is hidden on mobile (BottomNav + HomePage handle mobile UX) */}
        <div className="hidden md:flex md:flex-col flex-1 min-h-0 py-1">

        {/* Scrollable region: profile → nav → locations. Footer stays pinned. */}
        <div className="flex-1 min-h-0 overflow-y-auto emerald-scrollbar -mx-1 px-1">

        {/* USER — secondary, quiet (styled like mobile profile) */}
        {user && (
          <Link
            to="/profile"
            className="flex items-center gap-3 mb-4 px-3 py-2 rounded-2xl bg-white/70 dark:bg-white/5 border border-gray-100 dark:border-white/5 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
          >
            <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/40 border-2 border-white dark:border-white/10 shadow-md flex items-center justify-center text-emerald-700 dark:text-emerald-400 text-xs font-semibold shrink-0">
              {getFullInitials(user.first_name, user.last_name)}
            </div>
            <div className="min-w-0">
              <div className="text-sm font-medium text-gray-800 dark:text-slate-200 truncate">
                {user.first_name || user.username}
              </div>
              <div className="text-[10px] uppercase tracking-[0.5px] text-gray-500 dark:text-slate-500">
                {user.role.name}
              </div>
            </div>
          </Link>
        )}

        {/* HERO — picker trigger on the dashboard, live current-post elsewhere;
            same height so navigating never shifts the layout. Opens the picker
            flyout to the right of the sidebar. */}
        <LocationHero
          locations={locations}
          selectedLocationId={selectedLocationId}
          activeShift={activeShift}
          currentLocation={currentLocation}
          isDashboard={currentRoute.pathname === '/'}
          onLocationSelect={onLocationSelect}
          t={t}
        />

        {/* NAVIGATION — grouped into Work / Manage / System */}
        {NAV_SECTIONS.map((section) => (
          <SidebarNavSection
            key={section}
            title={t(SECTION_LABEL_KEYS[section])}
            items={navItems.filter((i) => i.section === section)}
            currentPath={currentRoute.pathname}
          />
        ))}

        </div> {/* close scroll region */}

        {/* FOOTER — minimal, clear action */}
        <div className="pt-3 border-t border-gray-200 dark:border-slate-800 shrink-0">
          <button
            onClick={logout}
            className="w-full flex items-center justify-center gap-2 text-sm text-red-600 dark:text-red-400 py-1.5 rounded-xl bg-white dark:bg-gray-900/40 border border-red-100 dark:border-red-900/20 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors"
          >
            <SignOutIcon className="w-4 h-4" />
            <span className="font-medium">{t('nav.logout')}</span>
          </button>
        </div>

        </div> {/* close md: content wrapper */}
      </div>
    </header>
  );
}
