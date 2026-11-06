import { describe, expect, it } from 'vitest';
import { can, canEditTimesheetOf, outranks, rankOf, roleLabel } from '@shared/auth/permissions';
import type { User } from '@shared/types';
import { emptyGrants, toggleGrant } from './types';

const role = (name: string, rank: number) => ({ name, rank, is_admin: false });
const base = { username: 'x', first_name: null, last_name: null, email: 'x@example.test', organization_id: 'o' };

describe('can() with custom role permissions', () => {
    const shiftLead: User = {
        ...base,
        id: 'lead',
        role: role('Employee', 0),
        org_role: { id: 'r1', name: 'Shift lead', color: '#0ea5e9', base_role: 'Employee', preset_key: null },
        permissions: { rota: { read: true, write: true, delete: false } },
    };

    it('grants exactly what the role allows', () => {
        expect(can(shiftLead, 'rota.view')).toBe(true);
        expect(can(shiftLead, 'rota.edit')).toBe(true);
        expect(can(shiftLead, 'requests.decide')).toBe(false);
        expect(can(shiftLead, 'members.view')).toBe(false);
        expect(can(shiftLead, 'team.view')).toBe(true); // any observer area
        expect(can(shiftLead, 'roles.manage')).toBe(false);
    });

    it('keeps the hierarchy: rights never reach people at or above your level', () => {
        const editor: User = { ...shiftLead, permissions: { timesheets: { read: true, write: true, delete: false } } };
        expect(canEditTimesheetOf(editor, { id: 'a', role: role('Employee', 0) })).toBe(false); // same level
        const mgrEditor: User = { ...editor, role: role('Manager', 20) };
        expect(canEditTimesheetOf(mgrEditor, { id: 'a', role: role('Employee', 0) })).toBe(true);
        expect(canEditTimesheetOf(mgrEditor, { id: 'lead', role: role('Employee', 0) })).toBe(false); // never yourself
    });

    it('Head Admin and Superadmin hold everything', () => {
        const head: User = { ...base, id: 'h', role: role('Head Admin', 40), permissions: {} };
        expect(can(head, 'roles.manage')).toBe(true);
        expect(can(head, 'locations.manage')).toBe(true);
        const sa: User = { ...base, id: 's', role: role('Superadmin', 100) };
        expect(can(sa, 'activity.view')).toBe(true);
    });

    it('falls back to the preset thresholds before permissions are known', () => {
        const mgr: User = { ...base, id: 'm', role: role('Manager', 20) };
        expect(can(mgr, 'rota.view')).toBe(true);
        expect(can(mgr, 'rota.edit')).toBe(false);
    });

    it('shows the organization role name', () => {
        expect(roleLabel(shiftLead)).toBe('Shift lead');
        expect(roleLabel({ role: role('Admin', 30), org_role: null })).toBe('Admin');
    });
});

describe('permission matrix toggles', () => {
    it('change turns view on; dropping view drops change and delete', () => {
        let g = toggleGrant(emptyGrants(), 'rota', 'write');
        expect(g.rota).toEqual({ read: true, write: true, delete: false });
        g = toggleGrant(g, 'rota', 'delete');
        expect(g.rota).toEqual({ read: true, write: true, delete: true });
        g = toggleGrant(g, 'rota', 'read');
        expect(g.rota).toEqual({ read: false, write: false, delete: false });
    });

    it('dropping change drops delete but keeps view', () => {
        let g = toggleGrant(emptyGrants(), 'wages', 'delete');
        g = toggleGrant(g, 'wages', 'write');
        expect(g.wages).toEqual({ read: true, write: false, delete: false });
    });
});

describe('hierarchy by role position', () => {
    const at = (id: string, sort: number) => ({
        id,
        role: role('Employee', 0),
        org_role: { id: `r${sort}`, name: `R${sort}`, color: '#000000', base_role: 'Employee', preset_key: null, sort },
    });

    it('ranks by the role position, not the legacy level', () => {
        expect(rankOf(at('a', 25))).toBe(25);
        expect(rankOf({ role: role('Superadmin', 100), org_role: null })).toBe(100);
    });

    it('a higher role outranks a lower one; equal positions do not', () => {
        expect(outranks(at('a', 25), at('b', 12))).toBe(true);
        expect(outranks(at('a', 12), at('b', 25))).toBe(false);
        expect(outranks(at('a', 12), at('b', 12))).toBe(false);
    });
});
