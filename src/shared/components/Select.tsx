import { forwardRef, type SelectHTMLAttributes, type ReactNode } from 'react';
import { CaretDownIcon } from '@phosphor-icons/react';

/**
 * --- SELECT ---
 * The single dropdown primitive, matching the shared <Input> look. Native
 * `<select>` (so it uses the platform picker on mobile) with `appearance-none`
 * plus our own caret for a consistent chevron across browsers. Two densities:
 * `md` for form fields, `sm` for inline filters (e.g. the Activity Log).
 */

// `size` on a native select means listbox rows — we repurpose the name for
// visual density, so omit the DOM one.
export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
    size?: 'sm' | 'md';
    /** Stretch to the container width (default) or size to content for filters. */
    fullWidth?: boolean;
    children?: ReactNode;
}

const BASE =
    'appearance-none rounded-xl border bg-gray-50 dark:bg-gray-800/50 text-gray-900 dark:text-white ' +
    'border-gray-200 dark:border-gray-700 outline-none transition-all focus:border-emerald-500 ' +
    'focus:ring-2 focus:ring-emerald-500/20 disabled:opacity-60 disabled:cursor-not-allowed';

const SIZES = {
    sm: 'text-small px-2.5 py-1.5 pr-8',
    md: 'text-body px-3.5 py-2.5 pr-9',
};

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
    { size = 'md', fullWidth = true, className = '', children, ...rest },
    ref,
) {
    return (
        <div className={`relative ${fullWidth ? 'w-full' : 'inline-block'}`}>
            <select
                ref={ref}
                className={`${BASE} ${SIZES[size]} ${fullWidth ? 'w-full' : 'w-auto'} ${className}`}
                {...rest}
            >
                {children}
            </select>
            <CaretDownIcon
                weight="bold"
                className={`pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 ${size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4'}`}
            />
        </div>
    );
});
