import { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { PlusIcon } from '@phosphor-icons/react';
import type { Profile } from '@shared/types';
import { SearchInput } from '@shared/components/SearchInput';

/**
 * --- MEMBER SEARCH-ADD ---
 * Type-to-find picker for adding staff to a location's roster — scales to
 * large teams where a plain dropdown becomes unusable. The match list renders
 * in a fixed portal so the section card's overflow-hidden (rounded corners)
 * can't clip it.
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
    const wrapRef = useRef<HTMLDivElement>(null);
    const [pos, setPos] = useState<{ left: number; top: number; width: number } | null>(null);

    const name = (m: Profile) => [m.first_name, m.last_name].filter(Boolean).join(' ') || m.username;
    const needle = q.trim().toLowerCase();
    const matches = candidates
        .filter((m) => !needle || name(m).toLowerCase().includes(needle) || m.username.toLowerCase().includes(needle))
        .slice(0, 8);
    // With a small team the list can show on focus alone; big teams type first.
    const open = focused && matches.length > 0 && (needle.length > 0 || candidates.length <= 8);

    // Anchor the portal list to the input. Re-measure whenever the candidate
    // set changes too — picking someone grows the grid above and moves the
    // input down, and the list must follow it. Scroll/resize just closes.
    useLayoutEffect(() => {
        if (!open) return;
        const place = () => {
            const r = wrapRef.current?.getBoundingClientRect();
            if (r) setPos({ left: r.left, top: r.bottom + 4, width: r.width });
        };
        place();
        // The layout may settle a frame later (query refetch re-render).
        const raf = requestAnimationFrame(place);
        const close = () => setFocused(false);
        window.addEventListener('scroll', close, true);
        window.addEventListener('resize', close);
        return () => {
            cancelAnimationFrame(raf);
            window.removeEventListener('scroll', close, true);
            window.removeEventListener('resize', close);
        };
    }, [open, candidates]);

    return (
        // React's onFocus/onBlur bubble (focusin/focusout), so the wrapper
        // tracks focus for the input; the portal buttons keep focus via
        // onMouseDown+preventDefault, so blur never fires before the pick.
        <div
            ref={wrapRef}
            className="relative max-w-64 flex-1 min-w-0"
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
        >
            <SearchInput value={q} onChange={setQ} placeholder={placeholder} inputClassName="!py-1.5 text-small" />
            {open &&
                pos &&
                createPortal(
                    <ul
                        style={{ position: 'fixed', left: pos.left, top: pos.top, width: pos.width }}
                        className="z-100 max-h-56 overflow-y-auto rounded-xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-xl py-1"
                    >
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
                    </ul>,
                    document.body,
                )}
        </div>
    );
}
