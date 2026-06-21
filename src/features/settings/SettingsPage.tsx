import { useState, type SyntheticEvent } from 'react';
import {
  AtIcon,
  PaletteIcon,
  EnvelopeSimpleIcon,
  IdentificationBadgeIcon,
  CheckCircleIcon,
  SignOutIcon,
} from '@phosphor-icons/react';
import { useAuthContext } from '@features/auth/AuthContext';
import { authService } from '@features/auth/authService';
import { useTheme } from '@app/providers/ThemeContext';
import { getRoleBadgeColor } from '@shared/utils/roleColors';

/**
 * --- SETTINGS PAGE ---
 * Lets the signed-in user edit their own profile. The username is the login
 * identifier (you can sign in with it instead of your email), so it must stay
 * unique — the DB unique_username constraint is the source of truth.
 */

const USERNAME_RE = /^[a-z0-9._-]{3,30}$/;

export default function SettingsPage() {
  const { user, refreshUser, logout } = useAuthContext();
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  const [username, setUsername] = useState(user?.username ?? '');
  const [firstName, setFirstName] = useState(user?.first_name ?? '');
  const [lastName, setLastName] = useState(user?.last_name ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  if (!user) return null;

  const normalizedUsername = username.trim().toLowerCase();
  const dirty =
    normalizedUsername !== (user.username ?? '') ||
    firstName.trim() !== (user.first_name ?? '') ||
    lastName.trim() !== (user.last_name ?? '');

  const handleSubmit = async (e: SyntheticEvent) => {
    e.preventDefault();
    setError(null);
    setSaved(false);

    if (!USERNAME_RE.test(normalizedUsername)) {
      setError('Username must be 3–30 characters: lowercase letters, numbers, dot, underscore or hyphen.');
      return;
    }

    setBusy(true);
    const { error: updateError } = await authService.updateProfile(user.id, {
      username: normalizedUsername,
      first_name: firstName.trim() || null,
      last_name: lastName.trim() || null,
    });

    if (updateError) {
      setError(
        updateError.code === '23505'
          ? 'That username is already taken. Please choose another.'
          : updateError.message || 'Could not save your changes.',
      );
      setBusy(false);
      return;
    }

    await refreshUser();
    setUsername(normalizedUsername);
    setBusy(false);
    setSaved(true);
  };

  const fieldClass =
    'w-full bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 focus:border-emerald-500 rounded-xl px-3 py-2.5 text-body outline-none text-gray-900 dark:text-white transition-colors';

  return (
    <div className="space-y-6 px-1 max-w-2xl">
      <header className="space-y-0.5">
        <p className="text-label text-emerald-500">Preferences</p>
        <h1 className="text-display text-gray-900 dark:text-white">Settings</h1>
      </header>

      {/* USER PREVIEW */}
      <div className="p-4 bg-white dark:bg-gray-800/40 border border-gray-100 dark:border-gray-800 rounded-3xl shadow-sm flex items-center gap-4">
        <div className="w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-900/40 border-2 border-white dark:border-white/10 flex items-center justify-center text-emerald-700 dark:text-emerald-400 text-lg font-black shrink-0">
          {(user.first_name?.[0] || user.username?.[0] || '?').toUpperCase()}
        </div>
        <div className="min-w-0">
          <h2 className="text-title text-gray-900 dark:text-white truncate">
            {user.first_name || user.last_name ? `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim() : user.username}
          </h2>
          <div className="flex items-center gap-2 mt-1">
            <span
              className={`inline-block px-2 py-0.5 text-micro rounded-md ${getRoleBadgeColor(
                user.role.name,
              )}`}
            >
              {user.role.name}
            </span>
            <span className="text-caption text-gray-400">@{user.username}</span>
          </div>
        </div>
      </div>

      {/* PROFILE FORM */}
      <form onSubmit={handleSubmit} className="space-y-2">
        <h3 className="px-1 text-label text-gray-400">Profile</h3>
        <div className="bg-white dark:bg-gray-800/40 border border-gray-100 dark:border-gray-800 rounded-3xl shadow-sm p-5 space-y-4">
          <div>
            <label className="flex items-center gap-1.5 text-small-strong text-gray-600 dark:text-gray-300 mb-1.5">
              <AtIcon weight="bold" className="w-3.5 h-3.5 text-emerald-500" />
              Username
            </label>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              className={fieldClass}
            />
            <p className="text-caption text-gray-400 mt-1.5">Used to sign in instead of your email. Must be unique.</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-small-strong text-gray-600 dark:text-gray-300 mb-1.5 block">First name</label>
              <input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="First name" className={fieldClass} />
            </div>
            <div>
              <label className="text-small-strong text-gray-600 dark:text-gray-300 mb-1.5 block">Last name</label>
              <input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Last name" className={fieldClass} />
            </div>
          </div>

          {error && (
            <p className="text-small-strong text-red-500 bg-red-50 dark:bg-red-900/20 rounded-xl px-3 py-2">{error}</p>
          )}
          {saved && !error && (
            <p className="flex items-center gap-1.5 text-small-strong text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl px-3 py-2">
              <CheckCircleIcon weight="fill" className="w-4 h-4" /> Changes saved.
            </p>
          )}

          <button
            type="submit"
            disabled={busy || !dirty}
            className="w-full px-4 py-3 rounded-xl text-body-strong text-white bg-emerald-500 hover:bg-emerald-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-emerald-500/25"
          >
            {busy ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </form>

      {/* APPEARANCE */}
      <div className="space-y-2">
        <h3 className="px-1 text-label text-gray-400">Appearance</h3>
        <div className="bg-white dark:bg-gray-800/40 border border-gray-100 dark:border-gray-800 rounded-3xl shadow-sm overflow-hidden">
          <button
            onClick={() => setTheme(isDark ? 'light' : 'dark')}
            className="w-full flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors text-left"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-gray-50 dark:bg-gray-900/50 flex items-center justify-center text-gray-500 dark:text-gray-400 shrink-0">
                <PaletteIcon weight="bold" className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-body-strong text-gray-900 dark:text-white">Dark mode</p>
                <p className="text-micro text-gray-400">{isDark ? 'Enabled' : 'Disabled'}</p>
              </div>
            </div>
            <span
              className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${isDark ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-600'}`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${isDark ? 'translate-x-5' : ''}`}
              />
            </span>
          </button>
        </div>
      </div>

      {/* ACCOUNT (read-only) */}
      <div className="space-y-2">
        <h3 className="px-1 text-label text-gray-400">Account</h3>
        <div className="bg-white dark:bg-gray-800/40 border border-gray-100 dark:border-gray-800 rounded-3xl shadow-sm overflow-hidden">
          <div className="flex items-center gap-3 p-4 border-b border-gray-50 dark:border-white/5">
            <div className="w-9 h-9 rounded-xl bg-gray-50 dark:bg-gray-900/50 flex items-center justify-center text-gray-500 dark:text-gray-400 shrink-0">
              <EnvelopeSimpleIcon weight="bold" className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <p className="text-micro text-gray-400">Email</p>
              <p className="text-body-strong text-gray-900 dark:text-white truncate">{user.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-4">
            <div className="w-9 h-9 rounded-xl bg-gray-50 dark:bg-gray-900/50 flex items-center justify-center text-gray-500 dark:text-gray-400 shrink-0">
              <IdentificationBadgeIcon weight="bold" className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <p className="text-micro text-gray-400">Role</p>
              <p className="text-body-strong text-gray-900 dark:text-white">{user.role.name}</p>
            </div>
          </div>
        </div>
      </div>

      {/* LOG OUT */}
      <button
        onClick={logout}
        className="flex w-full items-center justify-center gap-2 py-3.5 rounded-2xl text-body-strong text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/20 active:scale-[0.99] transition-all"
      >
        <SignOutIcon weight="bold" className="w-5 h-5" />
        Log out
      </button>

      <div className="pt-2 text-center">
        <p className="text-micro text-gray-300 dark:text-gray-600">Version 1.0.4 • 2026</p>
      </div>
    </div>
  );
}
