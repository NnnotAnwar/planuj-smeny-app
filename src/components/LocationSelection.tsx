import { type Location } from '../types/types';
type LocationSelectionProps = {
    locations: Location[]; // Array of restaurant locations to display
    selectedLocationId: string | null; // Currently selected location ID for styling
    previousLocationId?: string | null; // Previously selected location ID for comparison (optional)
    onLocationSelect: (locationId: string) => void; // Callback when a location is selected
}

export default function LocationSelection({ locations, selectedLocationId, onLocationSelect }: LocationSelectionProps) {

    console.log(locations);
    return (
        <nav className="grid xl:flex xl:justify-around xl:overflow-x-auto gap-3 mb-8 pb-2 snap-x scrollbar-hide w-full">
            {/* Map through each location and create a button for selection */}
            {locations.map((location) => (
                <button
                    key={location.id}
                    type="button"
                    onClick={() => onLocationSelect(location.id)}
                    className={`whitespace-nowrap snap-start px-4 py-2 rounded-full text-sm font-medium border transition-all shadow-sm
                            ${location.id === selectedLocationId
                            ? 'bg-emerald-500 text-white border-emerald-500'
                            : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-100'
                        }`}
                >
                    {location.name}
                </button>
            ))}
        </nav>
    )
}