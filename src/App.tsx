import { lazy, Suspense } from 'react';
import { Route, Routes, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Providers (Global State)
import { AuthProvider } from './features/auth/AuthContext';
import { ShiftProvider } from './features/shifts/ShiftContext';
import { ThemeProvider } from './app/providers/ThemeContext';

// Single shared React Query client (caching, dedupe, retries for server state).
const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false },
  },
});

// App Shell (eager — it is the persistent frame around every page).
import { AppShell } from './app/layout/AppShell';
import { RoleGuard } from './features/auth/RoleGuards';
import { ProtectedRoute, PublicRoute } from './app/router/RouteGuards';
import { ErrorBoundary } from './shared/components/ErrorBoundary';
import { PageLoader } from './shared/components/PageLoader';

/**
 * --- MAIN APP COMPONENT ---
 * This file handles the top-level structure of the application.
 *
 * Logic:
 * 1. Wraps everything in the necessary Providers (Auth, Shift, Theme).
 * 2. Defines the main Routes for navigation.
 * 3. Lazy-loads each page so the initial bundle only ships what the
 *    current route needs (code-splitting).
 */

// Lazy page chunks. Named exports are mapped to a `default` for React.lazy.
const HomePage = lazy(() => import('./app/layout/HomePage').then((m) => ({ default: m.HomePage })));
const LoginPage = lazy(() => import('./features/auth/LoginPage').then((m) => ({ default: m.LoginPage })));
const AcceptInvitePage = lazy(() =>
    import('./features/auth/AcceptInvitePage').then((m) => ({ default: m.AcceptInvitePage })),
);
const OverviewPage = lazy(() => import('./features/shifts/OverviewPage'));
const AdminPage = lazy(() => import('./features/admin/AdminPage').then((m) => ({ default: m.AdminPage })));
const RequestsPage = lazy(() => import('./features/requests/RequestsPage').then((m) => ({ default: m.RequestsPage })));
const TimesheetsPage = lazy(() => import('./features/timesheets/TimesheetsPage').then((m) => ({ default: m.TimesheetsPage })));
const AuditLogPage = lazy(() => import('./features/timesheets/AuditLogPage').then((m) => ({ default: m.AuditLogPage })));
const SettingsPage = lazy(() => import('./features/settings/SettingsPage'));
const ProfilePage = lazy(() => import('./features/profile/ProfilePage'));

export default function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
       <ThemeProvider>
        <AuthProvider>
          <ShiftProvider>
            <Suspense fallback={<PageLoader />}>
              <Routes>
                {/* PUBLIC: invite acceptance manages its own session (no guard). */}
                <Route path="/accept-invite" element={<AcceptInvitePage />} />

                {/* LOGGED-OUT ONLY: redirects to "/" if already authenticated. */}
                <Route element={<PublicRoute />}>
                  <Route path="/login" element={<LoginPage />} />
                </Route>

                {/* PROTECTED: requires a session; redirects to "/login" otherwise. */}
                <Route element={<ProtectedRoute />}>
                  <Route path="/" element={<AppShell />}>
                    <Route index element={<HomePage />} />
                    <Route path="overview" element={<OverviewPage />} />
                    <Route element={<RoleGuard />}>
                      <Route path="admin" element={<AdminPage />} />
                      {/* Requests is admin-only (rank >= 30); the page self-guards too. */}
                      <Route path="requests" element={<RequestsPage />} />
                      {/* Timesheets is for managers+ (rank >= 20). */}
                      <Route path="timesheets" element={<TimesheetsPage />} />
                      {/* Activity Log is admin-only (rank >= 30); the page self-guards too. */}
                      <Route path="activity" element={<AuditLogPage />} />
                    </Route>
                    <Route path="settings" element={<SettingsPage />} />
                    <Route path="profile" element={<ProfilePage />} />
                    <Route path="profile/:userId" element={<ProfilePage />} />
                  </Route>
                </Route>

                {/* FALLBACK: any unknown URL -> Home (then guards take over). */}
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Suspense>
          </ShiftProvider>
        </AuthProvider>
       </ThemeProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
