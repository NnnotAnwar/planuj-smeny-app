import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { CircleNotchIcon, type Icon, type IconWeight } from '@phosphor-icons/react';

/**
 * --- BUTTON ---
 * The single source of truth for buttons across the app. Before this, every
 * call site hand-wrote long className strings, so padding, radius and text size
 * drifted (px-6/px-8, py-3/py-3.5, rounded-xl/2xl…). Centralising them here
 * guarantees a consistent visual hierarchy — one obvious `primary` action per
 * view — and bakes in a few UX defaults:
 *
 *  • Touch-friendly — `md`/`lg` are ≥44px tall (Apple HIG / Material minimum).
 *  • Built-in loading — pass `loading` to show a spinner and block re-taps,
 *    so every async action has consistent in-flight feedback.
 *  • Accent-aware — `primary` uses the themable emerald token, so it follows
 *    whichever colour motif the user picked.
 */

type Variant = 'primary' | 'danger' | 'secondary' | 'tonal' | 'ghost';
type Size = 'sm' | 'md' | 'lg' | 'xl';

const BASE =
    'inline-flex items-center justify-center gap-2 rounded-xl font-bold transition-all ' +
    'active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap select-none';

const SIZES: Record<Size, string> = {
    sm: 'text-sm px-3 min-h-9 gap-1.5',
    md: 'text-sm px-4 min-h-11', // 44px — the mobile touch-target floor
    lg: 'text-base px-6 min-h-12',
    xl: 'text-lg px-6 min-h-14 gap-2.5 tracking-tight', // hero CTAs (Start/End shift)
};

// Icons scale with the button so a big CTA doesn't get a tiny glyph.
const ICON_SIZES: Record<Size, string> = {
    sm: 'w-4 h-4',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
    xl: 'w-6 h-6',
};

const VARIANTS: Record<Variant, string> = {
    // One dominant, accent-filled CTA — the happy path.
    primary: 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/20 hover:bg-emerald-700',
    // Destructive, filled — reserved for irreversible actions.
    danger: 'bg-red-500 text-white shadow-sm shadow-red-500/20 hover:bg-red-600',
    // Quiet, outlined — secondary choices that shouldn't compete with primary.
    secondary:
        'border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 ' +
        'hover:bg-gray-50 dark:hover:bg-white/5',
    // Soft accent tint — an inviting-but-not-loud action (e.g. Edit, Request).
    tonal:
        'bg-emerald-50 dark:bg-emerald-900/15 text-emerald-600 dark:text-emerald-400 ' +
        'border border-emerald-100 dark:border-emerald-900/30 hover:bg-emerald-100 dark:hover:bg-emerald-900/25',
    // Lowest emphasis — tertiary / dismissive actions.
    ghost: 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: Variant;
    size?: Size;
    /** Shows a spinner and disables the button while an async action runs. */
    loading?: boolean;
    /** Phosphor icon rendered before the label (hidden while loading). */
    icon?: Icon;
    /** Weight for the leading icon — e.g. 'fill' for media-style Play/Stop. */
    iconWeight?: IconWeight;
    fullWidth?: boolean;
    children?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
    { variant = 'primary', size = 'md', loading = false, icon: LeadingIcon, iconWeight = 'bold', fullWidth, disabled, className = '', children, ...rest },
    ref,
) {
    const iconClass = ICON_SIZES[size];
    return (
        <button
            ref={ref}
            disabled={disabled || loading}
            aria-busy={loading || undefined}
            className={`${BASE} ${SIZES[size]} ${VARIANTS[variant]} ${fullWidth ? 'w-full' : ''} ${className}`}
            {...rest}
        >
            {loading ? (
                <CircleNotchIcon weight="bold" className={`${iconClass} animate-spin`} />
            ) : (
                LeadingIcon && <LeadingIcon weight={iconWeight} className={iconClass} />
            )}
            {children}
        </button>
    );
});
