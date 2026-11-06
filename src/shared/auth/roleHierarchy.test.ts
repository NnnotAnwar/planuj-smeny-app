import { describe, it, expect } from 'vitest';
import { can, canEditTimesheetOf, canManageMember, canSetWageOf, outranks, rankOf, roleLabel, RANK } from './permissions';
import type { Profile, User } from '@/shared/types';

/**
 * Custom roles (#124): the hierarchy is the position of the organization role
 * (`org_role.sort`: Head Admin 40 … default role 0), and what a role may do is
 * its permission matrix — not the legacy level.
 */
type OrgRole = NonNullable<Profile['org_role']>;
const role = (name: string, sort: number, base = 'Employee'): OrgRole =>
    ({ id: `r-${name}`, name, color: '#000', base_role: base, preset_key: null, sort }) as OrgRole;

function person(id: string, orgRole: OrgRole | null, level = 0, permissions?: User['permissions']): User {
    return {
        id, username: id, first_name: null, last_name: null, email: `${id}@x.io`, organization_id: 'org1',
        role: { name: level === 100 ? 'Superadmin' : `level-${level}`, is_admin: level >= RANK.ADMIN, rank: level },
        org_role: orgRole, org_role_id: orgRole?.id ?? null, permissions,
    } as User;
}

const lead = role('Shift lead', 25);
const barista = role('Barista', 5);
const everyone = role('Employee', 0);

describe('rankOf', () => {
    it('is the organization role position, above the legacy level', () => {
        expect(rankOf(person('a', lead, 10))).toBe(25);
    });
    it('falls back to the level before role data loads; Superadmin is above all', () => {
        expect(rankOf(person('a', null, 20))).toBe(20);
        expect(rankOf(person('s', lead, 100))).toBe(100);
    });
});

describe('outranks', () => {
    it('only strictly higher positions outrank, never yourself', () => {
        const me = person('me', lead);
        expect(outranks(me, person('b', barista))).toBe(true);
        expect(outranks(me, person('peer', role('Other lead', 25)))).toBe(false);
        expect(outranks(me, me)).toBe(false);
        expect(outranks(person('b', barista), me)).toBe(false);
    });
    it('a Superadmin outranks everyone but themself', () => {
        const sa = person('sa', null, 100);
        expect(outranks(sa, person('h', role('Head Admin', 40)))).toBe(true);
        expect(outranks(sa, sa)).toBe(false);
    });
});

describe('the permission matrix decides what a role may do', () => {
    const grants = (area: string, read: boolean, write: boolean) => ({ [area]: { read, write, delete: false } }) as User['permissions'];

    it('a low position with Team change may manage people below it — not above', () => {
        const me = person('me', barista, 0, grants('members', true, true));
        expect(can(me, 'members.manage')).toBe(true);
        expect(canManageMember(me, person('new', everyone))).toBe(true);
        expect(canManageMember(me, person('boss', lead))).toBe(false);
    });

    it('a high position without the permission may not act, whatever its rank', () => {
        const me = person('me', lead, 30, grants('members', true, false));
        expect(can(me, 'members.view')).toBe(true);
        expect(can(me, 'members.manage')).toBe(false);
        expect(canManageMember(me, person('b', barista))).toBe(false);
    });

    it('timesheets and wages follow the same rule', () => {
        const me = person('me', lead, 0, { ...grants('timesheets', true, true), ...grants('wages', true, false) });
        expect(canEditTimesheetOf(me, person('b', barista))).toBe(true);
        expect(canEditTimesheetOf(me, person('peer', role('Peer', 25)))).toBe(false);
        expect(canSetWageOf(me, person('b', barista))).toBe(false);
    });

    it('the top position (Head Admin) holds everything regardless of the matrix', () => {
        const head = person('h', role('Head Admin', 40, 'Head Admin'), 40, {} as User['permissions']);
        expect(can(head, 'roles.manage')).toBe(true);
        expect(can(head, 'locations.manage')).toBe(true);
    });
});

describe('roleLabel', () => {
    it('shows the organization role name, else the level', () => {
        expect(roleLabel(person('a', lead))).toBe('Shift lead');
        expect(roleLabel(person('a', null, 20))).toBe('level-20');
    });
});
