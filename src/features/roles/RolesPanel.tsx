import { useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { LockSimpleIcon, PlusIcon, CaretUpIcon, CaretDownIcon, UsersThreeIcon } from '@phosphor-icons/react';
import { Button } from '@shared/components/Button';
import { Skeleton } from '@shared/components/Skeleton';
import { Select } from '@shared/components/Select';
import { useTranslation } from '@shared/preferences/PreferencesContext';
import type { TranslationKey } from '@shared/i18n/translations';
import { useAuthContext } from '@features/auth/AuthContext';
import { can, isSuperAdmin, rankOf } from '@shared/auth/permissions';
import { useOrgRoles } from './useOrgRoles';
import { RoleEditor } from './RoleEditor';
import { ACTIONS, AREAS, emptyGrants, isDefaultRole, isLockedTop, peopleKey, type Grants, type OrgRole } from './types';

/**
 * --- ROLES (Discord-style hierarchy) ---
 * Top to bottom = most to least powerful: Head Admin is always on top, the
 * default role (Employee — everyone has it, like @everyone) always at the
 * bottom. Move roles with the arrows; you manage only people and roles below
 * your own, and can only hand out permissions you hold yourself.
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
    const { user } = useAuthContext();
    // A Superadmin edits any organization's roles — start on the busiest one.
    const [orgId, setOrgId] = useState(() =>
        organizations && organizations.length > 0 ? [...organizations].sort((a, b) => b.people - a.people)[0].id : organizationId,
    );
    const { list, roles, counts, save, move, remove } = useOrgRoles(orgId);
    const [editing, setEditing] = useState<OrgRole | 'new' | null>(null);

    const sa = !!user && isSuperAdmin(user);
    const myRank = user ? rankOf(user) : -1;
    const mayManage = can(user, 'roles.manage');
    const below = (r: OrgRole) => sa || r.sort < myRank;
    // What I may hand out (null = everything).
    const myGrants: Grants | null =
        sa || myRank >= 40 || !user?.permissions
            ? null
            : (() => {
                  const g = emptyGrants();
                  for (const a of AREAS) for (const x of ACTIONS) g[a][x] = !!user.permissions?.[a]?.[x];
                  return g;
              })();

    const movable = roles.filter((r) => !isLockedTop(r) && !isDefaultRole(r)); // already top→bottom
    const canMove = (r: OrgRole, up: boolean) => {
        if (!mayManage || isLockedTop(r) || isDefaultRole(r)) return false;
        const i = movable.findIndex((m) => m.id === r.id);
        const nb = movable[up ? i - 1 : i + 1];
        return !!nb && below(r) && below(nb);
    };

    const summary = (r: OrgRole) => {
        if (isLockedTop(r)) return t('roles.everything');
        const granted = AREAS.filter((a) => r.permissions.some((p) => p.area === a && p.can_read));
        if (granted.length === 0) return t('roles.ownOnly');
        return granted.map((a) => t(`roles.area.${a}` as TranslationKey)).join(' · ');
    };

    const current = editing && editing !== 'new' ? editing : null;
    const defaultRole = roles.find(isDefaultRole);
    const arrow = (r: OrgRole, up: boolean) => (
        <button
            type="button"
            aria-label={up ? t('roles.moveUp') : t('roles.moveDown')}
            title={up ? t('roles.moveUp') : t('roles.moveDown')}
            disabled={!canMove(r, up) || move.isPending}
            onClick={(e) => {
                e.stopPropagation();
                move.mutate({ id: r.id, up });
            }}
            className="flex size-6 items-center justify-center rounded-md text-ink-soft transition-colors hover:bg-ink/6 hover:text-ink disabled:invisible dark:text-slate-400 dark:hover:bg-white/8"
        >
            {up ? <CaretUpIcon weight="bold" className="size-3.5" /> : <CaretDownIcon weight="bold" className="size-3.5" />}
        </button>
    );

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
                {mayManage && (
                    <Button size="sm" icon={PlusIcon} onClick={() => setEditing('new')} className="shrink-0">
                        {t('roles.new')}
                    </Button>
                )}
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
                        <li key={r.id} className="flex items-center gap-1 pr-2">
                            {mayManage && (
                                <span className="flex shrink-0 flex-col pl-1.5">
                                    {arrow(r, true)}
                                    {arrow(r, false)}
                                </span>
                            )}
                            <button
                                type="button"
                                onClick={() => setEditing(r)}
                                className={`flex min-w-0 flex-1 items-center gap-3 py-2.5 text-left transition-colors hover:bg-white/50 dark:hover:bg-white/4 ${mayManage ? 'pl-1' : 'pl-3'}`}
                            >
                                <span className="size-3 shrink-0 rounded-full" style={{ backgroundColor: r.color }} aria-hidden />
                                <span className="min-w-0 flex-1">
                                    <span className="flex flex-wrap items-center gap-1.5 text-meta font-semibold text-ink dark:text-white">
                                        {r.name}
                                        {isLockedTop(r) && <LockSimpleIcon weight="bold" className="size-3 text-ink-soft" />}
                                        {isDefaultRole(r) && (
                                            <span className="inline-flex items-center gap-1 rounded-full bg-ink/6 px-1.5 py-px text-[10px] font-semibold text-ink-soft dark:bg-white/8 dark:text-slate-300">
                                                <UsersThreeIcon weight="bold" className="size-3" />
                                                {t('roles.default')}
                                            </span>
                                        )}
                                        {!r.preset_key && (
                                            <span className="rounded-full bg-emerald-500/12 px-1.5 py-px text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">
                                                {t('roles.custom')}
                                            </span>
                                        )}
                                    </span>
                                    <span className="line-clamp-2 text-caption text-ink-soft sm:line-clamp-1 dark:text-slate-400">{summary(r)}</span>
                                </span>
                                <span className="shrink-0 text-caption tabular-nums text-ink-soft dark:text-slate-400">
                                    {t(peopleKey(counts[r.id] ?? 0), { n: counts[r.id] ?? 0 })}
                                </span>
                            </button>
                        </li>
                    ))}
                </ul>
            )}
            {mayManage && <p className="px-1 text-caption text-ink-soft dark:text-slate-400">{t('roles.hierarchyHint')}</p>}

            <AnimatePresence>
                {editing && (
                    <RoleEditor
                        role={current}
                        memberCount={current ? (counts[current.id] ?? 0) : 0}
                        busy={save.isPending || remove.isPending}
                        myGrants={myGrants}
                        readOnly={!mayManage || (!!current && !below(current))}
                        defaultName={defaultRole?.name ?? t('roles.levelName.Employee')}
                        onClose={() => setEditing(null)}
                        onSave={(v) =>
                            save.mutate({ id: current?.id, locked: !!current && isLockedTop(current), ...v }, { onSuccess: () => setEditing(null) })
                        }
                        onDelete={current ? () => remove.mutate(current.id, { onSuccess: () => setEditing(null) }) : undefined}
                        templates={roles.filter((r) => !isLockedTop(r))}
                    />
                )}
            </AnimatePresence>
        </div>
    );
}
