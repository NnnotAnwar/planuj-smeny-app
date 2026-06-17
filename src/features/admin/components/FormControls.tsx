import type { ReactNode } from 'react';

/**
 * --- ADMIN FORM CONTROLS ---
 * Small shared building blocks so every admin form looks identical.
 */

const FIELD_CLASS =
    'w-full bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 rounded-xl px-3 py-2.5 text-sm font-medium text-gray-900 dark:text-white outline-none transition-all placeholder:text-gray-400 disabled:opacity-50';

export function Field({ label, children }: { label: string; children: ReactNode }) {
    return (
        <label className="block space-y-1.5">
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{label}</span>
            {children}
        </label>
    );
}

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
    return <input {...props} className={FIELD_CLASS} />;
}

export function SelectInput(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
    return <select {...props} className={FIELD_CLASS} />;
}

export function FormError({ message }: { message: string | null }) {
    if (!message) return null;
    return (
        <p className="text-xs font-bold text-red-500 bg-red-50 dark:bg-red-900/20 rounded-xl px-3 py-2">{message}</p>
    );
}

export function FormActions({
    onCancel,
    isBusy,
    submitLabel,
}: {
    onCancel: () => void;
    isBusy: boolean;
    submitLabel: string;
}) {
    return (
        <div className="flex gap-2 pt-1">
            <button
                type="button"
                onClick={onCancel}
                disabled={isBusy}
                className="flex-1 px-4 py-2.5 rounded-xl font-bold text-xs uppercase tracking-widest text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
            >
                Cancel
            </button>
            <button
                type="submit"
                disabled={isBusy}
                className="flex-1 px-4 py-2.5 rounded-xl font-bold text-xs uppercase tracking-widest text-white bg-emerald-500 hover:bg-emerald-600 transition-colors disabled:opacity-60 shadow-lg shadow-emerald-500/20"
            >
                {isBusy ? 'Saving…' : submitLabel}
            </button>
        </div>
    );
}
