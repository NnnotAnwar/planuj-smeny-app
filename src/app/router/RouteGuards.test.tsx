import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { ProtectedRoute, PublicRoute } from './RouteGuards';
import { useAuthContext } from '@features/auth/AuthContext';

vi.mock('@features/auth/AuthContext', () => ({ useAuthContext: vi.fn() }));
const mockAuth = vi.mocked(useAuthContext);

type AuthState = { user: unknown; isAuthChecking: boolean };
function setAuth(state: AuthState) {
    mockAuth.mockReturnValue({ ...state, isLoading: false, logout: vi.fn(), refreshUser: vi.fn() } as never);
}

function renderProtected() {
    return render(
        <MemoryRouter initialEntries={['/private']}>
            <Routes>
                <Route element={<ProtectedRoute />}>
                    <Route path="/private" element={<div>PRIVATE</div>} />
                </Route>
                <Route path="/login" element={<div>LOGIN</div>} />
            </Routes>
        </MemoryRouter>,
    );
}

function renderPublic() {
    return render(
        <MemoryRouter initialEntries={['/login']}>
            <Routes>
                <Route element={<PublicRoute />}>
                    <Route path="/login" element={<div>LOGIN</div>} />
                </Route>
                <Route path="/" element={<div>HOME</div>} />
            </Routes>
        </MemoryRouter>,
    );
}

beforeEach(() => mockAuth.mockReset());

describe('ProtectedRoute', () => {
    it('renders the page when authenticated', () => {
        setAuth({ user: { id: 'u1' }, isAuthChecking: false });
        renderProtected();
        expect(screen.getByText('PRIVATE')).toBeInTheDocument();
    });

    it('redirects to /login when not authenticated', () => {
        setAuth({ user: null, isAuthChecking: false });
        renderProtected();
        expect(screen.getByText('LOGIN')).toBeInTheDocument();
        expect(screen.queryByText('PRIVATE')).not.toBeInTheDocument();
    });

    it('shows neither while the session is still being checked', () => {
        setAuth({ user: null, isAuthChecking: true });
        renderProtected();
        expect(screen.queryByText('PRIVATE')).not.toBeInTheDocument();
        expect(screen.queryByText('LOGIN')).not.toBeInTheDocument();
    });
});

describe('PublicRoute', () => {
    it('shows the login page when logged out', () => {
        setAuth({ user: null, isAuthChecking: false });
        renderPublic();
        expect(screen.getByText('LOGIN')).toBeInTheDocument();
    });

    it('redirects to home when already authenticated', () => {
        setAuth({ user: { id: 'u1' }, isAuthChecking: false });
        renderPublic();
        expect(screen.getByText('HOME')).toBeInTheDocument();
        expect(screen.queryByText('LOGIN')).not.toBeInTheDocument();
    });
});
