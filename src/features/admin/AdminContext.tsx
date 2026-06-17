import {
    createContext,
    useContext,
    useState,
    useEffect,
    useCallback,
    type ReactNode,
} from 'react';
import { adminService, type EmployeeUpdate } from './adminService';
import { useAuthContext } from '@/features/auth/AuthContext';
import type { Organization, Role } from '@/shared/types';

/**
 * --- ADMIN CONTEXT ---
 * Holds the full organization tree + roles for the Admin Panel and exposes
 * every CRUD action. Mutations run against Supabase and then re-fetch the tree
 * so the UI always reflects the database (no drifting optimistic state).
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
    updateEmployee: (id: string, values: EmployeeUpdate) => Promise<void>;
    deleteEmployee: (id: string) => Promise<void>;
}

const AdminContext = createContext<AdminContextType | undefined>(undefined);

export function AdminProvider({ children }: { children: ReactNode }) {
    const { user } = useAuthContext();
    const isSuperAdmin = user?.role.name === 'Superadmin';

    const [adminData, setAdminData] = useState<Organization[] | null>(null);
    const [roles, setRoles] = useState<Role[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const refreshData = useCallback(async () => {
        if (!user) return;
        try {
            setError(null);
            const data = await adminService.getAdminData(isSuperAdmin, user);
            setAdminData(data);
        } catch (err) {
            console.error('Failed to load admin data:', err);
            setError(err instanceof Error ? err.message : 'Failed to load admin data.');
        } finally {
            setIsLoading(false);
        }
    }, [isSuperAdmin, user]);

    useEffect(() => {
        if (!user) return;
        refreshData();
        adminService.getRoles().then(setRoles).catch((err) => console.error('Failed to load roles:', err));
    }, [user, refreshData]);

    // Organizations -------------------------------------------------
    const createOrganization = useCallback(
        async (name: string, slug: string) => {
            if (!isSuperAdmin) throw new Error('Only a Superadmin can manage organizations.');
            await adminService.createOrganization(name, slug);
            await refreshData();
        },
        [isSuperAdmin, refreshData],
    );

    const updateOrganization = useCallback(
        async (id: string, values: { name: string; slug: string }) => {
            if (!isSuperAdmin) throw new Error('Only a Superadmin can manage organizations.');
            await adminService.updateOrganization(id, values);
            await refreshData();
        },
        [isSuperAdmin, refreshData],
    );

    const deleteOrganization = useCallback(
        async (id: string) => {
            if (!isSuperAdmin) throw new Error('Only a Superadmin can manage organizations.');
            await adminService.deleteOrganization(id);
            await refreshData();
        },
        [isSuperAdmin, refreshData],
    );

    // Locations -----------------------------------------------------
    const createLocation = useCallback(
        async (values: { organization_id: string; name: string }) => {
            await adminService.createLocation(values);
            await refreshData();
        },
        [refreshData],
    );

    const updateLocation = useCallback(
        async (id: string, name: string) => {
            await adminService.updateLocation(id, name);
            await refreshData();
        },
        [refreshData],
    );

    const deleteLocation = useCallback(
        async (id: string) => {
            await adminService.deleteLocation(id);
            await refreshData();
        },
        [refreshData],
    );

    // Employees -----------------------------------------------------
    const updateEmployee = useCallback(
        async (id: string, values: EmployeeUpdate) => {
            await adminService.updateEmployee(id, values);
            await refreshData();
        },
        [refreshData],
    );

    const deleteEmployee = useCallback(
        async (id: string) => {
            if (id === user?.id) throw new Error('You cannot delete your own account.');
            await adminService.deleteEmployee(id);
            await refreshData();
        },
        [user?.id, refreshData],
    );

    const value: AdminContextType = {
        adminData,
        roles,
        isLoading,
        error,
        isSuperAdmin,
        refreshData,
        createOrganization,
        updateOrganization,
        deleteOrganization,
        createLocation,
        updateLocation,
        deleteLocation,
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
