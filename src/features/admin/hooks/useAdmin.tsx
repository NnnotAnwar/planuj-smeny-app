import { adminService } from "../adminService";
import { useEffect, useState } from "react";
import { useAuthContext } from "@/features/auth/AuthContext";
import type { Organization, Location } from "@/shared/types";
import { locationService } from "@/features/locations/locationService";

export function useAdmin() {
    const { user } = useAuthContext()
    const isSuperAdmin = user?.role.name === 'Superadmin'
    const [organizations, setOrganizations] = useState<Organization[] | null>(null);
    const [locations, setLocations] = useState<Location[] | null>(null)

    useEffect(() => {
        if (!user) return
        const getData = async () => {
            try {
                const orgs = await adminService.getOrganizations(isSuperAdmin)
                const locs = await locationService.getLocations(user.organization_id, isSuperAdmin)
                setOrganizations(orgs)
                setLocations(locs)
            }
            catch (err) {
                console.error(err)
            }
        }
        getData()
    }, [isSuperAdmin])

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
        organizations,
        locations
    }
}