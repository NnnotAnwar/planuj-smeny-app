import { useState, type SyntheticEvent } from "react";
import { authService } from './authService'

/**
 * --- LOGIN PAGE ---
 * Pure sign-in form. Redirecting an already-authenticated user away, and
 * redirecting in after a successful login, are both handled declaratively by
 * <PublicRoute> — this component no longer navigates itself.
 */

export function LoginPage() {
  const [loginInput, setLoginInput] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: SyntheticEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg('');

    try {
      const input = loginInput.trim();

      if (input.includes('@')) {
        // Email + password — Supabase already returns a generic error on failure.
        const { error } = await authService.signIn(input, password);
        if (error) throw error;
      } else {
        // Username — resolved + verified server-side (no email/username leak).
        await authService.signInWithUsername(input, password);
      }

      // Success: keep the spinner up; PublicRoute redirects to "/" once the
      // session resolves and AuthContext loads the profile.
    } catch (error) {
      // Single generic message — never reveal whether the account exists.
      console.error(error);
      setErrorMsg('Invalid email/username or password.');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-dvh flex items-center justify-center bg-gray-50 dark:bg-gray-950 px-4">
      <div className="max-w-md w-full space-y-8 bg-white dark:bg-gray-900 p-8 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-800">

        <div className="text-center">
          <div className="w-16 h-16 bg-linear-to-br from-emerald-400 to-emerald-600 rounded-2xl mx-auto flex items-center justify-center shadow-md">
            <span className="text-white font-black text-2xl tracking-wider">PS</span>
          </div>
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900 dark:text-gray-50">
            Log in to your account
          </h2>
          <p className="mt-2 text-body text-gray-600 dark:text-gray-400">
            Planuj Směny Employee Portal
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleLogin}>
          <div className="space-y-4">
            <div>
              <label className="block text-body text-gray-700 dark:text-gray-300">Email or Username</label>
              <input
                type="text"
                required
                value={loginInput}
                onChange={(e) => setLoginInput(e.target.value)}
                autoCapitalize="none"
                autoCorrect="off"
                className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg shadow-sm focus:outline-none focus:ring-emerald-500 focus:border-emerald-500 dark:bg-gray-800 dark:text-gray-100 text-body"
                placeholder="Username"
              />
            </div>
            <div>
              <label className="block text-body text-gray-700 dark:text-gray-300">Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg shadow-sm focus:outline-none focus:ring-emerald-500 focus:border-emerald-500 dark:bg-gray-800 dark:text-gray-100 text-body"
                placeholder="••••••••"
              />
            </div>
          </div>

          {errorMsg && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/30 text-red-600 dark:text-red-400 rounded-lg text-body text-center">
              {errorMsg}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-body-strong text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 disabled:opacity-70 disabled:cursor-not-allowed transition-all"
          >
            {isLoading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
