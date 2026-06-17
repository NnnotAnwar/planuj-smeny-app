import { createContext, useContext, useCallback, type ReactNode } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminService, type EmployeeUpdate, type EmployeeInvite } from './adminService';
import { useAuthContext } from '@/features/auth/AuthContext';
import type { Organization, Role } from '@/shared/types';

/**
 * --- ADMIN CONTEXT ---
 * Backed by React Query: the org tree + roles are cached server state (useQuery),
 * and every mutation invalidates the tree so the UI re-syncs. This removes the
 * hand-rolled "fetch-all + manual refreshData + isLoading/error" plumbing the
 * context used to carry, and gives caching, dedupe and retries for free.
 *
 * The public API is unchanged, so the panel/forms below don't need to change.
 */

interface AdminContextType {
    adminData: Organization[] | null;
    roles: Role[];
    isLoading: boolean;
    error: string | null;
    isSuperAdmin: boolean;
    refreshData: () => Promise<void>;

    // Organizations (Superadmin only)
    createOrganization: (name: string, slug: string) => Promise<void>;
    updateOrganization: (id: string, values: { name: string; slug: string }) => Promise<void>;
    deleteOrganization: (id: string) => Promise<void>;

    // Locations
    createLocation: (values: { organization_id: string; name: string }) => Promise<void>;
    updateLocation: (id: string, name: string) => Promise<void>;
    deleteLocation: (id: string) => Promise<void>;

    // Employees
    inviteEmployee: (payload: EmployeeInvite) => Promise<void>;
    updateEmployee: (id: string, values: EmployeeUpdate) => Promise<void>;
    deleteEmployee: (id: string) => Promise<void>;
}

const AdminContext = createContext<AdminContextType | undefined>(undefined);

const TREE_KEY = ['admin', 'tree'] as const;
const ROLES_KEY = ['admin', 'roles'] as const;

export function AdminProvider({ children }: { children: ReactNode }) {
    const { user } = useAuthContext();
    const isSuperAdmin = user?.role.name === 'Superadmin';
    const queryClient = useQueryClient();

    const treeQuery = useQuery({
        queryKey: [...TREE_KEY, user?.id],
        queryFn: () => adminService.getAdminData(isSuperAdmin, user!),
        enabled: !!user,
    });

    const rolesQuery = useQuery({
        queryKey: ROLES_KEY,
        queryFn: () => adminService.getRoles(),
        enabled: !!user,
        staleTime: 5 * 60 * 1000, // roles rarely change
    });

    const invalidateTree = useCallback(
        () => queryClient.invalidateQueries({ queryKey: TREE_KEY }),
        [queryClient],
    );

    // A mutation that runs a service call then re-syncs the tree. We keep the
    // imperative async signatures the existing forms already call/await.
    const mutation = useMutation({
        mutationFn: (action: () => Promise<void>) => action(),
        onSuccess: invalidateTree,
    });
    const run = useCallback((action: () => Promise<void>) => mutation.mutateAsync(action), [mutation]);

    // Organizations -------------------------------------------------
    const createOrganization = useCallback(
        (name: string, slug: string) =>
            run(async () => {
                if (!isSuperAdmin) throw new Error('Only a Superadmin can manage organizations.');
                await adminService.createOrganization(name, slug);
            }),
        [isSuperAdmin, run],
    );

    const updateOrganization = useCallback(
        (id: string, values: { name: string; slug: string }) =>
            run(async () => {
                if (!isSuperAdmin) throw new Error('Only a Superadmin can manage organizations.');
                await adminService.updateOrganization(id, values);
            }),
        [isSuperAdmin, run],
    );

    const deleteOrganization = useCallback(
        (id: string) =>
            run(async () => {
                if (!isSuperAdmin) throw new Error('Only a Superadmin can manage organizations.');
                await adminService.deleteOrganization(id);
            }),
        [isSuperAdmin, run],
    );

    // Locations -----------------------------------------------------
    const createLocation = useCallback(
        (values: { organization_id: string; name: string }) =>
            run(() => adminService.createLocation(values)),
        [run],
    );
    const updateLocation = useCallback(
        (id: string, name: string) => run(() => adminService.updateLocation(id, name)),
        [run],
    );
    const deleteLocation = useCallback(
        (id: string) => run(() => adminService.deleteLocation(id)),
        [run],
    );

    // Employees -----------------------------------------------------
    const inviteEmployee = useCallback(
        (payload: EmployeeInvite) => run(() => adminService.inviteEmployee(payload)),
        [run],
    );
    const updateEmployee = useCallback(
        (id: string, values: EmployeeUpdate) => run(() => adminService.updateEmployee(id, values)),
        [run],
    );
    const deleteEmployee = useCallback(
        (id: string) =>
            run(async () => {
                if (id === user?.id) throw new Error('You cannot delete your own account.');
                await adminService.deleteEmployee(id);
            }),
        [user?.id, run],
    );

    const value: AdminContextType = {
        adminData: treeQuery.data ?? null,
        roles: rolesQuery.data ?? [],
        isLoading: treeQuery.isLoading,
        error: treeQuery.error
            ? treeQuery.error instanceof Error
                ? treeQuery.error.message
                : 'Failed to load admin data.'
            : null,
        isSuperAdmin,
        refreshData: async () => {
            await invalidateTree();
        },
        createOrganization,
        updateOrganization,
        deleteOrganization,
        createLocation,
        updateLocation,
        deleteLocation,
        inviteEmployee,
        updateEmployee,
        deleteEmployee,
    };

    return <AdminContext.Provider value={value}>{children}</AdminContext.Provider>;
}

/**
 * CUSTOM HOOK: useAdminContext
 * Gives any component inside <AdminProvider> access to admin data + actions.
 */
export function useAdminContext() {
    const context = useContext(AdminContext);
    if (context === undefined) {
        throw new Error('useAdminContext must be used within an AdminProvider');
    }
    return context;
}
