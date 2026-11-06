import { useState } from 'react';
import { LockSimpleIcon, TrashIcon, CheckIcon } from '@phosphor-icons/react';
import { Modal } from '@features/admin/components/Modal';
import { Button } from '@shared/components/Button';
import { Input } from '@shared/components/Input';
import { Select } from '@shared/components/Select';
import { FormError } from '@shared/components/FormError';
import { useTranslation } from '@shared/preferences/PreferencesContext';
import type { TranslationKey } from '@shared/i18n/translations';
import { ACTIONS, AREAS, ROLE_COLORS, emptyGrants, grantsOf, isDefaultRole, isLockedTop, peopleKey, toggleGrant, type Grants, type OrgRole } from './types';

/**
 * --- ROLE EDITOR ---
 * Name, colour and the permission matrix (area × view / change / delete).
 * Where a role sits in the hierarchy is set by moving it in the list. Rules the
 * DB enforces, mirrored here: you can only tick permissions you hold yourself
 * (others are greyed out); the Head Admin role is locked; the default role
 * (Employee) can't be deleted — deleting any other role moves its people there.
 */
export function RoleEditor({
    role,
    memberCount,
    busy,
    myGrants,
    readOnly = false,
    defaultName,
    onSave,
    onDelete,
    onClose,
    templates = [],
}: {
    role: OrgRole | null; // null = new role
    memberCount: number;
    busy: boolean;
    /** What the editor may hand out; null = everything (Head Admin / Superadmin). */
    myGrants: Grants | null;
    /** The role sits at or above the editor's own: view only. */
    readOnly?: boolean;
    /** Name of the default role, for "its people move to …". */
    defaultName: string;
    onSave: (v: { name: string; color: string; grants: Grants; before: Grants }) => void;
    onDelete?: () => void;
    onClose: () => void;
    /** Roles a new role can start from (copies permissions). */
    templates?: OrgRole[];
}) {
    const t = useTranslation();
    const locked = !!role && isLockedTop(role);
    const isDefault = !!role && isDefaultRole(role);
    const frozen = locked || readOnly;
    const [name, setName] = useState(role?.name ?? '');
    const [color, setColor] = useState(role?.color ?? ROLE_COLORS[1]);
    const [before] = useState<Grants>(() => (role ? grantsOf(role) : emptyGrants()));
    const [grants, setGrants] = useState<Grants>(before);
    const [error, setError] = useState<string | null>(null);
    const [from, setFrom] = useState('');

    const mayGrant = (area: (typeof AREAS)[number], action: (typeof ACTIONS)[number]) => !myGrants || myGrants[area][action];
    // Copy a template's permissions — only those you may hand out.
    const startFrom = (id: string) => {
        setFrom(id);
        const tpl = templates.find((r) => r.id === id);
        const g = tpl ? grantsOf(tpl) : emptyGrants();
        if (myGrants) for (const a of AREAS) for (const x of ACTIONS) if (!myGrants[a][x]) g[a][x] = false;
        setGrants(g);
    };

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) return setError(t('roles.nameRequired'));
        onSave({ name: name.trim(), color, grants, before });
    };

    const cell = (area: (typeof AREAS)[number], action: (typeof ACTIONS)[number]) => {
        const on = locked || grants[area][action];
        const disabled = frozen || !mayGrant(area, action);
        return (
            <button
                type="button"
                role="checkbox"
                aria-checked={on}
                aria-label={`${t(`roles.area.${area}` as TranslationKey)} · ${t(`roles.action.${action}` as TranslationKey)}`}
                title={!frozen && !mayGrant(area, action) ? t('roles.cantGrant') : undefined}
                disabled={disabled}
                onClick={() => setGrants((g) => toggleGrant(g, area, action))}
                className={`mx-auto flex size-7 items-center justify-center rounded-lg transition-colors disabled:cursor-not-allowed ${
                    on ? 'bg-emerald-600 text-white' : 'bg-ink/6 text-transparent hover:bg-ink/10 dark:bg-white/8 dark:hover:bg-white/12'
                } ${disabled && !locked ? 'opacity-40' : ''}`}
            >
                <CheckIcon weight="bold" className="size-3.5" />
            </button>
        );
    };

    return (
        <Modal title={role ? (frozen ? role.name : t('roles.edit')) : t('roles.new')} subtitle={role ? t(peopleKey(memberCount), { n: memberCount }) : t('roles.newHint')} onClose={onClose}>
            <form onSubmit={submit} className="space-y-4">
                {!role && templates.length > 0 && (
                    <div className="space-y-1.5">
                        <span className="text-label text-ink-soft dark:text-slate-400">{t('roles.startFrom')}</span>
                        <Select aria-label={t('roles.startFrom')} value={from} onChange={(e) => startFrom(e.target.value)} fullWidth>
                            <option value="">{t('roles.startBlank')}</option>
                            {templates.map((r) => (
                                <option key={r.id} value={r.id}>
                                    {r.name}
                                </option>
                            ))}
                        </Select>
                        <p className="text-caption text-ink-soft dark:text-slate-400">{t('roles.startFromHint')}</p>
                    </div>
                )}

                <div className="grid gap-3">
                    <div className="space-y-1.5">
                        <label htmlFor="role-name" className="text-label text-ink-soft dark:text-slate-400">{t('roles.name')}</label>
                        <Input id="role-name" value={name} maxLength={40} disabled={frozen} onChange={(e) => setName(e.target.value)} placeholder={t('roles.namePh')} autoFocus={!role} />
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
                                    disabled={readOnly}
                                    onClick={() => setColor(c)}
                                    style={{ backgroundColor: c }}
                                    className={`size-6 rounded-full ring-offset-2 ring-offset-white transition-shadow disabled:opacity-60 dark:ring-offset-slate-900 ${color === c ? 'ring-2 ring-ink/60 dark:ring-white/70' : ''}`}
                                />
                            ))}
                        </div>
                    </div>
                </div>

                {(isDefault || readOnly || locked) && (
                    <p className="flex items-start gap-1.5 rounded-xl bg-ink/4 px-3 py-2 text-caption text-ink-soft dark:bg-white/4 dark:text-slate-400">
                        <LockSimpleIcon weight="bold" className="mt-px size-3.5 shrink-0" />
                        {locked ? t('roles.lockedHint') : readOnly ? t('roles.aboveYou') : t('roles.defaultHint')}
                    </p>
                )}

                <div className="space-y-1.5">
                    <span className="text-label text-ink-soft dark:text-slate-400">{t('roles.permissions')}</span>
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
                                        <td className="px-3 py-1 sm:py-1.5" title={t(`roles.areaHint.${area}` as TranslationKey)}>
                                            <span className="block font-semibold text-ink dark:text-white">{t(`roles.area.${area}` as TranslationKey)}</span>
                                            {/* Phones keep the matrix short — the hint lives in the tooltip there. */}
                                            <span className="hidden text-caption text-ink-soft sm:block dark:text-slate-400">{t(`roles.areaHint.${area}` as TranslationKey)}</span>
                                        </td>
                                        {ACTIONS.map((a) => (
                                            <td key={a} className="px-1 py-1 sm:py-1.5">{cell(area, a)}</td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <p className="text-caption text-ink-soft dark:text-slate-400">{myGrants ? t('roles.matrixHintOwn') : t('roles.matrixHint')}</p>
                </div>

                <FormError message={error} />
                <div className="flex flex-wrap items-center justify-between gap-2">
                    {onDelete && !frozen && !isDefault ? (
                        <div className="min-w-0">
                            <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                icon={TrashIcon}
                                disabled={busy}
                                onClick={onDelete}
                                className="text-rose-600 dark:text-rose-400"
                            >
                                {t('roles.delete')}
                            </Button>
                            {memberCount > 0 && (
                                <p className="px-1 text-caption text-ink-soft dark:text-slate-400">{t('roles.deleteMoves', { n: memberCount, role: defaultName })}</p>
                            )}
                        </div>
                    ) : (
                        <span />
                    )}
                    <div className="flex gap-2">
                        <Button type="button" size="sm" variant="ghost" onClick={onClose} disabled={busy}>
                            {frozen ? t('common.close') : t('common.cancel')}
                        </Button>
                        {!readOnly && (
                            <Button type="submit" size="sm" loading={busy}>
                                {t('common.save')}
                            </Button>
                        )}
                    </div>
                </div>
            </form>
        </Modal>
    );
}
