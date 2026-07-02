import type { ReactNode } from 'react';
import { useTranslation } from '@shared/preferences/PreferencesContext';
import { Button } from '@shared/components/Button';
import { Input } from '@shared/components/Input';
import { Select } from '@shared/components/Select';

/**
 * --- ADMIN FORM CONTROLS ---
 * Small shared building blocks so every admin form looks identical.
 */

export function Field({ label, children }: { label: string; children: ReactNode }) {
    return (
        <label className="block space-y-1.5">
            <span className="text-micro text-gray-400">{label}</span>
            {children}
        </label>
    );
}

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
    return <Input {...props} />;
}

export function SelectInput(props: Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'size'>) {
    return <Select {...props} />;
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
