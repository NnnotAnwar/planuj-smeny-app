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
 *  • Touch-friendly on phones — `md`/`lg` are ≥44px tall there (Apple HIG /
 *    Material minimum); from `md:` up, where a pointer is precise, they tighten
 *    to the compact desktop density.
 *  • Built-in loading — pass `loading` to show a spinner and block re-taps,
 *    so every async action has consistent in-flight feedback.
 *  • Accent-aware — `primary` uses the themable emerald token, so it follows
 *    whichever colour motif the user picked.
 */

type Variant = 'primary' | 'danger' | 'secondary' | 'tonal' | 'ghost';
type Size = 'sm' | 'md' | 'lg' | 'xl';

const BASE =
    'inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-all ' +
    'active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap select-none';

const SIZES: Record<Size, string> = {
    sm: 'text-meta px-3 min-h-9 md:min-h-8 gap-1.5',
    md: 'text-sm px-4 min-h-11 md:min-h-9', // 44px on phones — the touch-target floor
    lg: 'text-sm px-5 min-h-12 md:min-h-10',
    xl: 'text-base px-6 min-h-14 md:min-h-11 gap-2.5 tracking-tight', // hero CTAs (Start/End shift)
};

// Icons scale with the button so a big CTA doesn't get a tiny glyph.
const ICON_SIZES: Record<Size, string> = {
    sm: 'size-3.5',
    md: 'size-4',
    lg: 'size-4',
    xl: 'size-5',
};

// The lit top edge every filled button shares — reads as a pressable surface.
const LIT = 'shadow-[inset_0_1px_0_rgb(255_255_255/0.22),0_6px_16px_-8px_var(--btn-glow)]';

const VARIANTS: Record<Variant, string> = {
    // One dominant, accent-filled CTA — the happy path. accent-700 so white text
    // clears WCAG AA (>=4.5:1) on every motif, including the emerald brand.
    primary: `bg-linear-to-b from-emerald-600 to-emerald-700 text-white ${LIT} [--btn-glow:var(--color-emerald-600)] hover:brightness-110`,
    // Destructive, filled — reserved for irreversible actions. red-600 (not 500)
    // so white text clears WCAG AA (~4.8:1).
    danger: `bg-linear-to-b from-rose-600 to-rose-700 text-white ${LIT} [--btn-glow:var(--color-rose-600)] hover:brightness-110`,
    // Quiet, outlined — secondary choices that shouldn't compete with primary.
    secondary:
        'bg-white/60 ring-1 ring-ink/10 text-ink hover:bg-white ' +
        'dark:bg-white/5 dark:ring-white/10 dark:text-slate-200 dark:hover:bg-white/10',
    // Soft accent tint — an inviting-but-not-loud action (e.g. Edit, Request).
    tonal:
        'bg-emerald-500/10 text-emerald-700 ring-1 ring-emerald-500/15 hover:bg-emerald-500/15 ' +
        'dark:bg-emerald-400/10 dark:text-emerald-300 dark:ring-emerald-400/15 dark:hover:bg-emerald-400/15',
    // Lowest emphasis — tertiary / dismissive actions.
    ghost: 'text-ink-soft hover:bg-ink/5 hover:text-ink dark:text-slate-300 dark:hover:bg-white/5 dark:hover:text-white',
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
