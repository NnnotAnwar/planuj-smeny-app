import { useState, type SyntheticEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AtIcon, LockIcon, EyeIcon, EyeSlashIcon, SunIcon, MoonIcon } from '@phosphor-icons/react';
import { useTheme } from '@app/providers/ThemeContext';
import { useTranslation } from '@shared/preferences/PreferencesContext';
import { Button } from '@shared/components/Button';
import { Input } from '@shared/components/Input';
import { FormError } from '@shared/components/FormError';
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
  const t = useTranslation();

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
      setErrorMsg(t('auth.invalidCredentials'));
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
        aria-label={t('common.toggleTheme')}
        className="absolute top-4 right-4 z-10 p-2 rounded-xl bg-white/60 dark:bg-white/5 border border-gray-200/60 dark:border-white/10 text-gray-500 dark:text-gray-300 backdrop-blur-md hover:bg-white/80 dark:hover:bg-white/10 active:scale-90 transition-all"
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
            {isDark ? <SunIcon weight="bold" className="size-4" /> : <MoonIcon weight="bold" className="size-4" />}
          </motion.span>
        </AnimatePresence>
      </button>

      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 26 }}
        className="relative w-full max-w-md"
      >
        <div className="glass rounded-2xl p-6 sm:p-8 [--glass-shadow:var(--shadow-glass-lg)]">
          {/* Brand */}
          <div className="flex flex-col items-center text-center mb-6">
            <div className="relative">
              <div className="absolute inset-0 rounded-2xl bg-emerald-500/40 blur-xl" />
              <div className="relative size-12 bg-linear-to-br from-emerald-400 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/30">
                <span className="font-display text-white font-bold text-lg tracking-wide">PS</span>
              </div>
            </div>
            <h1 className="text-display text-ink dark:text-white mt-4">{t('auth.welcomeBack')}</h1>
            <p className="text-eyebrow text-emerald-600 dark:text-emerald-300 mt-2">{t('auth.portal')}</p>
          </div>

          <form className="space-y-4" onSubmit={handleLogin}>
            {/* Email / Username */}
            <div>
              <label htmlFor="login" className="text-eyebrow text-ink-soft dark:text-slate-400 ml-1">{t('auth.emailOrUsername')}</label>
              <div className="mt-1.5">
                <Input
                  id="login"
                  icon={AtIcon}
                  type="text"
                  required
                  autoComplete="username"
                  autoCapitalize="none"
                  autoCorrect="off"
                  value={loginInput}
                  onChange={(e) => setLoginInput(e.target.value)}
                  placeholder="you@example.com"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="text-eyebrow text-ink-soft dark:text-slate-400 ml-1">{t('auth.password')}</label>
              <div className="mt-1.5">
                <Input
                  id="password"
                  icon={LockIcon}
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  trailing={
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? t('auth.hidePassword') : t('auth.showPassword')}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
                    >
                      {showPassword ? <EyeSlashIcon weight="bold" className="w-4 h-4" /> : <EyeIcon weight="bold" className="w-4 h-4" />}
                    </button>
                  }
                />
              </div>
            </div>

            <FormError message={errorMsg} />

            <Button type="submit" size="lg" fullWidth loading={isLoading}>
              {isLoading ? t('auth.signingIn') : t('auth.signIn')}
            </Button>
          </form>
        </div>

        <p className="text-center text-micro text-gray-400 mt-5">Planuj Směny · 2026</p>
      </motion.div>
    </div>
  );
}
