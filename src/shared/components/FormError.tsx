import { WarningCircleIcon } from '@phosphor-icons/react';

/**
 * --- FORM ERROR ---
 * The single inline error style for forms and dialogs. Before this, the same
 * red box (`text-red-500 bg-red-50 rounded-xl …`) — sometimes with an icon,
 * sometimes without, sometimes bordered — was hand-written in every form.
 * Renders nothing when there's no message, so call sites can pass state directly.
 */
export function FormError({ message, className = '' }: { message?: string | null; className?: string }) {
    if (!message) return null;
    return (
        <p
            role="alert"
            className={`flex items-start gap-2 text-small-strong text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 rounded-xl px-3 py-2.5 ${className}`}
        >
            <WarningCircleIcon weight="fill" className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{message}</span>
        </p>
    );
}
