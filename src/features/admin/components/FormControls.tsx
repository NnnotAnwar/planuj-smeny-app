import type { ReactNode } from 'react';
import { useTranslation } from '@shared/preferences/PreferencesContext';
import { Button } from '@shared/components/Button';

/**
 * --- ADMIN FORM CONTROLS ---
 * Small shared building blocks so every admin form looks identical.
 */

const FIELD_CLASS =
    'w-full bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 rounded-xl px-3 py-2.5 text-body text-gray-900 dark:text-white outline-none transition-all placeholder:text-gray-400 disabled:opacity-50';

export function Field({ label, children }: { label: string; children: ReactNode }) {
    return (
        <label className="block space-y-1.5">
            <span className="text-micro text-gray-400">{label}</span>
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
        <p className="text-small-strong text-red-500 bg-red-50 dark:bg-red-900/20 rounded-xl px-3 py-2">{message}</p>
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
    const t = useTranslation();
    return (
        <div className="flex gap-2 pt-1">
            <Button type="button" variant="secondary" fullWidth onClick={onCancel} disabled={isBusy}>
                {t('common.cancel')}
            </Button>
            <Button type="submit" variant="primary" fullWidth loading={isBusy}>
                {isBusy ? t('common.saving') : submitLabel}
            </Button>
        </div>
    );
}
