import { useState } from 'react';
import { type Location } from '../types/types';

/** Props for the location picker nav. */
interface LocationSelectionProps {
  locations: Location[];
  selectedLocationId: string | null;
  onLocationSelect: (locationId: string | null) => void;
}

/**
 * Horizontal list of location buttons. Selected one is highlighted;
 * clicking triggers parent handler (which may open confirmation popup).
 */
export default function LocationSelection({
  locations,
  selectedLocationId,
  onLocationSelect,
}: LocationSelectionProps) {
  const [locationsToggle, setLocationToggle] = useState(true)

  const toggleList = () => {
    if (locationsToggle) setLocationToggle(false)
    else setLocationToggle(true)
  }

  // locations.push({ id: "dsd", name: "San Carlo - Test", organization_id: locations[0].organization_id, shifts: [] })

  return (
    <div className="flex flex-col items-center text-white">
      <button
        className='rounded-xl px-4 py-1.5 mb-2 hidden'
        onClick={toggleList}
      >
        <svg viewBox="0 0 18 15" className="h-4 w-4">
          <path fill="#424242" d="M18,1.484c0,0.82-0.665,1.484-1.484,1.484H1.484C0.665,2.969,0,2.304,0,1.484l0,0C0,0.665,0.665,0,1.484,0 h15.031C17.335,0,18,0.665,18,1.484L18,1.484z" />
          <path fill="#424242" d="M18,7.516C18,8.335,17.335,9,16.516,9H1.484C0.665,9,0,8.335,0,7.516l0,0c0-0.82,0.665-1.484,1.484-1.484 h15.031C17.335,6.031,18,6.696,18,7.516L18,7.516z" />
          <path fill="#424242" d="M18,13.516C18,14.335,17.335,15,16.516,15H1.484C0.665,15,0,14.335,0,13.516l0,0 c0-0.82,0.665-1.484,1.484-1.484h15.031C17.335,12.031,18,12.696,18,13.516L18,13.516z" />
        </svg>
      </button>
      <nav className={`${locationsToggle ? "grid" : "hidden h-0"} grid-cols-2 md:grid-cols-1 gap-2 mb-3 scrollbar-hide w-full transition-all duration-300`}>
        {locations.map((location) => (
          <button
            key={location.id}
            type="button"
            onClick={() => onLocationSelect(location.id)}
            className={`whitespace-nowrap snap-start px-4 py-2 md:gap-2 md:px-1 md:py-0 rounded-full font-medium border transition-all shadow-sm md:shadow-none text-[10px] min-[350px]:text-xs sm:text-sm md:text-left
            ${location.id === selectedLocationId
                ? 'bg-emerald-500 md:bg-white/0 text-white md:text-emerald-700 border-emerald-500 md:border-0 md:font-semibold md:text-lg'
                : 'bg-white md:bg-inherit text-gray-700 border-gray-200 md:border-0 hover:bg-gray-100'}`}
          >
            {location.name}
          </button>
        ))}
      </nav>
    </div>
  );
}
