import { Navigate, Outlet } from 'react-router-dom';
import { useAuthContext } from './AuthContext';
import { canViewAdminPanel } from '@shared/auth/permissions';

export function RoleGuard() {
    const { user, isLoading, isAuthChecking } = useAuthContext();

    // 1. Wait until we actually know who the user is
    if (isLoading || isAuthChecking) {
        return <div className="flex min-h-dvh items-center justify-center">Loading...</div>;
    }

    // 2. Gate on the role hierarchy (Manager+). is_admin is legacy and was
    //    inconsistent with the rank-based model used everywhere else.
    if (!user || !canViewAdminPanel(user)) {
        return <Navigate to="/" replace />;
    }

    // 3. If they pass the check, render the child routes!
    return <Outlet />;
}