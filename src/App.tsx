/**
 * App Component - Main application for shift tracking system
 * Manages employee shift timing, location selection, and displays all shifts
 */

import { useState } from 'react';
import './App.css';
import Dashboard from './components/Dashboard';
import ShiftCards from './components/ShiftCards';
import LocationPopup from './components/LocationPopup';
import { type Shift, type Location, type User } from './types/types';
import CheckIn from './components/CheckIn';

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
    id: string;
    name: string;
  } | null>(null);
  const [activeShiftLocationId, setActiveShiftLocationId] = useState<string | null>(null);

  // ===== EVENT HANDLERS =====
  /**
   * Handles location selection from navigation buttons
   * Opens the confirmation popup when a location is clicked
   * @param locationId - ID of the selected location
   */
  const handleLocationSelect = (locationId: string) => {
    // Find the location in the array by ID
    const selected = locations.find((loc) => loc.id === locationId);
    if (selected) {
      // Store the location for the popup to display
      setPendingLocation({ id: selected.id, name: selected.name });
      // Show the confirmation popup
      setIsLocationPopupOpen(true);
    }
  };

  /**
   * Initiates a new shift for the user at the selected location
   * Validates that a location has been selected first
   * Records the start time (currently hardcoded for demo)
   */
  const handleStartShift = () => {
    // Ensure user has selected a location before starting
    if (!selectedLocationId) {
      alert('Please pick a location before starting your shift.');
      return;
    }

    // Format and record the start time
    const time = getFormattedTime('February 19, 2026 11:01:30 GMT+01:00');
    setStartedAt(time);
    // Clear any existing end time
    setEndedAt(null);

    setActiveShiftLocationId(selectedLocationId);
  };



  /**
   * Marks the end of the user's current shift
   * Records the end time (currently hardcoded for demo)
   */
  const handleEndShift = () => {
    // Format and record the end time
    const time = getFormattedTime('February 19, 2026 22:45:30 GMT+01:00');
    setEndedAt(time);
  };

  // ===== COMPUTED STATE VALUES =====
  /** Get the name of the currently selected location */
  const shiftLocationName = getLocationName(activeShiftLocationId)
  /** Boolean: true if shift has started and not ended */
  const isShiftRunning = startedAt && !endedAt;
  /** Boolean: true if both start and end times are recorded */
  const isShiftFinished = startedAt && endedAt;


  /**
   * Dynamic message describing the current shift status
   * Changes based on whether shift is running, finished, or not started
   */

  const shiftStatusMessage = startedAt
    ? isShiftFinished
      ? `Shift finished at ${shiftLocationName}. Started at ${startedAt}, ended at ${endedAt}.`
      : `Shift running at ${shiftLocationName}. Started at ${startedAt}.`
    : 'You have not started your shift yet.';

  return (
    <div className="App min-h-screen bg-gray-50 font-sans">
      <Dashboard user={user} />

      <main className="p-6 pb-32 md:pb-6 max-w-7xl mx-auto">
        {/* Header Section */}
        <div className="mb-6 space-y-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 text-center md:text-left">Planuj Směny</h1>
            {/* <p className="text-gray-500 mt-1">
              Quickly see who is working in each location and manage attendance.
            </p> */}
          </div>

          {/* Shift Control Section */}
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

        {/* Location Selection Navigation */}
        <nav className="grid xl:flex xl:justify-around xl:overflow-x-auto gap-3 mb-8 pb-2 snap-x scrollbar-hide w-full">
          {/* Map through each location and create a button for selection */}
          {locations.map((location) => (
            <>
              <button
                key={location.id}
                type="button"
                onClick={() => handleLocationSelect(location.id)}
                className={`whitespace-nowrap snap-start px-4 py-2 rounded-full text-sm font-medium border transition-all shadow-sm 
                ${selectedLocationId === location.id
                    ? 'bg-emerald-500 text-white border-emerald-500'
                    : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-100'
                  }`}
              >
                {location.name}
              </button>
            </>
          ))}
        </nav>

        {/* Shift Cards Grid */}
        {/* Display all locations with their shifts */}
        <div className="space-y-6">
          {/* Render a ShiftCards component for each location */}
          {locations.map((location) => (
            <section key={location.id} id={location.id}>
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
            // True if switching from one location to another
            selectedLocationId !== null && selectedLocationId !== pendingLocation.id
          }
          location={pendingLocation}
          setIsLocationPopupOpen={setIsLocationPopupOpen}
          setSelectedLocationId={setSelectedLocationId}
        />
      )}
    </div>
  );
}