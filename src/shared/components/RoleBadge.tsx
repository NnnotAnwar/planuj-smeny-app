import type { Profile } from '@shared/types';
import { getRoleBadgeColor } from '@shared/utils/roleColors';
import { roleLabel } from '@shared/auth/permissions';

/**
 * --- ROLE BADGE ---
 * A member's role as people see it: their organization role (custom roles get
 * their own colour; presets keep the familiar per-level palette).
 */
export function RoleBadge({ profile, className = '' }: { profile: Pick<Profile, 'role' | 'org_role'>; className?: string }) {
    const custom = profile.org_role && !profile.org_role.preset_key ? profile.org_role : null;
    const base = `inline-block px-1.5 py-1 text-micro tracking-tight rounded-md whitespace-nowrap ${className}`;
    if (custom) {
        return (
            <span className={base} style={{ backgroundColor: `${custom.color}24`, color: custom.color }}>
                {custom.name}
            </span>
        );
    }
    return <span className={`${base} ${getRoleBadgeColor(profile.role.name)}`}>{roleLabel(profile)}</span>;
}
