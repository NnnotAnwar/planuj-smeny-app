import { useState, type SyntheticEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AtIcon, LockIcon, EyeIcon, EyeSlashIcon, SunIcon, MoonIcon, WarningCircleIcon } from '@phosphor-icons/react';
import { useTheme } from '@app/providers/ThemeContext';
import { authService } from './authService';

/**
 * --- LOGIN PAGE ---
 * Pure sign-in form. Redirecting an already-authenticated user away, and
 * redirecting in after a successful login, are both handled declaratively by
 * <PublicRoute> — this component no longer navigates itself.
 */

export function LoginPage() {
  const [loginInput, setLoginInput] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

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
    <div className="relative min-h-dvh flex items-center justify-center overflow-hidden px-4 py-10">
      {/* Ambient brand glow */}
      <div className="pointer-events-none absolute -top-24 -left-24 w-80 h-80 rounded-full bg-emerald-500/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -right-20 w-96 h-96 rounded-full bg-emerald-400/10 blur-3xl" />

      {/* Theme toggle */}
      <button
        onClick={() => setTheme(isDark ? 'light' : 'dark')}
        aria-label="Toggle theme"
        className="absolute top-4 right-4 z-10 p-2.5 rounded-xl bg-white/60 dark:bg-white/5 border border-gray-200/60 dark:border-white/10 text-gray-500 dark:text-gray-300 backdrop-blur-md hover:bg-white/80 dark:hover:bg-white/10 active:scale-90 transition-all"
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={resolvedTheme}
            initial={{ y: -6, opacity: 0, rotate: -30 }}
            animate={{ y: 0, opacity: 1, rotate: 0 }}
            exit={{ y: 6, opacity: 0, rotate: 30 }}
            transition={{ duration: 0.2 }}
            className="block"
          >
            {isDark ? <SunIcon weight="bold" className="w-5 h-5" /> : <MoonIcon weight="bold" className="w-5 h-5" />}
          </motion.span>
        </AnimatePresence>
      </button>

      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 26 }}
        className="relative w-full max-w-md"
      >
        <div className="bg-white/70 dark:bg-gray-900/60 backdrop-blur-xl border border-white/60 dark:border-white/10 rounded-3xl shadow-2xl shadow-emerald-500/5 p-7 sm:p-9">
          {/* Brand */}
          <div className="flex flex-col items-center text-center mb-8">
            <div className="relative">
              <div className="absolute inset-0 rounded-2xl bg-emerald-500/40 blur-xl" />
              <div className="relative w-16 h-16 bg-linear-to-br from-emerald-400 to-emerald-600 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-500/30">
                <span className="text-white font-black text-2xl tracking-wider">PS</span>
              </div>
            </div>
            <h1 className="text-display text-gray-900 dark:text-white mt-5">Welcome back</h1>
            <p className="text-label text-emerald-600 dark:text-emerald-400 mt-1.5">Planuj Směny · Employee Portal</p>
          </div>

          <form className="space-y-4" onSubmit={handleLogin}>
            {/* Email / Username */}
            <div>
              <label htmlFor="login" className="text-micro text-gray-400 ml-1">Email or username</label>
              <div className="relative mt-1.5">
                <AtIcon weight="bold" className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  id="login"
                  type="text"
                  required
                  autoComplete="username"
                  autoCapitalize="none"
                  autoCorrect="off"
                  value={loginInput}
                  onChange={(e) => setLoginInput(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full bg-gray-50/80 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 rounded-xl pl-10 pr-3 py-3 text-body text-gray-900 dark:text-white outline-none transition-all placeholder:text-gray-400"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="text-micro text-gray-400 ml-1">Password</label>
              <div className="relative mt-1.5">
                <LockIcon weight="bold" className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-gray-50/80 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 rounded-xl pl-10 pr-11 py-3 text-body text-gray-900 dark:text-white outline-none transition-all placeholder:text-gray-400"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
                >
                  {showPassword ? <EyeSlashIcon weight="bold" className="w-4 h-4" /> : <EyeIcon weight="bold" className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <AnimatePresence>
              {errorMsg && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="flex items-center gap-2 text-small-strong text-red-500 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 rounded-xl px-3 py-2.5"
                >
                  <WarningCircleIcon weight="fill" className="w-4 h-4 shrink-0" />
                  <span>{errorMsg}</span>
                </motion.div>
              )}
            </AnimatePresence>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-body-strong text-white bg-linear-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 shadow-lg shadow-emerald-500/25 active:scale-[0.98] disabled:opacity-70 disabled:active:scale-100 transition-all"
            >
              {isLoading && (
                <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              )}
              {isLoading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>

        <p className="text-center text-micro text-gray-400 mt-5">Planuj Směny · 2026</p>
      </motion.div>
    </div>
  );
}
