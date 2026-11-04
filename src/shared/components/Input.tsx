import { forwardRef, type InputHTMLAttributes, type TextareaHTMLAttributes, type ReactNode } from 'react';
import type { Icon } from '@phosphor-icons/react';

/**
 * --- INPUT / TEXTAREA ---
 * The single text-field primitive. Before this, the same long field className
 * (`w-full bg-gray-50 … rounded-xl …`) was copy-pasted across FormControls,
 * ProfileEditor, Settings, Login and AcceptInvite and had already drifted
 * (bg-gray-50 vs bg-gray-50/80, differing focus rings). Centralising it keeps
 * every field identical and bakes in:
 *   • a leading `icon` (handles the left padding for you),
 *   • a `trailing` slot (e.g. a show/hide-password button),
 *   • an `invalid` state that paints the border red for inline validation.
 */

const BASE =
    'w-full bg-white/70 dark:bg-white/5 border rounded-xl text-sm font-medium text-ink dark:text-white ' +
    'outline-none transition-all placeholder:font-normal placeholder:text-ink-soft/70 dark:placeholder:text-slate-500 ' +
    'disabled:opacity-60 disabled:cursor-not-allowed focus:bg-white dark:focus:bg-white/8 focus:ring-2 focus:ring-emerald-500/20';

const borderClass = (invalid?: boolean) =>
    invalid
        ? 'border-red-400 dark:border-red-500 focus:border-red-500'
        : 'border-ink/10 dark:border-white/10 focus:border-emerald-500';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
    /** Phosphor icon shown at the left (padding is handled automatically). */
    icon?: Icon;
    /** Content pinned to the right edge, e.g. a show/hide-password button. */
    trailing?: ReactNode;
    /** Paints the field as invalid (red border) for inline validation. */
    invalid?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
    { icon: LeadingIcon, trailing, invalid, className = '', ...rest },
    ref,
) {
    const pl = LeadingIcon ? 'pl-9' : 'pl-3';
    const pr = trailing ? 'pr-10' : 'pr-3';
    const field = (
        <input ref={ref} className={`${BASE} ${borderClass(invalid)} ${pl} ${pr} py-2 ${className}`} {...rest} />
    );

    if (!LeadingIcon && !trailing) return field;

    return (
        <div className="relative">
            {LeadingIcon && (
                <LeadingIcon
                    weight="bold"
                    className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-ink-soft/70 pointer-events-none dark:text-slate-500"
                />
            )}
            {field}
            {trailing && <div className="absolute right-2 top-1/2 -translate-y-1/2">{trailing}</div>}
        </div>
    );
});

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
    invalid?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
    { invalid, className = '', ...rest },
    ref,
) {
    return (
        <textarea ref={ref} className={`${BASE} ${borderClass(invalid)} px-3 py-2 ${className}`} {...rest} />
    );
});
