import { lazy, Suspense } from 'react';
import { Route, Routes, Navigate } from 'react-router-dom';

// Providers (Global State)
import { AuthProvider } from './features/auth/AuthContext';
import { ShiftProvider } from './features/shifts/ShiftContext';
import { ThemeProvider } from './app/providers/ThemeContext';

// App Shell (eager — it is the persistent frame around every page).
import { AppShell } from './app/layout/AppShell';
import { RoleGuard } from './features/auth/RoleGuards';
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
const OverviewPage = lazy(() => import('./features/overview/OverviewPage').then((m) => ({ default: m.OverviewPage })));
const AdminPage = lazy(() => import('./features/admin/AdminPage').then((m) => ({ default: m.AdminPage })));
const MyShiftsPage = lazy(() => import('./features/shifts/MyShiftsPage'));
const SettingsPage = lazy(() => import('./features/settings/SettingsPage'));

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ShiftProvider>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              {/* 1. PUBLIC ROUTES: Available to everyone. */}
              <Route path="/login" element={<LoginPage />} />

              {/* 2. PROTECTED ROUTES: Only for logged-in users. */}
              <Route path="/" element={<AppShell />}>
                <Route index element={<HomePage />} />
                <Route path="overview" element={<OverviewPage />} />
                <Route path="my-shifts" element={<MyShiftsPage />} />
                <Route element={<RoleGuard />}>
                  <Route path="admin" element={<AdminPage />} />
                </Route>
                <Route path="settings" element={<SettingsPage />} />
              </Route>

              {/* 3. FALLBACK: Redirect any unknown URL to Home. */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </ShiftProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
