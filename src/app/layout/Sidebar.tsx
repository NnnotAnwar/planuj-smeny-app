import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode, type SyntheticEvent } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { Link, useLocation } from 'react-router-dom';

import { formatTime } from '@shared/utils/date';
import { Clock } from '@shared/components/Clock';
import { MapPinIcon, SignOutIcon, MagnifyingGlassIcon, SidebarSimpleIcon } from '@phosphor-icons/react';

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
 * Desktop renders as a floating frosted-glass panel inset from the window edge;
 * mobile keeps a slim translucent top bar (BottomNav + HomePage carry the rest).
 * Density is deliberately compact — small type and tight rows that stay legible.
 *
 * This was previously misnamed "Dashboard". It is layout/navigation, not the home dashboard content.
 */

interface SidebarProps {
  onLocationSelect: (locationId: string | null) => void;
  onOpenSearch: () => void;
}

/** "⌘K" on Apple platforms, "Ctrl K" elsewhere — for the search hint. */
const SHORTCUT_LABEL =
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent)
    ? '⌘K'
    : 'Ctrl K';

/** Quiet inset surface shared by the search field and the location card. */
const INSET_SURFACE =
  'bg-white/55 dark:bg-white/5 ring-1 ring-inset ring-ink/6 dark:ring-white/8 hover:bg-white/80 dark:hover:bg-white/8';

/** Icon-rail button geometry + idle colours (collapsed mode). */
const RAIL_BTN = 'relative flex items-center justify-center size-9 rounded-xl transition-colors shrink-0';
const RAIL_IDLE = 'text-ink-soft dark:text-slate-400 hover:bg-white/60 dark:hover:bg-white/5';

/** Map pin in a soft accent disc; a solid dot on its corner marks a live shift. */
function LocationPin({ live }: { live: boolean }) {
  return (
    <span className="relative flex size-7 shrink-0 items-center justify-center rounded-full bg-emerald-500/12 text-emerald-600 dark:text-emerald-300">
      <MapPinIcon className="size-3.5" weight="fill" />
      {live && (
        <span className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-slate-900" />
      )}
    </span>
  );
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
  onSelect?: () => void;
  t: TranslateFn;
}) {
  return (
    <div
      onClick={onSelect}
      className={`group rounded-xl p-2.5 transition-all ${INSET_SURFACE} ${onSelect ? 'cursor-pointer active:scale-[0.985]' : ''}`}
    >
      <div className="flex items-center justify-between">
        <div className="text-eyebrow text-ink-soft dark:text-slate-400">{t('sidebar.currentLocation')}</div>
        <div className="flex items-center gap-1 rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-emerald-700 dark:text-emerald-300">
          <span className="size-1.5 rounded-full bg-emerald-500" />
          <span className="text-eyebrow normal-case tracking-normal">{t('sidebar.onShift')}</span>
        </div>
      </div>

      <div className="mt-2 flex items-center gap-2">
        <LocationPin live />
        <div className="min-w-0 flex-1">
          <div className="font-display text-sm font-bold leading-tight tracking-[-0.01em] text-ink dark:text-white truncate">
            {currentLocation?.name || t('common.unknown')}
          </div>
          <div className="mt-0.5 flex items-center gap-1 text-caption text-ink-soft dark:text-slate-400">
            <span>{t('sidebar.started')}</span>
            <span className="tabular-nums font-semibold text-ink dark:text-slate-200">{formatTime(activeShift.started_at)}</span>
          </div>
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
    <div className="mb-3">
      <div className="text-eyebrow text-ink-soft/70 dark:text-slate-500 mb-1.5 px-2.5">{title}</div>
      <nav className="flex flex-col gap-0.5">
        {items.map((item) => {
          const active = currentPath === item.route;
          return (
            <Link
              key={item.route}
              to={item.route}
              aria-current={active ? 'page' : undefined}
              className={`group flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-meta transition-all ${
                active
                  ? 'bg-emerald-500 text-white font-semibold shadow-md shadow-emerald-500/30'
                  : 'text-ink-soft dark:text-slate-400 hover:bg-white/60 dark:hover:bg-white/5 hover:text-ink dark:hover:text-white'
              }`}
            >
              <item.icon weight={active ? 'fill' : 'regular'} className="size-4 shrink-0" />
              <span className="flex-1 truncate">{item.label}</span>
              {item.badgeCount > 0 && (
                <span
                  className={`ml-auto min-w-4 h-4 px-1 rounded-full text-[10px] font-bold flex items-center justify-center ${
                    active ? 'bg-white/25 text-white' : 'bg-emerald-500 text-white'
                  }`}
                >
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
  live,
  onClick,
  t,
}: {
  selected?: { name: string };
  live: boolean;
  onClick: () => void;
  t: TranslateFn;
}) {
  return (
    <button
      onClick={onClick}
      className={`group w-full text-left rounded-xl p-2.5 cursor-pointer transition-all active:scale-[0.985] ${INSET_SURFACE}`}
    >
      <div className="text-eyebrow text-ink-soft dark:text-slate-400">{t('sidebar.currentLocation')}</div>
      <div className="mt-2 flex items-center gap-2">
        <LocationPin live={live} />
        <div className="min-w-0 flex-1">
          <div className="font-display text-sm font-bold leading-tight tracking-[-0.01em] text-ink dark:text-white truncate">
            {selected ? selected.name : t('location.select')}
          </div>
          <div className="mt-0.5 text-caption text-emerald-600 dark:text-emerald-300 group-hover:underline underline-offset-2">
            {t('location.change')}
          </div>
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
 *
 * `variant="rail"` renders just a pin button for the collapsed icon rail, opening
 * the same flyout — so a location can always be picked without expanding.
 */
function LocationHero({
  locations,
  selectedLocationId,
  activeShift,
  currentLocation,
  isDashboard,
  onLocationSelect,
  variant = 'card',
  t,
}: {
  locations: Array<{ id: string; name: string; archived_at?: string | null }>;
  selectedLocationId: string | null;
  activeShift: Shift | null;
  currentLocation?: { id: string; name: string };
  isDashboard: boolean;
  onLocationSelect: (id: string) => void;
  variant?: 'card' | 'rail';
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
    setPos({ left: r.right + 16, top });
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

  // Rail label names the place you're at (or prompts to pick one).
  const railLabel = (activeShift ? currentLocation?.name : selected?.name) ?? t('location.select');

  return (
    <div ref={ref} className={variant === 'card' ? 'mb-3' : ''}>
      {variant === 'rail' ? (
        <button
          onClick={() => setOpen(true)}
          aria-label={railLabel}
          title={railLabel}
          className={`${RAIL_BTN} ${open ? 'bg-white/70 text-emerald-600 dark:bg-white/8 dark:text-emerald-300' : RAIL_IDLE}`}
        >
          <MapPinIcon weight={activeShift || selected ? 'fill' : 'regular'} className="size-4.5" />
          {activeShift && (
            <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-slate-900" />
          )}
        </button>
      ) : showPost && activeShift ? (
        <CurrentPost currentLocation={currentLocation} activeShift={activeShift} t={t} />
      ) : (
        <LocationPickerTrigger selected={selected} live={!!activeShift} onClick={() => setOpen(true)} t={t} />
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
              className="glass glass-menu fixed z-60 w-72 max-h-[70vh] flex flex-col rounded-2xl p-2"
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

/** Icon-only rail (desktop compact mode). Tooltips via native title; the
 *  location pin opens the picker flyout directly, so nothing needs expanding. */
/**
 * Hover / focus label for an icon-rail button, portalled to <body> so the
 * rail's scroll container can't clip it. Wraps exactly one element.
 */
function RailTip({ label, children }: { label: string; children: ReactNode }) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const show = (e: SyntheticEvent<HTMLSpanElement>) => {
    const el = e.currentTarget.firstElementChild as HTMLElement | null;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setPos({ top: r.top + r.height / 2, left: r.right + 10 });
  };
  const hide = () => setPos(null);
  return (
    <span className="contents" onMouseEnter={show} onMouseLeave={hide} onFocus={show} onBlur={hide}>
      {children}
      {pos &&
        createPortal(
          <span
            role="tooltip"
            style={{ top: pos.top, left: pos.left }}
            className="glass glass-menu pointer-events-none fixed z-70 -translate-y-1/2 whitespace-nowrap rounded-lg px-2 py-1 text-meta font-semibold text-ink dark:text-white"
          >
            {label}
          </span>,
          document.body,
        )}
    </span>
  );
}

/**
 * Collapsed icon rail. Kept compact so a full admin menu fits without
 * scrolling: tools on top (expand · search · location), the nav grouped by
 * section with hairline dividers (mirrors Work / Manage / System when
 * expanded), and "you" at the bottom (notifications · profile · log out).
 * Labels appear on hover/focus.
 */
function CollapsedRail({
  navItems,
  currentPath,
  user,
  onOpenSearch,
  onExpand,
  logout,
  location,
  t,
}: {
  navItems: ResolvedNavItem[];
  currentPath: string;
  user: ReturnType<typeof useAuthContext>['user'];
  onOpenSearch: () => void;
  onExpand: () => void;
  logout: () => void;
  location: ReactNode;
  t: TranslateFn;
}) {
  const groups = NAV_SECTIONS.map((section) => navItems.filter((i) => i.section === section)).filter((g) => g.length > 0);
  const divider = <div aria-hidden className="my-1 h-px w-5 shrink-0 bg-ink/8 dark:bg-white/8" />;

  return (
    <div className="hidden md:flex md:flex-col items-center flex-1 min-h-0 gap-0.5">
      <RailTip label={t('sidebar.expand')}>
        <button onClick={onExpand} aria-label={t('sidebar.expand')} className={`${RAIL_BTN} ${RAIL_IDLE}`}>
          <SidebarSimpleIcon weight="bold" className="size-4.5" />
        </button>
      </RailTip>
      <RailTip label={`${t('cmd.search')} · ${SHORTCUT_LABEL}`}>
        <button onClick={onOpenSearch} aria-label={t('cmd.search')} className={`${RAIL_BTN} ${RAIL_IDLE}`}>
          <MagnifyingGlassIcon weight="bold" className="size-4.5" />
        </button>
      </RailTip>
      {/* LOCATION — pick / see where you are without expanding */}
      {location}

      {divider}

      <nav className="flex-1 min-h-0 w-full overflow-y-auto scrollbar-hide flex flex-col items-center gap-0.5" aria-label={t('nav.menu')}>
        {groups.map((items, gi) => (
          <div key={gi} className="contents">
            {gi > 0 && divider}
            {items.map((item) => {
              const active = currentPath === item.route;
              return (
                <RailTip key={item.route} label={item.badgeCount > 0 ? `${item.label} · ${item.badgeCount}` : item.label}>
                  <Link
                    to={item.route}
                    aria-label={item.label}
                    aria-current={active ? 'page' : undefined}
                    className={`${RAIL_BTN} ${active ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/25' : RAIL_IDLE}`}
                  >
                    <item.icon weight={active ? 'fill' : 'regular'} className="size-4.5" />
                    {item.badgeCount > 0 && (
                      <span className="absolute top-1 right-1 size-2 rounded-full bg-rose-500 ring-2 ring-white dark:ring-slate-900" />
                    )}
                  </Link>
                </RailTip>
              );
            })}
          </div>
        ))}
      </nav>

      {divider}

      <div className={RAIL_BTN}>
        <NotificationsBell />
      </div>
      {user && (
        <RailTip label={`${user.first_name || user.username} · ${t('nav.profile')}`}>
          <Link to="/profile" aria-label={t('nav.profile')} className={`${RAIL_BTN} ${RAIL_IDLE}`}>
            <span className="size-6.5 rounded-full bg-linear-to-br from-emerald-400 to-emerald-600 ring-2 ring-white dark:ring-white/15 flex items-center justify-center text-white text-[10px] font-display font-bold">
              {getFullInitials(user.first_name, user.last_name)}
            </span>
          </Link>
        </RailTip>
      )}
      <RailTip label={t('nav.logout')}>
        <button onClick={logout} aria-label={t('nav.logout')} className={`${RAIL_BTN} text-rose-600 dark:text-rose-400 hover:bg-rose-500/8`}>
          <SignOutIcon weight="bold" className="size-4.5" />
        </button>
      </RailTip>
    </div>
  );
}

export function Sidebar({ onLocationSelect, onOpenSearch }: SidebarProps) {
  const { user, logout } = useAuthContext();
  const { locations, selectedLocationId, activeShift } = useShiftContext();
  const t = useTranslation();
  const navItems = useNavItems();
  const currentRoute = useLocation();

  // Desktop compact "icon-rail" mode, persisted across sessions.
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('sidebar-collapsed') === '1');
  const toggleCollapsed = () => {
    setCollapsed((v) => {
      const next = !v;
      localStorage.setItem('sidebar-collapsed', next ? '1' : '0');
      return next;
    });
  };

  // Current location is the heart of the experience
  const currentLocation = locations.find((l) => l.id === selectedLocationId);

  const heroProps = {
    locations,
    selectedLocationId,
    activeShift,
    currentLocation,
    isDashboard: currentRoute.pathname === '/',
    onLocationSelect,
    t,
  };

  return (
    <header
      className={`sticky top-0 z-50 w-full text-ink dark:text-slate-100 flex flex-col transition-all duration-300
        max-md:bg-white/75 max-md:dark:bg-slate-950/70 max-md:backdrop-blur-xl max-md:border-b max-md:border-white/70 max-md:dark:border-white/5
        md:glass md:top-3 md:m-3 md:h-[calc(100dvh-1.5rem)] md:shrink-0 md:rounded-2xl ${collapsed ? 'md:w-16' : 'md:w-64'}`}
    >
      <div className="flex flex-col h-full px-3 pt-[calc(0.25rem+env(safe-area-inset-top,0px))] pb-1 md:px-3 md:pt-3 md:pb-3">
        {/* Top brand row — desktop: logo + collapse + bell; mobile: logo, centred clock, search + bell */}
        <div className={`shrink-0 flex justify-between items-center h-10 md:h-9 relative md:mb-3 ${collapsed ? 'md:justify-center' : ''}`}>
          <div className="flex items-center gap-2 z-10">
            <div className="size-8 bg-linear-to-br from-emerald-400 to-emerald-600 rounded-lg flex items-center justify-center shadow-md shadow-emerald-500/30 ring-1 ring-white/40">
              <span className="font-display text-white font-black text-sm tracking-[-0.04em]">PS</span>
            </div>
            {/* Hidden in the collapsed rail — a 2-line wrap would overflow the rail width. */}
            <span className={`${collapsed ? 'hidden' : 'hidden lg:block'} font-display font-bold tracking-[-0.02em] text-sm whitespace-nowrap text-ink dark:text-white`}>
              Planuj Směny
            </span>
          </div>

          {/* Desktop: collapse toggle + notifications bell (hidden when collapsed —
              they live in the icon rail instead). */}
          <div className={`z-10 items-center ${collapsed ? 'hidden' : 'hidden md:flex'}`}>
            <button
              onClick={toggleCollapsed}
              aria-label={t('sidebar.collapse')}
              title={t('sidebar.collapse')}
              className="p-1.5 rounded-lg text-ink-soft dark:text-slate-400 hover:bg-white/70 dark:hover:bg-white/5 active:scale-90 transition-all"
            >
              <SidebarSimpleIcon weight="bold" className="size-4.5" />
            </button>
            <NotificationsBell />
          </div>

          {/* Mobile: centered clock */}
          <div className="absolute inset-0 flex items-center justify-center md:hidden pointer-events-none">
            <div className="text-base font-semibold tabular-nums tracking-tight text-ink dark:text-white">
              <Clock seconds={false} />
            </div>
          </div>

          {/* Mobile: search + notifications bell */}
          <div className="md:hidden z-10 flex items-center">
            <button
              onClick={onOpenSearch}
              aria-label={t('cmd.search')}
              className="p-2 rounded-xl text-ink-soft dark:text-slate-300 hover:bg-white/70 dark:hover:bg-white/5 active:scale-90 transition-all"
            >
              <MagnifyingGlassIcon weight="bold" className="size-5" />
            </button>
            <NotificationsBell />
          </div>
        </div>

        {/* All heavy sidebar content is hidden on mobile (BottomNav + HomePage handle mobile UX) */}
        {collapsed ? (
          <CollapsedRail
            navItems={navItems}
            currentPath={currentRoute.pathname}
            user={user}
            onOpenSearch={onOpenSearch}
            onExpand={toggleCollapsed}
            logout={logout}
            location={<LocationHero {...heroProps} variant="rail" />}
            t={t}
          />
        ) : (
          <div className="hidden md:flex md:flex-col flex-1 min-h-0">
            {/* Scrollable region: search → profile → hero → nav. Footer stays pinned. */}
            <div className="flex-1 min-h-0 overflow-y-auto emerald-scrollbar -mx-1 px-1">
              {/* SEARCH — opens the ⌘K command palette; the kbd hint makes it discoverable */}
              <button
                onClick={onOpenSearch}
                className={`w-full flex items-center gap-2 mb-3 px-2.5 py-1.5 rounded-lg text-ink-soft dark:text-slate-400 transition-colors ${INSET_SURFACE}`}
              >
                <MagnifyingGlassIcon weight="bold" className="size-3.5 shrink-0" />
                <span className="flex-1 text-left text-meta">{t('cmd.search')}…</span>
                <kbd className="font-sans text-[10px] font-semibold px-1.5 py-0.5 rounded bg-white/85 dark:bg-white/10 ring-1 ring-ink/8 dark:ring-white/10 text-ink-soft dark:text-slate-300">
                  {SHORTCUT_LABEL}
                </kbd>
              </button>

              {/* USER — avatar + name + role, quiet and tight */}
              {user && (
                <Link
                  to="/profile"
                  className="flex items-center gap-2.5 mb-3 px-2 py-1.5 rounded-lg hover:bg-white/60 dark:hover:bg-white/5 transition-colors"
                >
                  <div className="size-8 rounded-full bg-linear-to-br from-emerald-400 to-emerald-600 ring-2 ring-white dark:ring-white/15 shadow-sm shadow-emerald-500/25 flex items-center justify-center text-white text-[11px] font-display font-bold shrink-0">
                    {getFullInitials(user.first_name, user.last_name)}
                  </div>
                  <div className="min-w-0">
                    <div className="font-display text-sm font-bold tracking-[-0.01em] text-ink dark:text-white truncate leading-tight">
                      {user.first_name || user.username}
                    </div>
                    <div className="mt-0.5 text-eyebrow text-ink-soft dark:text-slate-400">{user.role.name}</div>
                  </div>
                </Link>
              )}

              {/* HERO — picker trigger on the dashboard, live current-post elsewhere;
                  same height so navigating never shifts the layout. Opens the picker
                  flyout to the right of the sidebar. */}
              <LocationHero {...heroProps} />

              {/* NAVIGATION — grouped into Work / Manage / System */}
              {NAV_SECTIONS.map((section) => (
                <SidebarNavSection
                  key={section}
                  title={t(SECTION_LABEL_KEYS[section])}
                  items={navItems.filter((i) => i.section === section)}
                  currentPath={currentRoute.pathname}
                />
              ))}
            </div>

            {/* FOOTER — log out, aligned with the nav rows */}
            <div className="pt-2 border-t border-ink/6 dark:border-white/6 shrink-0">
              <button
                onClick={logout}
                className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-meta text-rose-600 dark:text-rose-400 hover:bg-rose-500/8 transition-colors"
              >
                <SignOutIcon weight="bold" className="size-4" />
                <span>{t('nav.logout')}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
