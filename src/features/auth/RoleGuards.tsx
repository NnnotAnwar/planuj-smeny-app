import { Navigate, Outlet } from 'react-router-dom';
import { useAuthContext } from './AuthContext';


export function RoleGuard() {
    const { user, isLoading, isAuthChecking } = useAuthContext();

    // 1. Wait until we actually know who the user is
    if (isLoading || isAuthChecking) {
        return <div className="flex h-screen items-center justify-center">Loading...</div>;
    }

    // 2. If no user is logged in, or their role is NOT in the allowed list, kick them out
    if (!user || !user.role.is_admin) {
        return <Navigate to="/" replace />;
    }

    // 3. If they pass the check, render the child routes!
    return <Outlet />;
}