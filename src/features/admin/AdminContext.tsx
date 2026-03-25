import { createContext, useContext } from 'react';

interface AdminContextType {
    handleCreateOrg: (orgName: string, slug: string) => Promise<void>
    getOrganization: () => Promise<void>
}

const AdminContext = createContext<AdminContextType | undefined>(undefined)


export function useAdminContext() {
    const context = useContext(AdminContext)
    if (context === undefined) {
        throw new Error('useAdminContext must be used within a AdminProvider');
    }
    return context;
}