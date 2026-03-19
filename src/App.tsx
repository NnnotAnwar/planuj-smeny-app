import { Route, Routes, Navigate } from 'react-router-dom';

// Providers (Global State)
import { AuthProvider } from './features/auth/AuthContext';
import { ShiftProvider } from './features/shifts/ShiftContext';
import { ThemeProvider } from './app/providers/ThemeContext';

// App Pages & Layout
import { AppShell } from './app/layout/AppShell';
import { HomePage } from './app/layout/HomePage';
import { LoginPage } from './features/auth/LoginPage';
import { OverviewPage } from './features/overview/OverviewPage';

/**
 * --- MAIN APP COMPONENT ---
 * This file handles the top-level structure of the application.
 * 
 * Logic:
 * 1. Wraps everything in the necessary Providers (Auth, Shift, Theme).
 * 2. Defines the main Routes for navigation.
 */

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ShiftProvider>
          <Routes>
            {/* 1. PUBLIC ROUTES: Available to everyone. */}
            <Route path="/login" element={<LoginPage />} />

            {/* 2. PROTECTED ROUTES: Only for logged-in users. */}
            <Route path="/" element={<AppShell />}>
              <Route index element={<HomePage />} />
              <Route path="overview" element={<OverviewPage />} />
            </Route>

            {/* 3. FALLBACK: Redirect any unknown URL to Home. */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </ShiftProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
