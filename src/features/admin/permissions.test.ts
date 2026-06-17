import { describe, it, expect } from 'vitest';
import {
    isSuperAdmin,
    canManageEmployees,
    canManageLocations,
    canViewAdminPanel,
    assignableRoles,
    canManageMember,
    RANK,
} from './permissions';
import type { Role, User } from '@/shared/types';

function mkUser(rank: number, id = 'u1', name = `role-${rank}`): User {
    return {
        id,
        username: 'user',
        first_name: null,
        last_name: null,
        email: 'a@b.c',
        organization_id: 'org1',
        role: { name, is_admin: rank >= RANK.ADMIN, rank },
    } as User;
}

function mkRole(name: string, rank: number): Role {
    return { name, is_admin: rank >= RANK.ADMIN, rank } as Role;
}

describe('isSuperAdmin', () => {
    it('is true only for the Superadmin role name', () => {
        expect(isSuperAdmin({ role: { name: 'Superadmin', is_admin: true, rank: 100 } })).toBe(true);
        expect(isSuperAdmin({ role: { name: 'Head Admin', is_admin: true, rank: 40 } })).toBe(false);
    });
});

describe('capability gates by rank', () => {
    it('canManageEmployees requires Admin (>=30)', () => {
        expect(canManageEmployees(mkUser(30))).toBe(true);
        expect(canManageEmployees(mkUser(40))).toBe(true);
        expect(canManageEmployees(mkUser(20))).toBe(false);
    });

    it('canManageLocations requires Head Admin (>=40)', () => {
        expect(canManageLocations(mkUser(40))).toBe(true);
        expect(canManageLocations(mkUser(30))).toBe(false);
    });

    it('canViewAdminPanel requires Manager (>=20)', () => {
        expect(canViewAdminPanel(mkUser(20))).toBe(true);
        expect(canViewAdminPanel(mkUser(10))).toBe(false);
    });
});

describe('assignableRoles', () => {
    it('returns only roles strictly below the user rank', () => {
        const roles = [mkRole('Employee', 0), mkRole('Manager', 20), mkRole('Admin', 30), mkRole('Head Admin', 40)];
        const names = assignableRoles(roles, mkUser(30)).map((r) => r.name);
        expect(names).toEqual(['Employee', 'Manager']);
    });
});

describe('canManageMember', () => {
    const admin = mkUser(30, 'admin');

    it('allows managing a strictly lower-ranked member', () => {
        expect(canManageMember(admin, { id: 'emp', role: { name: 'Employee', is_admin: false, rank: 0 } })).toBe(true);
    });

    it('forbids managing a peer (same rank)', () => {
        expect(canManageMember(admin, { id: 'other', role: { name: 'Admin', is_admin: true, rank: 30 } })).toBe(false);
    });

    it('forbids managing yourself', () => {
        expect(canManageMember(admin, { id: 'admin', role: { name: 'Admin', is_admin: true, rank: 30 } })).toBe(false);
    });

    it('forbids a Manager (view-only) from managing anyone', () => {
        const manager = mkUser(20, 'mgr');
        expect(canManageMember(manager, { id: 'emp', role: { name: 'Employee', is_admin: false, rank: 0 } })).toBe(false);
    });
});
