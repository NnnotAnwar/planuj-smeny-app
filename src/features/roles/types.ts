import { z } from 'zod';
import type { PermissionArea, PermissionAction } from '@shared/types';

/** Every area a role can be granted, in the order the editor shows them. */
export const AREAS: PermissionArea[] = ['rota', 'timesheets', 'requests', 'announcements', 'members', 'wages', 'locations', 'activity'];
export const ACTIONS: PermissionAction[] = ['read', 'write', 'delete'];

/** The levels a custom role can sit at (Head Admin is the locked preset only). */
export const LEVELS = ['Employee', 'Supervisor', 'Manager', 'Admin'] as const;
export type Level = (typeof LEVELS)[number];
export const LEVEL_RANK: Record<string, number> = { Employee: 0, Supervisor: 10, Manager: 20, Admin: 30, 'Head Admin': 40, Superadmin: 100 };

export const ROLE_COLORS = ['#22c55e', '#0ea5e9', '#3b82f6', '#8b5cf6', '#ec4899', '#ef4444', '#f97316', '#eab308', '#14b8a6', '#64748b'];

const PermissionRowSchema = z.object({
    area: z.string(),
    can_read: z.boolean(),
    can_write: z.boolean(),
    can_delete: z.boolean(),
});

/** An organization role (preset or custom) with its permission rows. */
export const OrgRoleSchema = z.object({
    id: z.string(),
    organization_id: z.string(),
    name: z.string(),
    color: z.string(),
    base_role: z.string(),
    preset_key: z.string().nullable().optional(),
    sort: z.number().default(0),
    created_at: z.string(),
    permissions: z.array(PermissionRowSchema).default([]),
});
export type OrgRole = z.infer<typeof OrgRoleSchema>;

/** Editor state: area → granted actions. */
export type Grants = Record<PermissionArea, { read: boolean; write: boolean; delete: boolean }>;

export const emptyGrants = (): Grants =>
    Object.fromEntries(AREAS.map((a) => [a, { read: false, write: false, delete: false }])) as Grants;

export const grantsOf = (role: Pick<OrgRole, 'permissions'>): Grants => {
    const g = emptyGrants();
    for (const p of role.permissions) {
        if (p.area in g) g[p.area as PermissionArea] = { read: p.can_read, write: p.can_write, delete: p.can_delete };
    }
    return g;
};

/**
 * Toggle one cell keeping the matrix valid (as the DB requires): write needs
 * read, delete needs write — turning a higher right on turns the lower ones
 * on, turning a lower one off turns the higher ones off.
 */
export function toggleGrant(g: Grants, area: PermissionArea, action: PermissionAction): Grants {
    const cur = { ...g[area] };
    const on = !cur[action];
    if (action === 'read') {
        cur.read = on;
        if (!on) cur.write = cur.delete = false;
    } else if (action === 'write') {
        cur.write = on;
        if (on) cur.read = true;
        else cur.delete = false;
    } else {
        cur.delete = on;
        if (on) cur.read = cur.write = true;
    }
    return { ...g, [area]: cur };
}

/** Plural key for a head-count: 1 → _one, 2–4 → _few (Czech "lidé"), else the base ("lidí" / "people"). */
export const peopleKey = (n: number) => (n === 1 ? 'roles.members_one' : n >= 2 && n <= 4 ? 'roles.members_few' : 'roles.members') as
    | 'roles.members_one'
    | 'roles.members_few'
    | 'roles.members';
