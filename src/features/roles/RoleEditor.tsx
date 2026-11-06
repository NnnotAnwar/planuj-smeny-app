import { useState } from 'react';
import { LockSimpleIcon, TrashIcon, CheckIcon } from '@phosphor-icons/react';
import { Modal } from '@features/admin/components/Modal';
import { Button } from '@shared/components/Button';
import { Input } from '@shared/components/Input';
import { Select } from '@shared/components/Select';
import { FormError } from '@shared/components/FormError';
import { useTranslation } from '@shared/preferences/PreferencesContext';
import type { TranslationKey } from '@shared/i18n/translations';
import { ACTIONS, AREAS, LEVELS, ROLE_COLORS, emptyGrants, grantsOf, peopleKey, toggleGrant, type Grants, type OrgRole } from './types';

/**
 * --- ROLE EDITOR ---
 * Name, colour, level (who they sit above in the hierarchy) and the permission
 * matrix: each area × read / write / delete. Write needs read and delete needs
 * write — the matrix keeps that consistent as you tap. The Head Admin role is
 * locked (only its colour can change); presets keep their level.
 */
export function RoleEditor({
    role,
    memberCount,
    busy,
    onSave,
    onDelete,
    onClose,
}: {
    role: OrgRole | null; // null = new role
    memberCount: number;
    busy: boolean;
    onSave: (v: { name: string; color: string; base_role: string; grants: Grants }) => void;
    onDelete?: () => void;
    onClose: () => void;
}) {
    const t = useTranslation();
    const locked = role?.preset_key === 'head_admin';
    const isPreset = !!role?.preset_key;
    const [name, setName] = useState(role?.name ?? '');
    const [color, setColor] = useState(role?.color ?? ROLE_COLORS[1]);
    const [level, setLevel] = useState(role?.base_role ?? 'Employee');
    const [grants, setGrants] = useState<Grants>(() => (role ? grantsOf(role) : emptyGrants()));
    const [error, setError] = useState<string | null>(null);

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) return setError(t('roles.nameRequired'));
        onSave({ name: name.trim(), color, base_role: level, grants });
    };

    const cell = (area: (typeof AREAS)[number], action: (typeof ACTIONS)[number]) => {
        const on = locked || grants[area][action];
        return (
            <button
                type="button"
                role="checkbox"
                aria-checked={on}
                aria-label={`${t(`roles.area.${area}` as TranslationKey)} · ${t(`roles.action.${action}` as TranslationKey)}`}
                disabled={locked}
                onClick={() => setGrants((g) => toggleGrant(g, area, action))}
                className={`mx-auto flex size-7 items-center justify-center rounded-lg transition-colors disabled:cursor-not-allowed ${
                    on ? 'bg-emerald-600 text-white' : 'bg-ink/6 text-transparent hover:bg-ink/10 dark:bg-white/8 dark:hover:bg-white/12'
                }`}
            >
                <CheckIcon weight="bold" className="size-3.5" />
            </button>
        );
    };

    return (
        <Modal title={role ? t('roles.edit') : t('roles.new')} subtitle={role ? t(peopleKey(memberCount), { n: memberCount }) : t('roles.newHint')} onClose={onClose}>
            <form onSubmit={submit} className="space-y-4">
                <div className="grid gap-3">
                    <div className="space-y-1.5">
                        <label htmlFor="role-name" className="text-label text-ink-soft dark:text-slate-400">{t('roles.name')}</label>
                        <Input id="role-name" value={name} maxLength={40} disabled={locked} onChange={(e) => setName(e.target.value)} placeholder={t('roles.namePh')} autoFocus={!role} />
                    </div>
                    <div className="space-y-1.5">
                        <span className="text-label text-ink-soft dark:text-slate-400">{t('roles.color')}</span>
                        <div className="flex flex-wrap gap-1.5 pt-1">
                            {ROLE_COLORS.map((c) => (
                                <button
                                    key={c}
                                    type="button"
                                    aria-label={c}
                                    aria-pressed={color === c}
                                    onClick={() => setColor(c)}
                                    style={{ backgroundColor: c }}
                                    className={`size-6 rounded-full ring-offset-2 ring-offset-white transition-shadow dark:ring-offset-slate-900 ${color === c ? 'ring-2 ring-ink/60 dark:ring-white/70' : ''}`}
                                />
                            ))}
                        </div>
                    </div>
                </div>

                <div className="space-y-1.5">
                    <span className="text-label text-ink-soft dark:text-slate-400">{t('roles.level')}</span>
                    {isPreset ? (
                        <p className="flex items-center gap-1.5 text-meta text-ink dark:text-slate-200">
                            <LockSimpleIcon weight="bold" className="size-3.5 text-ink-soft" />
                            {t(`roles.levelName.${role!.base_role}` as TranslationKey)}
                        </p>
                    ) : (
                        <Select aria-label={t('roles.level')} value={level} onChange={(e) => setLevel(e.target.value)} fullWidth>
                            {LEVELS.map((l) => (
                                <option key={l} value={l}>
                                    {t(`roles.levelName.${l}` as TranslationKey)}
                                </option>
                            ))}
                        </Select>
                    )}
                    <p className="text-caption text-ink-soft dark:text-slate-400">{t('roles.levelHint')}</p>
                </div>

                <div className="space-y-1.5">
                    <span className="text-label text-ink-soft dark:text-slate-400">{t('roles.permissions')}</span>
                    {locked && (
                        <p className="flex items-center gap-1.5 text-caption text-ink-soft dark:text-slate-400">
                            <LockSimpleIcon weight="bold" className="size-3.5" />
                            {t('roles.lockedHint')}
                        </p>
                    )}
                    <div className="overflow-hidden rounded-xl ring-1 ring-ink/8 dark:ring-white/8">
                        <table className="w-full text-meta">
                            <thead>
                                <tr className="bg-ink/4 dark:bg-white/4">
                                    <th className="px-3 py-2 text-left text-label text-ink-soft dark:text-slate-400">{t('roles.area')}</th>
                                    {ACTIONS.map((a) => (
                                        <th key={a} className="w-16 px-1 py-2 text-center text-label text-ink-soft dark:text-slate-400">
                                            {t(`roles.action.${a}` as TranslationKey)}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {AREAS.map((area) => (
                                    <tr key={area} className="border-t border-ink/6 dark:border-white/6">
                                        <td className="px-3 py-1.5">
                                            <span className="block font-semibold text-ink dark:text-white">{t(`roles.area.${area}` as TranslationKey)}</span>
                                            <span className="block text-caption text-ink-soft dark:text-slate-400">{t(`roles.areaHint.${area}` as TranslationKey)}</span>
                                        </td>
                                        {ACTIONS.map((a) => (
                                            <td key={a} className="px-1 py-1.5">{cell(area, a)}</td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <p className="text-caption text-ink-soft dark:text-slate-400">{t('roles.matrixHint')}</p>
                </div>

                <FormError message={error} />
                <div className="flex items-center justify-between gap-2">
                    {onDelete && !isPreset ? (
                        <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            icon={TrashIcon}
                            disabled={busy || memberCount > 0}
                            title={memberCount > 0 ? t('roles.inUse') : undefined}
                            onClick={onDelete}
                            className="text-rose-600 dark:text-rose-400"
                        >
                            {t('roles.delete')}
                        </Button>
                    ) : (
                        <span />
                    )}
                    <div className="flex gap-2">
                        <Button type="button" size="sm" variant="ghost" onClick={onClose} disabled={busy}>
                            {t('common.cancel')}
                        </Button>
                        <Button type="submit" size="sm" loading={busy}>
                            {t('common.save')}
                        </Button>
                    </div>
                </div>
            </form>
        </Modal>
    );
}

