import { useMemo } from 'react';
import { useAuthContext } from '@features/auth/AuthContext';
import type { Profile } from '@shared/types';
import {
    isSuperAdmin,
    canViewAdminPanel,
    canManageEmployees,
    canManageLocations,
    canManageMember,
} from './permissions';

/**
 * --- usePermissions ---
 * React wrapper over the pure `permissions.ts` checks. It folds in the current
 * auth user (and the `!!user &&` null-guard) so components can read declarative
 * booleans instead of repeating `!!user && canX(user)` everywhere.
 *
 * Pure functions stay the source of truth and are used directly where there's
 * no React context (route guards, tests).
 */
export function usePermissions() {
    const { user } = useAuthContext();
    return useMemo(
        () => ({
            user,
            isSuperAdmin: !!user && isSuperAdmin(user),
            canViewAdminPanel: !!user && canViewAdminPanel(user),
            canManageEmployees: !!user && canManageEmployees(user),
            canManageLocations: !!user && canManageLocations(user),
            canManageMember: (target: Pick<Profile, 'id' | 'role'>) =>
                !!user && canManageMember(user, target),
        }),
        [user],
    );
}
