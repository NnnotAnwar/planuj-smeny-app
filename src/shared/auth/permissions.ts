import type { User, Profile, Role } from '@shared/types';

/**
 * --- PERMISSIONS ---
 * Capability checks derived from the role hierarchy (rank). Mirrors the RLS
 * policies in the database so the UI only offers what the server will allow.
 *
 *   Superadmin 100 > Head Admin 40 > Admin 30 > Manager 20 > Supervisor 10 > Employee 0
 *
 * These are pure functions (no React) so they can be used in route guards and
 * tests. For components, prefer the `usePermissions()` hook which wraps these
 * with the current auth user.
 */

export const RANK = {
    MANAGER: 20, // observer: sees the team's rota, timesheets, team page and requests
    ADMIN: 30, // acts: plans the rota, edits timesheets, decides requests, manages members
    OWNER: 40, // "Head Admin" — can also manage locations
} as const;

/**
 * --- CAPABILITIES ---
 * What a user may do, named by area rather than by rank. Today each one maps
 * to a minimum rank (managers OBSERVE, admins ACT — Supervisor is only a
 * badge); the plan is custom roles where a Head Admin grants these per role,
 * Discord-style. Screens ask `can(user, 'rota.edit')`, so that switch only
 * changes this table, never the UI.
 */
export type Capability =
    | 'team.view' // see the team rota, timesheets, team page and requests (read-only)
    | 'rota.edit' // plan / publish the rota, templates, coverage, open shifts, teams
    | 'requests.decide' // approve or decline time off and name changes
    | 'announcements.post' // post, edit, pin and delete announcements
    | 'members.manage' // invite and edit members ranked below you
    | 'locations.manage'; // create, edit and archive locations

const CAPABILITY_MIN_RANK: Record<Capability, number> = {
    'team.view': RANK.MANAGER,
    'rota.edit': RANK.ADMIN,
    'requests.decide': RANK.ADMIN,
    'announcements.post': RANK.ADMIN,
    'members.manage': RANK.ADMIN,
    'locations.manage': RANK.OWNER,
};

/** Whether `user` holds a capability (Superadmin holds them all). */
export function can(user: Pick<User, 'role'> | null | undefined, cap: Capability): boolean {
    if (!user) return false;
    return isSuperAdmin(user) || user.role.rank >= CAPABILITY_MIN_RANK[cap];
}

export function isSuperAdmin(user: Pick<User, 'role'>): boolean {
    return user.role.name === 'Superadmin';
}

/**
 * May open the admin panel. Manager and above can VIEW it (read-only for
 * Manager); write capabilities are gated separately (canManageEmployees /
 * canManageLocations) and enforced by RLS. Single source of truth for the
 * /admin route guard and the nav item — replaces the legacy `is_admin` flag.
 */
export function canViewAdminPanel(user: Pick<User, 'role'>): boolean {
    return can(user, 'team.view');
}

/** Admin level or above: may invite and manage lower-ranked members. */
export function canManageEmployees(user: Pick<User, 'role'>): boolean {
    return can(user, 'members.manage');
}

/** Head Admin (owner) or above: may create/edit/delete locations. */
export function canManageLocations(user: Pick<User, 'role'>): boolean {
    return can(user, 'locations.manage');
}

/** Roles this user may assign/invite: strictly below their own rank. */
export function assignableRoles(roles: Role[], user: Pick<User, 'role'>): Role[] {
    return roles.filter((r) => r.rank < user.role.rank);
}

/**
 * Whether this user may edit/delete a specific member: they must out-rank the
 * target and it cannot be themselves.
 */
export function canManageMember(user: User, target: Pick<Profile, 'id' | 'role'>): boolean {
    if (target.id === user.id) return false;
    return canManageEmployees(user) && target.role.rank < user.role.rank;
}
