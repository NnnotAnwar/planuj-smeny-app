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
    'w-full bg-gray-50 dark:bg-gray-800/50 border rounded-xl text-body text-gray-900 dark:text-white ' +
    'outline-none transition-all placeholder:text-gray-400 disabled:opacity-60 disabled:cursor-not-allowed ' +
    'focus:ring-2 focus:ring-emerald-500/20';

const borderClass = (invalid?: boolean) =>
    invalid
        ? 'border-red-400 dark:border-red-500 focus:border-red-500'
        : 'border-gray-200 dark:border-gray-700 focus:border-emerald-500';

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
    const pl = LeadingIcon ? 'pl-10' : 'pl-3.5';
    const pr = trailing ? 'pr-11' : 'pr-3.5';
    const field = (
        <input ref={ref} className={`${BASE} ${borderClass(invalid)} ${pl} ${pr} py-2.5 ${className}`} {...rest} />
    );

    if (!LeadingIcon && !trailing) return field;

    return (
        <div className="relative">
            {LeadingIcon && (
                <LeadingIcon
                    weight="bold"
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"
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
        <textarea ref={ref} className={`${BASE} ${borderClass(invalid)} px-3.5 py-2.5 ${className}`} {...rest} />
    );
});
