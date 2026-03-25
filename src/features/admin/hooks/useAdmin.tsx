import { adminService } from "../adminService";
import { useEffect, useState } from "react";
import { useAuthContext } from "@/features/auth/AuthContext";
import type { Organization } from "@/shared/types";

export function useAdmin() {
    const { user } = useAuthContext()
    const isSuperAdmin = user?.role.name === 'Superadmin'
    const [adminData, setAdminData] = useState<Organization[] | null>(null);

    useEffect(() => {
        if (!user) return
        const getData = async () => {
            try {
                const data = await adminService.getAdminData(isSuperAdmin, user)
                setAdminData(data)
            }
            catch (err) {
                console.error(err)
            }
        }
        getData()
    }, [isSuperAdmin, user])

    const handleCreateOrg = async (orgName: string, slug: string) => {
        if (user?.role.name !== "Superadmin") return
        try {
            adminService.createOrganization(orgName, slug)
        }
        catch (err) {
            console.error('Error with creating organization:', err)
        }
    }



    return {
        handleCreateOrg,
        adminData,
    }
}