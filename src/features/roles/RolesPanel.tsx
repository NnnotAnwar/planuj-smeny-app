import { useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { LockSimpleIcon, PlusIcon, CaretRightIcon } from '@phosphor-icons/react';
import { Button } from '@shared/components/Button';
import { Skeleton } from '@shared/components/Skeleton';
import { useTranslation } from '@shared/preferences/PreferencesContext';
import type { TranslationKey } from '@shared/i18n/translations';
import { useOrgRoles } from './useOrgRoles';
import { RoleEditor } from './RoleEditor';
import { Select } from '@shared/components/Select';
import { AREAS, peopleKey, type OrgRole } from './types';

/**
 * --- ROLES (Head Admin) ---
 * The organization's roles, Discord-style: every org starts with the five
 * presets (editable, Head Admin locked); add your own ("Shift lead", "Bar
 * manager"…), pick a level and tick what they may read, change or delete.
 */
export function RolesPanel({
    organizationId,
    organizations,
}: {
    organizationId: string;
    /** Superadmin: every organization (picks whose roles to edit). */
    organizations?: { id: string; name: string; people: number }[];
}) {
    const t = useTranslation();
    // A Superadmin edits any organization's roles — start on the busiest one
    // (their own platform org usually has nobody in it).
    const [orgId, setOrgId] = useState(() =>
        organizations && organizations.length > 0 ? [...organizations].sort((a, b) => b.people - a.people)[0].id : organizationId,
    );
    const { list, roles, counts, save, remove } = useOrgRoles(orgId);
    const [editing, setEditing] = useState<OrgRole | 'new' | null>(null);

    const summary = (r: OrgRole) => {
        if (r.preset_key === 'head_admin') return t('roles.everything');
        const granted = AREAS.filter((a) => r.permissions.some((p) => p.area === a && p.can_read));
        if (granted.length === 0) return t('roles.ownOnly');
        return granted.map((a) => t(`roles.area.${a}` as TranslationKey)).join(' · ');
    };

    const current = editing && editing !== 'new' ? editing : null;
    const nextSort = Math.max(0, ...roles.map((r) => r.sort)) + 1;

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between gap-2 px-1">
                <div className="flex min-w-0 flex-1 items-center gap-2">
                    {organizations && organizations.length > 1 && (
                        <div className="w-44 shrink-0">
                        <Select size="sm" aria-label={t('roles.org')} value={orgId} onChange={(e) => { setOrgId(e.target.value); setEditing(null); }}>
                            {organizations.map((o) => (
                                <option key={o.id} value={o.id}>
                                    {o.name}
                                </option>
                            ))}
                        </Select>
                        </div>
                    )}
                    <p className="hidden text-meta text-ink-soft sm:block dark:text-slate-400">{t('roles.lead')}</p>
                </div>
                <Button size="sm" icon={PlusIcon} onClick={() => setEditing('new')} className="shrink-0">
                    {t('roles.new')}
                </Button>
            </div>
            <p className="px-1 text-caption text-ink-soft sm:hidden dark:text-slate-400">{t('roles.lead')}</p>

            {list.isLoading ? (
                <div className="space-y-2" aria-hidden>
                    {[0, 1, 2].map((i) => (
                        <Skeleton key={i} className="h-14 rounded-2xl" />
                    ))}
                </div>
            ) : (
                <ul className="glass divide-y divide-ink/6 overflow-hidden rounded-2xl dark:divide-white/6">
                    {roles.map((r) => (
                        <li key={r.id}>
                            <button
                                type="button"
                                onClick={() => setEditing(r)}
                                className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-white/50 dark:hover:bg-white/4"
                            >
                                <span className="size-3 shrink-0 rounded-full" style={{ backgroundColor: r.color }} aria-hidden />
                                <span className="min-w-0 flex-1">
                                    <span className="flex items-center gap-1.5 text-meta font-semibold text-ink dark:text-white">
                                        {r.name}
                                        {r.preset_key === 'head_admin' && <LockSimpleIcon weight="bold" className="size-3 text-ink-soft" />}
                                        {!r.preset_key && (
                                            <span className="rounded-full bg-emerald-500/12 px-1.5 py-px text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">
                                                {t('roles.custom')}
                                            </span>
                                        )}
                                    </span>
                                    <span className="line-clamp-2 text-caption text-ink-soft sm:line-clamp-1 dark:text-slate-400">
                                        {t(`roles.levelName.${r.base_role}` as TranslationKey)} · {summary(r)}
                                    </span>
                                </span>
                                <span className="shrink-0 text-caption tabular-nums text-ink-soft dark:text-slate-400">{t(peopleKey(counts[r.id] ?? 0), { n: counts[r.id] ?? 0 })}</span>
                                <CaretRightIcon weight="bold" className="size-3.5 shrink-0 text-ink-soft/60" />
                            </button>
                        </li>
                    ))}
                </ul>
            )}

            <AnimatePresence>
                {editing && (
                    <RoleEditor
                        role={current}
                        memberCount={current ? (counts[current.id] ?? 0) : 0}
                        busy={save.isPending || remove.isPending}
                        onClose={() => setEditing(null)}
                        onSave={(v) =>
                            save.mutate(
                                { id: current?.id, locked: current?.preset_key === 'head_admin', sort: current?.sort ?? nextSort, ...v },
                                { onSuccess: () => setEditing(null) },
                            )
                        }
                        onDelete={current && current.preset_key !== 'head_admin' ? () => remove.mutate(current.id, { onSuccess: () => setEditing(null) }) : undefined}
                        templates={roles.filter((r) => r.preset_key !== 'head_admin')}
                    />
                )}
            </AnimatePresence>
        </div>
    );
}
