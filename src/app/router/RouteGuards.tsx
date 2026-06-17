import { Navigate, Outlet } from 'react-router-dom';
import { useAuthContext } from '@features/auth/AuthContext';
import { PageLoader } from '@shared/components/PageLoader';

/**
 * --- ROUTE GUARDS ---
 * Declarative auth gating. These render-time guards replace the imperative
 * navigate() calls that used to live in AuthContext / LoginPage, so there is one
 * predictable place that decides where an un/authenticated user may go (no races,
 * no content flashing before a redirect).
 *
 * Note: /accept-invite is intentionally NOT wrapped by either guard — it manages
 * its own session (verifyOtp) and must stay reachable while logged out.
 */

/** Pages that require a session (the whole app shell). */
export function ProtectedRoute() {
  const { user, isAuthChecking } = useAuthContext();
  if (isAuthChecking) return <PageLoader />;
  if (!user) return <Navigate to="/login" replace />;
  return <Outlet />;
}

/** Pages only for logged-OUT users (the login screen). */
export function PublicRoute() {
  const { user, isAuthChecking } = useAuthContext();
  if (isAuthChecking) return <PageLoader />;
  if (user) return <Navigate to="/" replace />;
  return <Outlet />;
}
