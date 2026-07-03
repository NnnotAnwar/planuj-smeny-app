import { useState } from 'react';
import { PlusIcon } from '@phosphor-icons/react';
import type { Profile } from '@shared/types';
import { SearchInput } from '@shared/components/SearchInput';

/**
 * --- MEMBER SEARCH-ADD ---
 * Type-to-find picker for adding staff to a location's roster — scales to
 * large teams where a plain dropdown becomes unusable. Shows the top matches
 * under the input; clicking one adds it and clears the query.
 */
export function MemberSearchAdd({
    candidates,
    placeholder,
    onAdd,
}: {
    candidates: Profile[];
    placeholder: string;
    onAdd: (id: string) => void;
}) {
    const [q, setQ] = useState('');
    const [focused, setFocused] = useState(false);

    const name = (m: Profile) => [m.first_name, m.last_name].filter(Boolean).join(' ') || m.username;
    const needle = q.trim().toLowerCase();
    const matches = candidates
        .filter((m) => !needle || name(m).toLowerCase().includes(needle) || m.username.toLowerCase().includes(needle))
        .slice(0, 8);
    // With a small team the list can show on focus alone; big teams type first.
    const open = focused && matches.length > 0 && (needle.length > 0 || candidates.length <= 8);

    return (
        // React's onFocus/onBlur bubble (focusin/focusout), so the wrapper
        // tracks focus for both the input and the option buttons.
        <div
            className="relative max-w-64 flex-1 min-w-0"
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
        >
            <SearchInput value={q} onChange={setQ} placeholder={placeholder} inputClassName="!py-1.5 text-small" />
            {open && (
                <ul className="absolute left-0 right-0 top-full mt-1 z-40 max-h-56 overflow-y-auto rounded-xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-xl py-1">
                    {matches.map((m) => (
                        <li key={m.id}>
                            {/* onMouseDown fires before the input's blur, so the tap lands. */}
                            <button
                                type="button"
                                onMouseDown={(e) => {
                                    e.preventDefault();
                                    onAdd(m.id);
                                    setQ('');
                                }}
                                className="w-full flex items-center gap-2 px-3 py-2 text-left text-small text-gray-700 dark:text-gray-200 hover:bg-emerald-50 dark:hover:bg-white/5 transition-colors"
                            >
                                <PlusIcon weight="bold" className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                                <span className="truncate">{name(m)}</span>
                                <span className="ml-auto text-micro text-gray-400 normal-case tracking-normal shrink-0">@{m.username}</span>
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
