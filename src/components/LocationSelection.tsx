import { useState } from 'react';
import { type Location } from '../types/types';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPinIcon } from '@phosphor-icons/react';


interface LocationSelectionProps {
  locations: Location[];
  selectedLocationId: string | null;
  onLocationSelect: (locationId: string | null) => void;
}

export default function LocationSelection({
  locations,
  selectedLocationId,
  onLocationSelect,
}: LocationSelectionProps) {
  const [showAll, setShowAll] = useState(false);

  const limit = 6;
  const shouldTruncate = locations.length > limit && !showAll;

  const displayedLocations = shouldTruncate
    ? locations.slice(0, limit - 1)
    : locations;

  const activeLocation = locations.find(l => l.id === selectedLocationId);
  const isActiveVisible = displayedLocations.some(l => l.id === selectedLocationId);

  return (
    <div className="w-full">
      <motion.div
        layout
        className="grid grid-cols-2 md:grid-cols-1 gap-1.5 md:gap-1"
      >
        <AnimatePresence mode="popLayout">
          {displayedLocations.map((location) => {
            const isActive = location.id === selectedLocationId;
            return (
              <motion.div
                key={location.id}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.2 }}
              >
                <LocationButton
                  location={location}
                  isActive={isActive}
                  onClick={() => onLocationSelect(location.id)}
                />
              </motion.div>
            );
          })}

          {shouldTruncate && activeLocation && !isActiveVisible && (
            <motion.div
              key={activeLocation.id}
              layout
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
            >
              <LocationButton
                location={activeLocation}
                isActive={true}
                onClick={() => onLocationSelect(activeLocation.id)}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Кнопка управления списком */}
        {locations.length > limit && (
          <motion.button
            layout
            onClick={() => setShowAll(!showAll)}
            className="flex items-center justify-center p-2 rounded-lg border border-dashed border-gray-300 dark:border-white/10 text-[10px] font-bold text-gray-500 uppercase cursor-pointer hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
          >
            {showAll ? 'Show Less' : `Show All (+${locations.length - displayedLocations.length})`}
          </motion.button>
        )}
      </motion.div>
    </div>
  );
}

function LocationButton({ location, isActive, onClick }: { location: Location, isActive: boolean, onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`group flex items-center gap-4 md:m-px p-2 w-full rounded-lg transition-all duration-200 cursor-pointer border ${isActive
        ? 'bg-emerald-500 text-white border-emerald-400 shadow-sm shadow-emerald-500/20'
        : 'bg-white dark:bg-white/5 border-gray-100 dark:border-white/5 text-gray-700 dark:text-gray-300'
        }`}
    >
      <div className={`shrink-0 w-5 h-5 rounded-md flex items-center justify-center ${isActive ? 'bg-white/20' : 'bg-gray-100 dark:bg-gray-800 text-gray-400'
        }`}>
        <MapPinIcon className='h-3 w-3' />
      </div>
      <span className="text-[11px] md:text-xs font-bold truncate leading-none text-left flex-1">
        {location.name}
      </span>
    </button>
  );
}
