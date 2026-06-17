import type { User, Profile, Role } from '@/shared/types';

/**
 * --- ADMIN PERMISSIONS ---
 * Capability checks derived from the role hierarchy (rank). Mirrors the RLS
 * policies in the database so the UI only offers what the server will allow.
 *
 *   Superadmin 100 > Head Admin 40 > Admin 30 > Manager 20 > Supervisor 10 > Employee 0
 */

export const RANK = {
    MANAGER: 20, // can view the admin panel
    ADMIN: 30, // can invite + manage members below them
    OWNER: 40, // "Head Admin" — can also manage locations
} as const;

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
    return user.role.rank >= RANK.MANAGER;
}

/** Admin level or above: may invite and manage lower-ranked members. */
export function canManageEmployees(user: Pick<User, 'role'>): boolean {
    return user.role.rank >= RANK.ADMIN;
}

/** Head Admin (owner) or above: may create/edit/delete locations. */
export function canManageLocations(user: Pick<User, 'role'>): boolean {
    return user.role.rank >= RANK.OWNER;
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
