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
  return (
    <nav className="grid lg:flex lg:justify-around lg:overflow-x-auto gap-3 mb-6 snap-x scrollbar-hide w-full">
      {locations.map((location) => (
        <button
          key={location.id}
          type="button"
          onClick={() => onLocationSelect(location.id)}
          className={`whitespace-nowrap snap-start px-4 py-2 rounded-full text-sm font-medium border transition-all shadow-sm
            ${location.id === selectedLocationId ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-100'}`}
        >
          {location.name}
        </button>
      ))}
    </nav>
  );
}
