import { useState, type SubmitEventHandler } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

type LocationState = {
  from?: { pathname?: string };
};

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as LocationState | null;

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit: SubmitEventHandler<HTMLFormElement> = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const success = await login(username, password);
    setLoading(false);

    if (!success) {
      setError('Invalid username or password.');
      return;
    }

    const redirectTo = state?.from?.pathname || '/';
    navigate(redirectTo, { replace: true });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md bg-white rounded-xl shadow-lg p-8 space-y-6">
        <div className="text-center space-y-2">
          <div className="mx-auto w-12 h-12 rounded-xl bg-emerald-500 flex items-center justify-center text-white font-bold text-xl">
            PS
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Planuj Směny</h1>
          <p className="text-gray-500 text-sm">Sign in to plan and track shifts.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-700">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              autoComplete="username"
              required
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-700">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              autoComplete="current-password"
              required
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full inline-flex justify-center items-center rounded-md bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <div className="text-xs text-gray-400 space-y-1">
          <p>Demo accounts:</p>
          <p>
            <span className="font-semibold text-gray-600">Admin</span> — user: admin / pass:
            admin
          </p>
          <p>
            <span className="font-semibold text-gray-600">Supervisor</span> — user: supervisor /
            pass: super
          </p>
        </div>
      </div>
    </div>
  );
}

