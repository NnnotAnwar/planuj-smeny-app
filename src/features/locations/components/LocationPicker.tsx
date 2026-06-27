import { useMemo, useState } from 'react';
import { MapPinIcon } from '@phosphor-icons/react';
import { SearchInput } from '@shared/components/SearchInput';
import { useTranslation } from '@shared/preferences/PreferencesContext';

/**
 * --- LOCATION PICKER ---
 * Reusable, searchable location chooser shared by the desktop sidebar popover
 * and the mobile bottom sheet. With no query it surfaces the user's recent
 * posts first, then all locations; typing filters across everything. The host
 * (popover / sheet) owns the chrome; this owns the search + list.
 */

interface LocationLike {
    id: string;
    name: string;
    archived_at?: string | null;
}

interface LocationPickerProps {
    locations: LocationLike[];
    selectedLocationId: string | null;
    recentIds: string[];
    isOnShift: boolean;
    onSelect: (locationId: string) => void;
}

export function LocationPicker({
    locations,
    selectedLocationId,
    recentIds,
    isOnShift,
    onSelect,
}: LocationPickerProps) {
    const t = useTranslation();
    const [query, setQuery] = useState('');

    // Archived locations stay hidden unless they're the one you're on.
    const available = useMemo(
        () => locations.filter((l) => !l.archived_at || l.id === selectedLocationId),
        [locations, selectedLocationId],
    );

    const q = query.trim().toLowerCase();
    const results = useMemo(() => available.filter((l) => l.name.toLowerCase().includes(q)), [available, q]);

    const recent = useMemo(() => {
        if (q) return [];
        const byId = new Map(available.map((l) => [l.id, l]));
        return recentIds.map((id) => byId.get(id)).filter((l): l is LocationLike => !!l);
    }, [available, recentIds, q]);

    const recentSet = useMemo(() => new Set(recent.map((l) => l.id)), [recent]);

    const renderRow = (location: LocationLike) => {
        const isSelected = location.id === selectedLocationId;
        return (
            <button
                key={location.id}
                onClick={() => onSelect(location.id)}
                className={`w-full text-left px-3 py-2 rounded-xl flex items-center gap-2.5 text-sm transition-all border ${
                    isSelected
                        ? 'bg-emerald-500 dark:bg-emerald-400 text-white dark:text-[#0B1120] border-emerald-500 dark:border-emerald-400 font-medium'
                        : 'border-transparent hover:bg-gray-100 dark:hover:bg-white/5 active:bg-gray-200 dark:active:bg-white/10 text-gray-700 dark:text-slate-200'
                }`}
            >
                <MapPinIcon
                    weight={isSelected ? 'fill' : 'regular'}
                    className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-white dark:text-[#0B1120]' : 'text-emerald-600 dark:text-emerald-400'}`}
                />
                <span className="truncate flex-1">{location.name}</span>
                {isSelected && isOnShift && (
                    <span className="text-[10px] font-mono text-white/70 dark:text-[#0B1120]/70">{t('sidebar.live')}</span>
                )}
            </button>
        );
    };

    return (
        <div className="flex flex-col min-h-0 h-full">
            <SearchInput
                value={query}
                onChange={setQuery}
                placeholder={t('sidebar.searchPosts')}
                className="mb-2"
                inputClassName="py-2 pl-8 pr-3"
            />

            <div className="flex-1 min-h-0 overflow-y-auto pr-0.5 space-y-3 emerald-scrollbar">
                {q ? (
                    results.length > 0 ? (
                        <div className="space-y-0.5">{results.map(renderRow)}</div>
                    ) : (
                        <div className="text-xs text-gray-500 dark:text-slate-500 px-3 py-3">{t('sidebar.noMatching')}</div>
                    )
                ) : (
                    <>
                        {recent.length > 0 && (
                            <div>
                                <div className="uppercase text-[10px] font-semibold tracking-[1px] text-gray-400 dark:text-slate-500 mb-1 px-3">
                                    {t('location.recent')}
                                </div>
                                <div className="space-y-0.5">{recent.map(renderRow)}</div>
                            </div>
                        )}
                        <div>
                            {recent.length > 0 && (
                                <div className="uppercase text-[10px] font-semibold tracking-[1px] text-gray-400 dark:text-slate-500 mb-1 px-3">
                                    {t('location.allPosts')}
                                </div>
                            )}
                            <div className="space-y-0.5">
                                {available.filter((l) => !recentSet.has(l.id)).map(renderRow)}
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
