/**
 * App Component - Main application for shift tracking system
 * Manages employee shift timing, location selection, and displays all shifts
 */

import { useState, useEffect } from 'react';
import './App.css';
import Dashboard from './components/Dashboard';
import ShiftCards from './components/ShiftCards';
import LocationPopup from './components/LocationPopup';
import { type Shift, type Location, type User } from './types/types';
import CheckIn from './components/CheckIn';
import LocationSelection from './components/LocationSelection';

/** Represents a single shift assignment with timing and role information */

/**
 * Represents a restaurant location with its scheduled shifts
 * Each location maintains its own list of employees and their assigned shifts
 */

const DEFAULT_USER = {
  username: 'Anuar Kairulla',  // Current logged-in user
  role: 'Supervisor',          // User's role in the system
};

/** Sample shift data for all locations - would come from an API in production */
const defaultShifts: Shift[] = [
  { id: 1, name: 'Ahmed Taha', role: 'Manager', start: '08:00', end: null },
  { id: 2, name: 'Elizabeth Dron', role: 'Supervisor', start: '09:00', end: '18:00' },
  { id: 3, name: 'Petr Hamhalter', role: 'Waiter', start: '10:30', end: '22:00' },
  { id: 4, name: 'Luca Lucio', role: 'Manager', start: null, end: null },
  { id: 5, name: 'Anna Arestova', role: 'Supervisor', start: '07:00', end: '15:00' },
  { id: 6, name: 'Alina Melnikova', role: 'Waitress', start: '14:00', end: '23:30' },
  { id: 7, name: 'Mehded Taha', role: 'Waiter', start: '08:00', end: null },
];

/**
 * All restaurant locations with their assigned shifts
 * Each location contains the same default shifts for demo purposes
 * In production, this would be fetched from an API
 */
const locations: Location[] = [
  {
    id: 'san-carlo-dittrichova',
    name: 'San Carlo - Dittrichova',
    shifts: defaultShifts,
  },
  {
    id: 'san-carlo-mala-strana',
    name: 'San Carlo - Malá Strana',
    shifts: defaultShifts,
  },
  {
    id: 'san-carlo-vinohrady',
    name: 'San Carlo - Vinohrady',
    shifts: defaultShifts,
  },
  {
    id: 'san-carlo-karlin',
    name: 'San Carlo - Karlín',
    shifts: defaultShifts,
  },
  {
    id: 'san-carlo-letna',
    name: 'San Carlo - Letna',
    shifts: defaultShifts,
  },
  {
    id: 'san-carlo-holesovice',
    name: 'San Carlo - Holešovice',
    shifts: defaultShifts,
  },
];


/**
 * Utility function to format a date string into HH:MM format
 * Used for displaying consistent time formatting throughout the app
 * @param dateString - Full date string (e.g., "February 19, 2026 11:01:30 GMT+01:00")
 * @returns Formatted time string in HH:MM format (24-hour, GB locale)
 */
const getFormattedTime = (dateString: string): string => {
  // Parse the date and format using GB locale (24-hour format)
  const time = new Date(dateString).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  });
  return time;
};

/**
 * Utility function to get the display name of a location by its ID
 * Returns a fallback text if the location is not found
 * @param locationId - The ID of the location to look up
 * @returns The name of the location, or 'Unknown Location' if not found
 */
const getLocationName = (locationId: string | null): string => {
  return locations.find((l) => l.id === locationId)?.name || 'Unknown Location';
};

export default function App() {
  const user: User = DEFAULT_USER;

  // Shift state
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const [endedAt, setEndedAt] = useState<string | null>(null);

  // Location selection state
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);
  const [isLocationPopupOpen, setIsLocationPopupOpen] = useState(false);
  const [pendingLocation, setPendingLocation] = useState<{
    id: string | null;
    name: string;
    shifts: Shift[];
  } | null>(null);
  const [activeShiftLocationId, setActiveShiftLocationId] = useState<string | null>(null);
  const [isShiftRunning, setIsShiftRunning] = useState(false);
  const [isShiftFinished, setIsShiftFinished] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [changeLocation, setChangeLocation] = useState(false);



  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formattedTime = currentTime.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });




  // ===== EVENT HANDLERS =====
  /**
   * Handles location selection from navigation buttons
   * Opens the confirmation popup when a location is clicked
   * @param locationId - ID of the selected location
   */
  const handleLocationSelect = (locationId: string | null) => {
    // Find the location in the array by ID
    const selected = locations.find((loc) => loc.id === locationId);
    const id = selected?.id || null;
    const name = selected?.name || 'Unknown Location';
    if (selected) {
      // If user clicks the currently selected location, deselect it and close popup
      if (locationId === selectedLocationId && !isShiftRunning) {
        setSelectedLocationId(null);
        return;
      } else if (locationId === selectedLocationId && isShiftRunning) {
        setIsLocationPopupOpen(true);
        return;
      }
      // Store the location for the popup to display
      setPendingLocation({ id: id, name: name, shifts: selected.shifts });
      // Show the confirmation popup
      setIsLocationPopupOpen(true);
    }
  };

  const handleChangeLocation = (change: boolean) => {
    setChangeLocation(change);
    console.log('Location change status:', change); // Debug log for location change status
  }

  /**
   * Initiates a new shift for the user at the selected location
   * Validates that a location has been selected first
   * Records the start time (currently hardcoded for demo)
   */
  const handleStartShift = () => {
    // Ensure user has selected a location before starting
    if (!selectedLocationId) {
      return;
    }

    // Format and record the start time
    const time = getFormattedTime('February 19, 2026 11:01:30 GMT+01:00');
    setStartedAt(time);
    // Clear any existing end time
    setEndedAt(null);
    setIsShiftRunning(true);
    setIsShiftFinished(false);

    setActiveShiftLocationId(selectedLocationId);
  };



  /**
   * Marks the end of the user's current shift
   * Records the end time (currently hardcoded for demo)
   */
  const handleEndShift = () => {
    // Format and record the end time
    const time = getFormattedTime('February 19, 2026 22:45:30 GMT+01:00');
    setActiveShiftLocationId(selectedLocationId);
    setEndedAt(time);
    setSelectedLocationId(null);
    setChangeLocation(false);
    setIsShiftRunning(false);
    setIsShiftFinished(true);
  };


  /**
   * Dynamic message describing the current shift status
   * Changes based on whether shift is running, finished, or not started
   */

  const shiftStatusMessage = startedAt
    ? isShiftFinished
      ? `Shift finished at ${getLocationName(activeShiftLocationId)}. Started at ${startedAt}, ended at ${endedAt}.`
      : `Shift running at ${getLocationName(selectedLocationId)}. Started at ${startedAt}.`
    : 'You have not started your shift yet.';

  return (
    <div className="App min-h-screen bg-gray-50 font-sans">
      <Dashboard user={user} />

      <main className="p-6 px-3 pb-32 max-w-7xl mx-auto">
        {/* Header Section */}
        <div className="mb-6 px-0 lg:px-3 space-y-4">
          <div className="flex gap-4 md:gap-0 justify-between items-center">
            <h1 className="text-2xl sm:text-3xl md:hidden font-bold text-gray-900">Planuj Směny</h1>
            <div className="flex md:px-4 md:w-auto ">
              <span className="text-xl sm:text-2xl font-mono font-bold text-gray-700">
                {formattedTime}
              </span>
            </div>
            {/* <p className="text-gray-500 mt-1">
              Quickly see who is working in each location and manage attendance.
            </p> */}
            {user && (
              <CheckIn
                user={user}
                shiftStatusMessage={shiftStatusMessage}
                selectedLocationId={selectedLocationId}
                isShiftRunning={isShiftRunning}
                handleStartShift={handleStartShift}
                handleEndShift={handleEndShift}
              />
            )}

          </div>

          {/* Shift Control Section */}

        </div>

        {/* Location Selection Navigation */}
        <LocationSelection locations={locations} selectedLocationId={selectedLocationId} onLocationSelect={handleLocationSelect} />

        {/* Shift Cards Grid */}
        {/* Display all locations with their shifts */}
        <div className="space-y-6">
          {/* Render a ShiftCards component for each location */}
          {locations.map((location) => (
            <section key={location.id} id={location.id ? location.id : undefined}>
              {/* 
                ShiftCards displays all shifts at this location
                Shows user's shift if they are assigned to this location
              */}
              <ShiftCards
                locationName={location.name}
                shifts={location.shifts}
                userShift={
                  // Only include user's shift data if selected location matches
                  user && location.id === selectedLocationId
                    ? {
                      name: user.username,
                      role: user.role,
                      start: startedAt,
                      end: endedAt,
                      isChangeLocation: changeLocation
                    }
                    : undefined
                }
              />
            </section>
          ))}
        </div>
      </main>

      {/* Location Confirmation Popup */}
      {/* Modal appears when user clicks a location button */}
      {isLocationPopupOpen && pendingLocation && (
        <LocationPopup
          isChangedLocation={
            { selectedLocationId, pendingLocationId: pendingLocation.id }
          }
          location={pendingLocation}
          setIsLocationPopupOpen={setIsLocationPopupOpen}
          setSelectedLocationId={setSelectedLocationId}
          handleChangeLocation={handleChangeLocation}
        />
      )}
    </div>
  );
}