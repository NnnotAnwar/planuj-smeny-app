import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowClockwiseIcon, CoffeeIcon } from '@phosphor-icons/react';
import { type AppOutletContext } from './AppShell';

import { ActiveShift } from '@features/shifts/components/ActiveShift';
import { NextShiftCard } from '@features/schedule/components/NextShiftCard';
import { CheckIn } from '@features/shifts/components/CheckIn';
import { ShiftCards } from '@features/shifts/components/ShiftCards';
import { MobileLocationField } from '@features/locations/components/MobileLocationField';
import { UserProfileModal } from '@features/profile/components/UserProfileModal';
import { AnnouncementBanner } from '@features/announcements/AnnouncementBanner';
import { useTranslation } from '@shared/preferences/PreferencesContext';
import { DashboardHeader } from './DashboardHeader';
import { GettingStarted } from './GettingStarted';
import { usePullToRefresh } from '@shared/hooks/usePullToRefresh';
import { shiftKeys } from '@features/shifts/shiftKeys';
import { type ShiftDisplayData } from '@shared/types';
import { formatTime } from '@shared/utils/date';


/**
 * --- HOME PAGE ---
 * This is the main screen of the application. 
 * It shows the current status, colleague status, and shift check-in options.
 */

export function HomePage() {
  // Get data from the AppShell parent context.
  const { user, activeShift, allActiveShifts, locations, selectedLocationId, handleLocationSelect } = useOutletContext<AppOutletContext>();

  // Which worker's profile modal is open (from tapping an active-shift card).
  const [profileUserId, setProfileUserId] = useState<string | null>(null);
  const t = useTranslation();
  const qc = useQueryClient();

  // Pull down (at the top) to refresh the board + locations.
  const { pull, refreshing, threshold } = usePullToRefresh(async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: shiftKeys.all }),
      qc.invalidateQueries({ queryKey: ['locations'] }),
      new Promise((r) => setTimeout(r, 500)), // keep the spinner visible briefly
    ]);
  });

  if (!user) return null;

  // Archived locations stay available for history-name resolution (Overview) but
  // must not appear as places you can pick or clock in at — except the one you're
  // currently clocked into, so you never lose sight of where you are.
  const activeLocations = locations.filter((l) => !l.archived_at || l.id === activeShift?.location_id);

  // The board only shows locations with something happening — colleagues on
  // shift there, or your own active shift — so it scales with activity, not with
  // the (ever-growing) total number of locations.
  const userFullName = `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.username;
  const board = activeLocations
    .map((location) => {
      const colleagues: ShiftDisplayData[] = allActiveShifts
        .filter((s) => s.location_id === location.id && s.user_id !== user.id)
        .map((s) => {
          const prevLoc = s.previous_location_id ? locations.find((l) => l.id === s.previous_location_id) : null;
          return {
            id: s.id,
            userId: s.user_id,
            start: formatTime(s.started_at),
            name: `${s.profiles?.first_name || 'Employee'} ${s.profiles?.last_name || ''}`.trim(),
            role: s.role,
            end: null,
            previousLocationName: prevLoc?.name,
            isChangeLocation: !!s.previous_location_id,
          };
        });

      let userCard: ShiftDisplayData | undefined;
      if (activeShift && location.id === activeShift.location_id) {
        const prevLoc = activeShift.previous_location_id ? locations.find((l) => l.id === activeShift.previous_location_id) : null;
        userCard = {
          userId: user.id,
          name: userFullName,
          role: user.role.name,
          start: formatTime(activeShift.started_at),
          end: null,
          previousLocationName: prevLoc?.name,
          isChangeLocation: !!activeShift.previous_location_id,
        };
      }

      return { location, colleagues, userCard };
    })
    .filter((entry) => entry.colleagues.length > 0 || entry.userCard);

  return (
    <>
      {/* PULL-TO-REFRESH indicator (mobile) — fades/rotates with the pull. */}
      {(pull > 0 || refreshing) && (
        <div
          className="md:hidden fixed left-1/2 -translate-x-1/2 z-30 top-[calc(0.5rem+env(safe-area-inset-top,0px))] pointer-events-none"
          style={{ opacity: refreshing ? 1 : Math.min(pull / threshold, 1) }}
        >
          <div className="w-9 h-9 rounded-full bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-lg flex items-center justify-center">
            <ArrowClockwiseIcon
              weight="bold"
              className={`w-5 h-5 text-emerald-500 ${refreshing ? 'animate-spin' : ''}`}
              style={refreshing ? undefined : { transform: `rotate(${pull * 2.5}deg)` }}
            />
          </div>
        </div>
      )}

      <div className="mx-auto w-full max-w-5xl">
      {/* 1. GREETING + DATE (+ live clock on desktop) */}
      <DashboardHeader firstName={user.first_name || user.username} />

      {/* New owners: a three-step setup checklist until the org is up. */}
      <GettingStarted user={user} locationCount={activeLocations.length} />

      <AnnouncementBanner />

      {/* 2. SHIFT CARD — live (ActiveShift) or idle (CheckIn); they share one slot,
          so starting a shift reads as the same card waking up. */}
      <ActiveShift onPickLocation={handleLocationSelect} />
      <CheckIn onPickLocation={handleLocationSelect} />

      {/* NEXT ROSTERED SHIFT — quick glance + link to the schedule. */}
      <NextShiftCard />

      {/* 4. MOBILE LOCATION PICKER */}
      <div className="md:hidden mb-6">
        <MobileLocationField
          locations={activeLocations}
          selectedLocationId={selectedLocationId}
          isOnShift={!!activeShift}
          onLocationSelect={handleLocationSelect}
        />
      </div>

      {/* Mobile keeps a sticky start/end bar above the tab bar — clear it. */}
      <div className={`grid gap-3 pb-[calc(1rem+env(safe-area-inset-bottom))] md:pb-0 ${board.length > 1 ? 'xl:grid-cols-2' : ''}`}>
        {board.length === 0 ? (
          <div className="glass flex flex-col items-center rounded-2xl px-6 py-8 text-center">
            <div className="mb-2.5 flex size-11 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-300">
              <CoffeeIcon weight="duotone" className="size-6" />
            </div>
            <p className="text-body-strong text-ink dark:text-white">{t('home.noActivity')}</p>
            <p className="mt-1 max-w-xs text-caption text-ink-soft dark:text-slate-400">{t('home.noActivityHint')}</p>
          </div>
        ) : (
          board.map(({ location, colleagues, userCard }) => (
            <section key={location.id}>
              <ShiftCards
                locationName={location.name}
                shifts={colleagues}
                userShift={userCard}
                onSelectUser={setProfileUserId}
              />
            </section>
          ))
        )}
      </div>
      </div>

      {profileUserId && (
        <UserProfileModal userId={profileUserId} onClose={() => setProfileUserId(null)} />
      )}
    </>
  );
}
