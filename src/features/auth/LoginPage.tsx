import { useState, type SyntheticEvent } from 'react';
import { Link } from 'react-router-dom';
import { AtIcon, LockIcon, EyeIcon, EyeSlashIcon } from '@phosphor-icons/react';
import { useTranslation } from '@shared/preferences/PreferencesContext';
import { Button } from '@shared/components/Button';
import { Input } from '@shared/components/Input';
import { FormError } from '@shared/components/FormError';
import { authService } from './authService';
import { AuthShell } from './AuthShell';

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
    <AuthShell
      title={t('auth.welcomeBack')}
      eyebrow={t('auth.portal')}
      below={
        <p className="mt-4 text-center text-meta text-ink-soft dark:text-slate-400">
          {t('signup.prompt')}{' '}
          <Link to="/signup" className="font-semibold text-emerald-700 hover:underline dark:text-emerald-300">
            {t('signup.cta')}
          </Link>
        </p>
      }
    >
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
    </AuthShell>
  );
}
