import {
    Children,
    isValidElement,
    useCallback,
    useEffect,
    useLayoutEffect,
    useRef,
    useState,
    type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { CaretDownIcon, CheckIcon } from '@phosphor-icons/react';

/**
 * --- SELECT ---
 * A custom listbox dropdown that keeps the familiar native API — `value`, an
 * event-like `onChange`, and `<option>` children — so call sites don't change,
 * but renders a fully styled, theme-aware option list (hover, selected check,
 * keyboard nav) instead of the un-stylable native popup.
 *
 * The list is rendered in a portal with fixed positioning, so it's never
 * clipped by a scrolling modal/overflow container.
 */

interface Opt {
    value: string;
    label: ReactNode;
    disabled?: boolean;
}

// Read {value,label,disabled} out of the <option> children so existing markup
// (incl. dynamic lists) works unchanged.
function parseOptions(children: ReactNode): Opt[] {
    const out: Opt[] = [];
    Children.forEach(children, (child) => {
        if (!isValidElement(child) || child.type !== 'option') return;
        const props = child.props as { value?: string | number; children?: ReactNode; disabled?: boolean };
        out.push({
            value: String(props.value ?? ''),
            label: props.children ?? String(props.value ?? ''),
            disabled: props.disabled,
        });
    });
    return out;
}

export interface SelectProps {
    value: string;
    /** Event-like for drop-in parity with the native select. */
    onChange?: (event: { target: { value: string } }) => void;
    children: ReactNode;
    size?: 'sm' | 'md';
    fullWidth?: boolean;
    disabled?: boolean;
    placeholder?: string;
    className?: string;
    'aria-label'?: string;
}

const TRIGGER_BASE =
    'inline-flex items-center justify-between gap-2 rounded-xl border bg-gray-50 dark:bg-gray-800/50 ' +
    'border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white outline-none transition-all ' +
    'focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 disabled:opacity-60 disabled:cursor-not-allowed';

const SIZES = {
    sm: 'text-small px-2.5 py-1.5',
    md: 'text-body px-3.5 py-2.5',
};

export function Select({
    value,
    onChange,
    children,
    size = 'md',
    fullWidth = true,
    disabled,
    placeholder,
    className = '',
    'aria-label': ariaLabel,
}: SelectProps) {
    const options = parseOptions(children);
    const selected = options.find((o) => o.value === value);

    const [open, setOpen] = useState(false);
    const [active, setActive] = useState(0);
    const [coords, setCoords] = useState<{ top: number; left: number; width: number } | null>(null);

    const triggerRef = useRef<HTMLButtonElement>(null);
    const listRef = useRef<HTMLUListElement>(null);

    const place = useCallback(() => {
        const el = triggerRef.current;
        if (!el) return;
        const r = el.getBoundingClientRect();
        setCoords({ top: r.bottom + 4, left: r.left, width: r.width });
    }, []);

    const openList = () => {
        if (disabled) return;
        place();
        setActive(Math.max(0, options.findIndex((o) => o.value === value)));
        setOpen(true);
    };

    const choose = (opt: Opt) => {
        if (opt.disabled) return;
        onChange?.({ target: { value: opt.value } });
        setOpen(false);
        triggerRef.current?.focus();
    };

    // Keep the portal aligned to the trigger while open (scroll/resize).
    useLayoutEffect(() => {
        if (!open) return;
        place();
        const onScroll = () => place();
        window.addEventListener('scroll', onScroll, true);
        window.addEventListener('resize', onScroll);
        return () => {
            window.removeEventListener('scroll', onScroll, true);
            window.removeEventListener('resize', onScroll);
        };
    }, [open, place]);

    // Close on outside pointer / Escape.
    useEffect(() => {
        if (!open) return;
        const onDown = (e: MouseEvent) => {
            if (triggerRef.current?.contains(e.target as Node) || listRef.current?.contains(e.target as Node)) return;
            setOpen(false);
        };
        document.addEventListener('mousedown', onDown, true);
        return () => document.removeEventListener('mousedown', onDown, true);
    }, [open]);

    const step = (dir: 1 | -1) => {
        setActive((i) => {
            let n = i;
            for (let k = 0; k < options.length; k++) {
                n = (n + dir + options.length) % options.length;
                if (!options[n]?.disabled) break;
            }
            return n;
        });
    };

    const onKeyDown = (e: React.KeyboardEvent) => {
        if (!open) {
            if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                openList();
            }
            return;
        }
        if (e.key === 'Escape') {
            e.preventDefault();
            setOpen(false);
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            step(1);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            step(-1);
        } else if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            if (options[active]) choose(options[active]);
        } else if (e.key === 'Tab') {
            setOpen(false);
        }
    };

    return (
        <div className={fullWidth ? 'w-full' : 'inline-block'}>
            <button
                ref={triggerRef}
                type="button"
                disabled={disabled}
                aria-haspopup="listbox"
                aria-expanded={open}
                aria-label={ariaLabel}
                onClick={() => (open ? setOpen(false) : openList())}
                onKeyDown={onKeyDown}
                className={`${TRIGGER_BASE} ${SIZES[size]} ${fullWidth ? 'w-full' : ''} ${className}`}
            >
                <span className={`truncate ${selected ? '' : 'text-gray-400'}`}>
                    {selected ? selected.label : (placeholder ?? '')}
                </span>
                <CaretDownIcon
                    weight="bold"
                    className={`shrink-0 text-gray-400 transition-transform ${size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4'} ${open ? 'rotate-180' : ''}`}
                />
            </button>

            {open &&
                coords &&
                createPortal(
                    <ul
                        ref={listRef}
                        role="listbox"
                        style={{ position: 'fixed', top: coords.top, left: coords.left, minWidth: coords.width }}
                        className="z-300 max-h-64 overflow-auto rounded-xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-2xl py-1"
                    >
                        {options.map((opt, i) => {
                            const isSel = opt.value === value;
                            return (
                                <li
                                    key={`${opt.value}-${i}`}
                                    role="option"
                                    aria-selected={isSel}
                                    onMouseEnter={() => setActive(i)}
                                    onClick={() => choose(opt)}
                                    className={`flex items-center gap-2 px-3 py-2 text-body cursor-pointer ${
                                        opt.disabled ? 'opacity-40 cursor-not-allowed' : ''
                                    } ${i === active ? 'bg-emerald-50 dark:bg-emerald-500/10' : ''} ${
                                        isSel ? 'text-emerald-700 dark:text-emerald-400 font-semibold' : 'text-gray-700 dark:text-gray-200'
                                    }`}
                                >
                                    <span className="flex-1 truncate">{opt.label}</span>
                                    {isSel && <CheckIcon weight="bold" className="w-4 h-4 shrink-0" />}
                                </li>
                            );
                        })}
                    </ul>,
                    document.body,
                )}
        </div>
    );
}
