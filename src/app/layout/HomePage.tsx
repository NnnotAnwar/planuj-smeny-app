import { useOutletContext } from 'react-router-dom';
import { type AppOutletContext } from './AppShell';

import { ActiveShift } from '@features/shifts/components/ActiveShift';
import { CheckIn } from '@features/shifts/components/CheckIn';
import { ShiftCards } from '@features/shifts/components/ShiftCards';
import { LocationSelection } from '@features/locations/components/LocationSelection';
import { Clock } from '@shared/components/Clock';
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

  if (!user) return null;

  return (
    <>
      {/* 1. CLOCK (Desktop Only) */}
      <div className="hidden md:flex items-center justify-center mb-8 pt-2">
        <div className="text-2xl font-black dark:text-white tracking-tight">
          <Clock seconds={true} />
        </div>
      </div>

      {/* 2. ACTIVE STATUS (If user is working) */}
      <ActiveShift />

      {/* 3. START BUTTON (If user is not working) */}
      <CheckIn />

      {/* 4. MOBILE LOCATION PICKER */}
      <div className="md:hidden mb-6 -mx-3 px-3">
        <LocationSelection
          locations={locations}
          selectedLocationId={selectedLocationId}
          onLocationSelect={handleLocationSelect}
        />
      </div>

      <div className="space-y-4">
        {locations.map((location) => {
          const userFullName = `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.username;
          const role = user.role.name
          // Find colleagues working in this specific location.
          const colleagues: ShiftDisplayData[] = allActiveShifts
            .filter((s) => s.location_id === location.id && s.user_id !== user.id)
            .map((s) => {
              const prevLoc = s.previous_location_id ? locations.find(l => l.id === s.previous_location_id) : null;
              return {
                id: s.id,
                start: formatTime(s.started_at),
                name: `${s.profiles?.first_name || 'Employee'} ${s.profiles?.last_name || ''}`.trim(),
                role: s.role,
                end: null,
                previousLocationName: prevLoc?.name,
                isChangeLocation: !!s.previous_location_id
              };
            });

          // Prepare own shift data for display if we're working here.
          let userCard: ShiftDisplayData | undefined;
          if (activeShift && location.id === activeShift.location_id) {
            const prevLoc = activeShift.previous_location_id ? locations.find(l => l.id === activeShift.previous_location_id) : null;
            userCard = {
              name: userFullName,
              role: role,
              start: formatTime(activeShift.started_at),
              end: null,
              previousLocationName: prevLoc?.name,
              isChangeLocation: !!activeShift.previous_location_id
            };
          }

          return (
            <section key={location.id}>
              <ShiftCards
                locationName={location.name}
                shifts={colleagues}
                userShift={userCard}
              />
            </section>
          );
        })}
      </div>
    </>
  );
}
