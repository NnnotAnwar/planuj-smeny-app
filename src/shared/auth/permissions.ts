import type { User, Profile, Role, PermissionArea, PermissionAction } from '@shared/types';

/**
 * --- PERMISSIONS ---
 * What a user may do. Since custom roles (#124) a Head Admin grants read /
 * write / delete per AREA to each organization role; the user's role
 * permissions ride on `user.permissions` (loaded with the profile). The rank
 * (the role's LEVEL) still decides the hierarchy — who may manage whom.
 *
 *   Superadmin 100 > Head Admin 40 > Admin 30 > Manager 20 > Supervisor 10 > Employee 0
 *
 * Mirrors the database (`has_permission(area, action)` + RLS), so the UI only
 * offers what the server will allow. Pure functions — usable in route guards
 * and tests; components can use `usePermissions()`.
 */

export const RANK = {
    MANAGER: 20,
    ADMIN: 30,
    OWNER: 40, // "Head Admin" — always holds every permission; manages roles
} as const;

/**
 * --- CAPABILITIES ---
 * Screens ask by capability (`can(user, 'rota.edit')`); each one is an area +
 * action. Before a user's permissions are known (or for profiles without an
 * organization role) the preset thresholds below apply — the same defaults the
 * presets ship with.
 */
export type Capability =
    | 'team.view' // any observer view of the team (rota, timesheets, team, requests)
    | 'rota.view'
    | 'rota.edit' // plan / publish the rota, templates, coverage, open shifts, teams
    | 'timesheets.view'
    | 'timesheets.edit'
    | 'requests.view'
    | 'requests.decide' // approve or decline time off, name changes, swaps
    | 'announcements.post' // post, edit, pin and delete announcements
    | 'members.view'
    | 'members.manage' // invite and edit members below your level
    | 'wages.edit'
    | 'locations.manage' // create, edit and archive locations
    | 'activity.view'
    | 'roles.view'
    | 'roles.manage'; // create, edit, reorder roles below your own

const CAP: Record<Exclude<Capability, 'team.view'>, [PermissionArea, PermissionAction, number]> = {
    'rota.view': ['rota', 'read', RANK.MANAGER],
    'rota.edit': ['rota', 'write', RANK.ADMIN],
    'timesheets.view': ['timesheets', 'read', RANK.MANAGER],
    'timesheets.edit': ['timesheets', 'write', RANK.ADMIN],
    'requests.view': ['requests', 'read', RANK.MANAGER],
    'requests.decide': ['requests', 'write', RANK.ADMIN],
    'announcements.post': ['announcements', 'write', RANK.ADMIN],
    'members.view': ['members', 'read', RANK.MANAGER],
    'members.manage': ['members', 'write', RANK.ADMIN],
    'wages.edit': ['wages', 'write', RANK.ADMIN],
    'locations.manage': ['locations', 'write', RANK.OWNER],
    'activity.view': ['activity', 'read', RANK.ADMIN],
    'roles.view': ['roles', 'read', RANK.OWNER],
    'roles.manage': ['roles', 'write', RANK.OWNER],
};

/**
 * Hierarchy rank: the position of the member's organization role (Head Admin
 * 40 at the top, the default role 0 at the bottom); Superadmin above all.
 * Falls back to the legacy level before role data is loaded.
 */
export function rankOf(p: Pick<Profile, 'role' | 'org_role'>): number {
    if (p.role.name === 'Superadmin') return 100;
    return p.org_role?.sort ?? p.role.rank;
}

/** Whether `user` holds a capability (Superadmin and Head Admin hold them all). */
export function can(user: Pick<User, 'role' | 'permissions' | 'org_role'> | null | undefined, cap: Capability): boolean {
    if (!user) return false;
    if (isSuperAdmin(user) || rankOf(user as Pick<Profile, 'role' | 'org_role'>) >= RANK.OWNER) return true;
    if (cap === 'team.view') return (['rota.view', 'timesheets.view', 'members.view', 'requests.view'] as const).some((c) => can(user, c));
    const [area, action, minRank] = CAP[cap];
    if (user.permissions) return !!user.permissions[area]?.[action];
    return rankOf(user as Pick<Profile, 'role' | 'org_role'>) >= minRank;
}

export function isSuperAdmin(user: Pick<User, 'role'>): boolean {
    return user.role.name === 'Superadmin';
}

/** May open the Team (admin) panel. */
export function canViewAdminPanel(user: Pick<User, 'role' | 'permissions'>): boolean {
    return can(user, 'members.view');
}

/** May invite and manage members below their level. */
export function canManageEmployees(user: Pick<User, 'role' | 'permissions'>): boolean {
    return can(user, 'members.manage');
}

/** May create/edit/delete locations. */
export function canManageLocations(user: Pick<User, 'role' | 'permissions'>): boolean {
    return can(user, 'locations.manage');
}

/** Roles (levels) this user may assign/invite: strictly below their own rank. */
export function assignableRoles(roles: Role[], user: Pick<User, 'role'>): Role[] {
    return roles.filter((r) => r.rank < user.role.rank);
}

/** Out-ranks the target (and isn't them) — the hierarchy half of every "manage X" check. */
export function outranks(user: Pick<User, 'id' | 'role' | 'org_role'>, target: Pick<Profile, 'id' | 'role' | 'org_role'>): boolean {
    return target.id !== user.id && (isSuperAdmin(user as Pick<User, 'role'>) || rankOf(target) < rankOf(user));
}

/** May edit/delete a specific member: holds members.manage and out-ranks them. */
export function canManageMember(user: User, target: Pick<Profile, 'id' | 'role' | 'org_role'>): boolean {
    return canManageEmployees(user) && outranks(user, target);
}

/** May edit a specific member's timesheet: holds timesheets.edit and out-ranks them. */
export function canEditTimesheetOf(user: User, target: Pick<Profile, 'id' | 'role' | 'org_role'>): boolean {
    return can(user, 'timesheets.edit') && outranks(user, target);
}

/** May set a specific member's wage: holds wages.edit and out-ranks them. */
export function canSetWageOf(user: User, target: Pick<Profile, 'id' | 'role' | 'org_role'>): boolean {
    return can(user, 'wages.edit') && outranks(user, target);
}

/** What people see as someone's role: their organization role, else the level. */
export function roleLabel(p: Pick<Profile, 'role' | 'org_role'>): string {
    return p.org_role?.name ?? p.role.name;
}
