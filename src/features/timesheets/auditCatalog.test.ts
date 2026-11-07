import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { en, cs } from '@shared/i18n/translations';
import { AUDIT_GROUPS, AUDIT_GROUP_KEYS, dedupeFanout, groupLabel } from './auditCatalog';

const page = readFileSync(resolve(__dirname, 'AuditLogPage.tsx'), 'utf8');

describe('activity log catalog', () => {
    const all = AUDIT_GROUP_KEYS.flatMap((g) => [...AUDIT_GROUPS[g]]);

    it('lists each action once', () => {
        expect(new Set(all).size).toBe(all.length);
    });

    it('every action has a label + icon on the page', () => {
        for (const a of all) expect(page, a).toMatch(new RegExp(`^\\s+${a}: \\{ labelKey: '([^']+)'`, 'm'));
    });

    it('every label and group name is translated in both languages', () => {
        const keys = [...page.matchAll(/labelKey: '([^']+)'/g)].map((m) => m[1]);
        for (const k of [...keys, ...AUDIT_GROUP_KEYS.map(groupLabel)]) {
            expect(en, k).toHaveProperty([k]);
            expect(cs, k).toHaveProperty([k]);
        }
    });

    it('shows a fanned-out event once', () => {
        const row = (action: string, id: string) => ({ id, action, created_at: '2026-11-06T10:00:00Z', actor_id: 'u1' });
        const out = dedupeFanout([row('timeoff_requested', 'a'), row('timeoff_requested', 'b'), row('schedule_published', 'c'), row('schedule_published', 'd')]);
        expect(out.map((r) => r.id)).toEqual(['a', 'c', 'd']);
    });
});
