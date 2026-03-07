import ShiftCards from '../components/ShiftCards';
import LocationSelection from '../components/LocationSelection';
import CheckIn from '../components/CheckIn';
import { type ShiftDisplayData } from '../types/types';
import ActiveShift from '../components/ActiveShift';
import Clock from '../components/Clock';
import { useOutletContext } from 'react-router-dom';
import { type AppOutletContext } from '../App';

export default function AppLayout() {
  const {
    user,
    activeShift,
    allActiveShifts,
    locations,
    selectedLocationId,
    handleLocationSelect,
  } = useOutletContext<AppOutletContext>();

  if (!user) return null;

  return (
    <>
      {/* Desktop Header Bar (Hidden on Mobile) */}
      <div className="hidden md:flex items-center justify-center relative mb-8 pt-2">
        <div className="text-2xl font-black dark:text-white tracking-tight">
          <Clock seconds={true} />
        </div>
      </div>

      <ActiveShift />

      <CheckIn />

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

          const colleaguesInLocation: ShiftDisplayData[] = allActiveShifts
            .filter((s) => s.location_id === location.id && s.user_id !== user.id)
            .map((s) => ({
              id: s.id,
              start: s.started_at ? new Date(s.started_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '--:--',
              name: `${s.profiles?.first_name || 'Employee'} ${s.profiles?.last_name || ''}`.trim(),
              role: s.role,
              end: null
            }));

          const currentUserShiftData: ShiftDisplayData | undefined = (activeShift && location.id === selectedLocationId)
            ? {
              name: userFullName,
              role: user.role,
              start: new Date(activeShift.started_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
              end: null,
              isChangeLocation: false,
            }
            : undefined;

          return (
            <section key={location.id}>
              <ShiftCards
                locationName={location.name}
                shifts={colleaguesInLocation}
                userShift={currentUserShiftData}
              />
            </section>
          );
        })}
      </div>
    </>
  );
}
