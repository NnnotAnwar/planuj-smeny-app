import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { useLocation, useNavigate } from 'react-router-dom';
import { MagnifyingGlassIcon, MapPinIcon, type Icon } from '@phosphor-icons/react';

import { useNavItems } from './navigation';
import { useTranslation } from '@shared/preferences/PreferencesContext';
import { useRecentLocations } from '@features/locations/useRecentLocations';

/**
 * --- COMMAND PALETTE (⌘K / Ctrl+K) ---
 * A single search surface to jump anywhere: pages (the shared nav config) and
 * locations (select / switch your post). Keyboard-driven — ↑ ↓ to move, Enter to
 * run, Esc to close — and scales no matter how many destinations exist.
 */

interface LocationLike {
    id: string;
    name: string;
    archived_at?: string | null;
}

interface CmdItem {
    key: string;
    label: string;
    icon: Icon;
    run: () => void;
}

interface CommandPaletteProps {
    open: boolean;
    onClose: () => void;
    locations: LocationLike[];
    selectedLocationId: string | null;
    onSelectLocation: (id: string) => void;
}

export function CommandPalette({ open, onClose, locations, selectedLocationId, onSelectLocation }: CommandPaletteProps) {
    const t = useTranslation();
    const navigate = useNavigate();
    const { pathname } = useLocation();
    const navItems = useNavItems();

    // Picking a location is only allowed on the dashboard.
    const locationsEnabled = pathname === '/';
    const { recentIds, recordPick } = useRecentLocations();

    const [query, setQuery] = useState('');
    const [active, setActive] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLDivElement>(null);

    const q = query.trim().toLowerCase();

    const pages: CmdItem[] = useMemo(
        () =>
            navItems
                .filter((i) => i.label.toLowerCase().includes(q))
                .map((i) => ({
                    key: `p:${i.id}`,
                    label: i.label,
                    icon: i.icon,
                    run: () => {
                        navigate(i.route);
                        onClose();
                    },
                })),
        [navItems, q, navigate, onClose],
    );

    const locationItems: CmdItem[] = useMemo(() => {
        if (!locationsEnabled) return [];
        const available = locations.filter((l) => !l.archived_at || l.id === selectedLocationId);
        const byId = new Map(available.map((l) => [l.id, l]));
        // Recent-first when not searching; plain filtered list while typing.
        const recent = q ? [] : recentIds.map((id) => byId.get(id)).filter((l): l is LocationLike => !!l);
        const recentSet = new Set(recent.map((l) => l.id));
        const rest = available.filter((l) => l.name.toLowerCase().includes(q) && !recentSet.has(l.id));
        return [...recent, ...rest].map((l) => ({
            key: `l:${l.id}`,
            label: l.name,
            icon: MapPinIcon,
            run: () => {
                recordPick(l.id);
                onSelectLocation(l.id);
                onClose();
            },
        }));
    }, [locationsEnabled, locations, selectedLocationId, recentIds, q, recordPick, onSelectLocation, onClose]);

    const groups = useMemo(
        () =>
            [
                { label: t('cmd.pages'), items: pages },
                { label: t('cmd.locations'), items: locationItems },
            ].filter((g) => g.items.length > 0),
        [pages, locationItems, t],
    );

    const flat = useMemo(() => groups.flatMap((g) => g.items), [groups]);

    // Reset query/selection when the palette opens — done during render via the
    // "adjust state on prop change" pattern, to avoid setState-in-effect.
    const [prevOpen, setPrevOpen] = useState(open);
    if (open !== prevOpen) {
        setPrevOpen(open);
        if (open) {
            setQuery('');
            setActive(0);
        }
    }

    // Focus the input on open (DOM-only side effect).
    useEffect(() => {
        if (!open) return;
        const id = window.setTimeout(() => inputRef.current?.focus(), 20);
        return () => window.clearTimeout(id);
    }, [open]);

    // Keyboard navigation while open.
    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                onClose();
            } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                setActive((a) => Math.min(a + 1, flat.length - 1));
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setActive((a) => Math.max(a - 1, 0));
            } else if (e.key === 'Enter') {
                e.preventDefault();
                flat[active]?.run();
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [open, flat, active, onClose]);

    // Keep the active row in view.
    useEffect(() => {
        if (!open) return;
        listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' });
    }, [active, open]);

    if (!open) return null;

    let runningIndex = -1;

    return createPortal(
        <div className="fixed inset-0 z-120 flex items-start justify-center p-4 pt-[16vh]">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
            <motion.div
                initial={{ opacity: 0, y: -8, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.14, ease: 'easeOut' }}
                role="dialog"
                aria-modal="true"
                className="relative w-full max-w-lg max-h-[68vh] flex flex-col rounded-2xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-gray-900 shadow-2xl overflow-hidden"
            >
                {/* Search */}
                <div className="flex items-center gap-2.5 px-4 border-b border-gray-100 dark:border-white/10">
                    <MagnifyingGlassIcon weight="bold" className="w-4 h-4 text-gray-400 shrink-0" />
                    <input
                        ref={inputRef}
                        value={query}
                        onChange={(e) => {
                            setQuery(e.target.value);
                            setActive(0);
                        }}
                        placeholder={t('cmd.placeholder')}
                        className="flex-1 bg-transparent py-3.5 text-body text-gray-900 dark:text-white outline-none placeholder:text-gray-400"
                    />
                </div>

                {/* Results */}
                <div ref={listRef} className="flex-1 min-h-0 overflow-y-auto emerald-scrollbar p-2">
                    {flat.length === 0 ? (
                        <div className="py-10 text-center text-small text-gray-400">{t('cmd.empty')}</div>
                    ) : (
                        groups.map((group) => (
                            <div key={group.label} className="mb-1.5 last:mb-0">
                                <div className="uppercase text-micro text-gray-400 dark:text-slate-500 px-2.5 py-1">
                                    {group.label}
                                </div>
                                {group.items.map((item) => {
                                    runningIndex += 1;
                                    const idx = runningIndex;
                                    const isActive = idx === active;
                                    return (
                                        <button
                                            key={item.key}
                                            data-active={isActive}
                                            onMouseMove={() => setActive(idx)}
                                            onClick={item.run}
                                            className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-sm text-left transition-colors ${
                                                isActive
                                                    ? 'bg-emerald-500 text-white'
                                                    : 'text-gray-700 dark:text-slate-200 hover:bg-gray-100 dark:hover:bg-white/5'
                                            }`}
                                        >
                                            <item.icon
                                                weight={isActive ? 'fill' : 'regular'}
                                                className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-emerald-600 dark:text-emerald-400'}`}
                                            />
                                            <span className="flex-1 truncate">{item.label}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        ))
                    )}
                </div>

                {/* Hint */}
                <div className="flex items-center gap-3 px-4 py-2 border-t border-gray-100 dark:border-white/10 text-micro text-gray-400 normal-case tracking-normal">
                    <span><kbd className="font-sans">↑↓</kbd> move</span>
                    <span><kbd className="font-sans">↵</kbd> open</span>
                    <span><kbd className="font-sans">esc</kbd> close</span>
                </div>
            </motion.div>
        </div>,
        document.body,
    );
}
