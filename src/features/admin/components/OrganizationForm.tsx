import { useState } from 'react';
import { Modal } from './Modal';
import { Field, TextInput, FormError, FormActions } from './FormControls';
import { useAdminContext } from '../AdminContext';
import type { Organization } from '@/shared/types';
import { useTranslation } from '@shared/preferences/PreferencesContext';

/** Turns a free-text name into a url-safe slug. */
function slugify(value: string): string {
    return value
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

/**
 * Create or edit an organization (Superadmin only).
 * When `org` is provided we're editing; otherwise creating.
 */
export function OrganizationForm({ org, onClose }: { org?: Organization; onClose: () => void }) {
    const { createOrganization, updateOrganization } = useAdminContext();
    const t = useTranslation();
    const isEdit = Boolean(org);

    const [name, setName] = useState(org?.name ?? '');
    const [slug, setSlug] = useState(org?.slug ?? '');
    const [slugTouched, setSlugTouched] = useState(isEdit);
    const [isBusy, setIsBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleNameChange = (value: string) => {
        setName(value);
        if (!slugTouched) setSlug(slugify(value));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const trimmedName = name.trim();
        const trimmedSlug = slugify(slug);
        if (!trimmedName) return setError(t('admin.orgNameRequired'));
        if (!trimmedSlug) return setError(t('admin.orgSlugRequired'));

        setIsBusy(true);
        setError(null);
        try {
            if (isEdit && org) {
                await updateOrganization(org.id, { name: trimmedName, slug: trimmedSlug });
            } else {
                await createOrganization(trimmedName, trimmedSlug);
            }
            onClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : t('admin.orgSaveError'));
            setIsBusy(false);
        }
    };

    return (
        <Modal
            title={isEdit ? t('admin.orgEditTitle') : t('admin.orgNewTitle')}
            subtitle={isEdit ? org?.slug : 'Superadmin'}
            onClose={onClose}
        >
            <form onSubmit={handleSubmit} className="space-y-4">
                <Field label={t('admin.fieldName')}>
                    <TextInput
                        value={name}
                        onChange={(e) => handleNameChange(e.target.value)}
                        placeholder="Acme Hospitality"
                        autoFocus
                    />
                </Field>
                <Field label={t('admin.fieldSlug')}>
                    <TextInput
                        value={slug}
                        onChange={(e) => {
                            setSlugTouched(true);
                            setSlug(e.target.value);
                        }}
                        placeholder="acme-hospitality"
                    />
                </Field>
                <FormError message={error} />
                <FormActions onCancel={onClose} isBusy={isBusy} submitLabel={isEdit ? t('common.save') : t('common.create')} />
            </form>
        </Modal>
    );
}
