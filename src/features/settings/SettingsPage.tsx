import { useState, useEffect, useCallback, type SyntheticEvent } from 'react';
import {
  AtIcon,
  PaletteIcon,
  EnvelopeSimpleIcon,
  IdentificationBadgeIcon,
  CheckCircleIcon,
  SignOutIcon,
  LockIcon,
  ClockIcon,
  PaperPlaneTiltIcon,
  HourglassMediumIcon,
  XCircleIcon,
} from '@phosphor-icons/react';
import { useAuthContext } from '@features/auth/AuthContext';
import { authService } from '@features/auth/authService';
import { useTheme } from '@app/providers/ThemeContext';
import { getRoleBadgeColor } from '@shared/utils/roleColors';
import type { NameChangeRequest } from '@shared/types';

/**
 * --- SETTINGS PAGE ---
 * The signed-in user manages their own profile here.
 *
 * Rules (enforced in the DB, mirrored in this UI):
 *  - Username is self-service but can only change once every 7 days.
 *  - Staff (rank < 30) cannot edit their own first/last name — they file a
 *    request that an admin approves. Admins (rank >= 30) edit names directly.
 */

const USERNAME_RE = /^[a-z0-9._-]{3,30}$/;
const ADMIN_RANK = 30;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

const fieldClass =
  'w-full bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 focus:border-emerald-500 rounded-xl px-3 py-2.5 text-body outline-none text-gray-900 dark:text-white transition-colors disabled:opacity-60 disabled:cursor-not-allowed';
const cardClass =
  'bg-white dark:bg-gray-800/40 border border-gray-100 dark:border-gray-800 rounded-3xl shadow-sm';

export default function SettingsPage() {
  const { user, refreshUser, logout } = useAuthContext();
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  const isStaff = (user?.role.rank ?? 0) < ADMIN_RANK;

  // username (self-service, weekly limited)
  const [username, setUsername] = useState(user?.username ?? '');
  const [busyUser, setBusyUser] = useState(false);
  const [userErr, setUserErr] = useState<string | null>(null);
  const [userSaved, setUserSaved] = useState(false);

  // name (admins edit directly)
  const [firstName, setFirstName] = useState(user?.first_name ?? '');
  const [lastName, setLastName] = useState(user?.last_name ?? '');
  const [busyName, setBusyName] = useState(false);
  const [nameErr, setNameErr] = useState<string | null>(null);
  const [nameSaved, setNameSaved] = useState(false);

  // name change request (staff)
  const [latestRequest, setLatestRequest] = useState<NameChangeRequest | null>(null);
  const [showRequest, setShowRequest] = useState(false);
  const [reqFirst, setReqFirst] = useState(user?.first_name ?? '');
  const [reqLast, setReqLast] = useState(user?.last_name ?? '');
  const [reqNote, setReqNote] = useState('');
  const [busyReq, setBusyReq] = useState(false);
  const [reqErr, setReqErr] = useState<string | null>(null);

  const loadRequest = useCallback(async () => {
    if (!user || !isStaff) return;
    try {
      setLatestRequest(await authService.getMyLatestNameRequest(user.id));
    } catch (err) {
      console.error('Failed to load name request:', err);
    }
  }, [user, isStaff]);

  // Initial load (inline async so we don't call a setState-callback directly in
  // the effect body). Handlers reuse loadRequest() to refresh after an action.
  useEffect(() => {
    if (!user || !isStaff) return;
    let active = true;
    (async () => {
      try {
        const req = await authService.getMyLatestNameRequest(user.id);
        if (active) setLatestRequest(req);
      } catch (err) {
        console.error('Failed to load name request:', err);
      }
    })();
    return () => {
      active = false;
    };
  }, [user, isStaff]);

  // Captured once at mount (clock reads must not happen during render).
  const [nowTs] = useState(() => Date.now());

  if (!user) return null;

  // --- username weekly limit ---
  const lastChanged = user.username_changed_at ? new Date(user.username_changed_at).getTime() : null;
  const nextAllowedAt = lastChanged ? lastChanged + WEEK_MS : null;
  const usernameLocked = nextAllowedAt ? nowTs < nextAllowedAt : false;
  const nextAllowedStr = nextAllowedAt
    ? new Date(nextAllowedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
    : '';

  const normalizedUsername = username.trim().toLowerCase();
  const usernameDirty = normalizedUsername !== (user.username ?? '');

  const saveUsername = async (e: SyntheticEvent) => {
    e.preventDefault();
    setUserErr(null);
    setUserSaved(false);
    if (!USERNAME_RE.test(normalizedUsername)) {
      setUserErr('Username must be 3–30 characters: lowercase letters, numbers, dot, underscore or hyphen.');
      return;
    }
    setBusyUser(true);
    const { error } = await authService.updateProfile(user.id, { username: normalizedUsername });
    if (error) {
      setUserErr(
        error.code === '23505'
          ? 'That username is already taken. Please choose another.'
          : error.message || 'Could not update your username.',
      );
      setBusyUser(false);
      return;
    }
    await refreshUser();
    setUsername(normalizedUsername);
    setBusyUser(false);
    setUserSaved(true);
  };

  // --- name (admins) ---
  const nameDirty = firstName.trim() !== (user.first_name ?? '') || lastName.trim() !== (user.last_name ?? '');

  const saveName = async (e: SyntheticEvent) => {
    e.preventDefault();
    setNameErr(null);
    setNameSaved(false);
    setBusyName(true);
    const { error } = await authService.updateProfile(user.id, {
      first_name: firstName.trim() || null,
      last_name: lastName.trim() || null,
    });
    if (error) {
      setNameErr(error.message || 'Could not update your name.');
      setBusyName(false);
      return;
    }
    await refreshUser();
    setBusyName(false);
    setNameSaved(true);
  };

  // --- name change request (staff) ---
  const submitRequest = async (e: SyntheticEvent) => {
    e.preventDefault();
    setReqErr(null);
    if (!reqFirst.trim() && !reqLast.trim()) {
      setReqErr('Enter the first and/or last name you would like.');
      return;
    }
    setBusyReq(true);
    try {
      await authService.requestNameChange(reqFirst.trim(), reqLast.trim(), reqNote.trim() || null);
      setShowRequest(false);
      setReqNote('');
      await loadRequest();
    } catch (err) {
      setReqErr(err instanceof Error ? err.message : 'Could not submit your request.');
    } finally {
      setBusyReq(false);
    }
  };

  const cancelRequest = async () => {
    if (!latestRequest) return;
    setBusyReq(true);
    try {
      await authService.cancelNameChange(latestRequest.id);
      await loadRequest();
    } catch (err) {
      setReqErr(err instanceof Error ? err.message : 'Could not cancel your request.');
    } finally {
      setBusyReq(false);
    }
  };

  const fullName =
    user.first_name || user.last_name ? `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim() : '—';
  const pending = latestRequest?.status === 'pending' ? latestRequest : null;

  return (
    <div className="space-y-4 px-1 pb-10">
      <header className="pt-2 space-y-0.5">
        <p className="text-label text-emerald-500 text-left">Preferences</p>
        <h1 className="text-display text-gray-900 dark:text-white">Settings</h1>
      </header>

      {/* USER PREVIEW */}
      <div className={`${cardClass} p-4 flex items-center gap-4`}>
        <div className="w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-900/40 border-2 border-white dark:border-white/10 flex items-center justify-center text-emerald-700 dark:text-emerald-400 text-lg font-black shrink-0">
          {(user.first_name?.[0] || user.username?.[0] || '?').toUpperCase()}
        </div>
        <div className="min-w-0">
          <h2 className="text-title text-gray-900 dark:text-white truncate">{fullName === '—' ? user.username : fullName}</h2>
          <div className="flex items-center gap-2 mt-1">
            <span className={`inline-block px-2 py-0.5 text-micro rounded-md ${getRoleBadgeColor(user.role.name)}`}>
              {user.role.name}
            </span>
            <span className="text-caption text-gray-400">@{user.username}</span>
          </div>
        </div>
      </div>

      {/* USERNAME */}
      <form onSubmit={saveUsername} className="space-y-2">
        <h3 className="px-1 text-label text-gray-400">Username</h3>
        <div className={`${cardClass} p-5 space-y-4`}>
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
              disabled={usernameLocked}
              className={fieldClass}
            />
            {usernameLocked ? (
              <p className="flex items-center gap-1.5 text-caption text-amber-600 dark:text-amber-400 mt-1.5">
                <ClockIcon weight="bold" className="w-3.5 h-3.5" />
                You can change your username again on {nextAllowedStr}.
              </p>
            ) : (
              <p className="text-caption text-gray-400 mt-1.5">
                Used to sign in instead of your email. Must be unique. Can be changed once every 7 days.
              </p>
            )}
          </div>

          {userErr && (
            <p className="text-small-strong text-red-500 bg-red-50 dark:bg-red-900/20 rounded-xl px-3 py-2">{userErr}</p>
          )}
          {userSaved && !userErr && (
            <p className="flex items-center gap-1.5 text-small-strong text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl px-3 py-2">
              <CheckCircleIcon weight="fill" className="w-4 h-4" /> Username updated.
            </p>
          )}

          <button
            type="submit"
            disabled={busyUser || usernameLocked || !usernameDirty}
            className="w-full px-4 py-3 rounded-xl text-body-strong text-white bg-emerald-500 hover:bg-emerald-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-emerald-500/25"
          >
            {busyUser ? 'Saving…' : 'Save username'}
          </button>
        </div>
      </form>

      {/* NAME — admins edit directly; staff request a change */}
      <div className="space-y-2">
        <h3 className="px-1 text-label text-gray-400">Name</h3>

        {!isStaff ? (
          <form onSubmit={saveName} className={`${cardClass} p-5 space-y-4`}>
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
            {nameErr && (
              <p className="text-small-strong text-red-500 bg-red-50 dark:bg-red-900/20 rounded-xl px-3 py-2">{nameErr}</p>
            )}
            {nameSaved && !nameErr && (
              <p className="flex items-center gap-1.5 text-small-strong text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl px-3 py-2">
                <CheckCircleIcon weight="fill" className="w-4 h-4" /> Name updated.
              </p>
            )}
            <button
              type="submit"
              disabled={busyName || !nameDirty}
              className="w-full px-4 py-3 rounded-xl text-body-strong text-white bg-emerald-500 hover:bg-emerald-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-emerald-500/25"
            >
              {busyName ? 'Saving…' : 'Save name'}
            </button>
          </form>
        ) : (
          <div className={`${cardClass} p-5 space-y-4`}>
            {/* read-only current name */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-small-strong text-gray-600 dark:text-gray-300 mb-1.5 block">First name</label>
                <div className="flex items-center gap-2 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 px-3 py-2.5 text-body text-gray-700 dark:text-gray-200">
                  <LockIcon weight="bold" className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                  <span className="truncate">{user.first_name || '—'}</span>
                </div>
              </div>
              <div>
                <label className="text-small-strong text-gray-600 dark:text-gray-300 mb-1.5 block">Last name</label>
                <div className="flex items-center gap-2 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 px-3 py-2.5 text-body text-gray-700 dark:text-gray-200">
                  <LockIcon weight="bold" className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                  <span className="truncate">{user.last_name || '—'}</span>
                </div>
              </div>
            </div>

            <p className="text-caption text-gray-400">
              Your name can only be changed by an administrator. Send a request below and an admin will review it.
            </p>

            {/* pending request banner */}
            {pending && (
              <div className="rounded-xl bg-amber-50 dark:bg-amber-900/15 border border-amber-200/70 dark:border-amber-900/30 px-3 py-3 space-y-2">
                <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
                  <HourglassMediumIcon weight="fill" className="w-4 h-4" />
                  <p className="text-small-strong">Request pending review</p>
                </div>
                <p className="text-caption text-amber-700/90 dark:text-amber-300/80">
                  Requested: <span className="font-semibold">{`${pending.requested_first_name ?? ''} ${pending.requested_last_name ?? ''}`.trim() || '—'}</span>
                </p>
                <button
                  onClick={cancelRequest}
                  disabled={busyReq}
                  className="text-caption font-semibold text-amber-700 dark:text-amber-300 underline underline-offset-2 disabled:opacity-50"
                >
                  Cancel request
                </button>
              </div>
            )}

            {/* last decision feedback */}
            {!pending && latestRequest?.status === 'rejected' && (
              <p className="flex items-start gap-1.5 text-caption text-red-600 dark:text-red-400">
                <XCircleIcon weight="fill" className="w-4 h-4 shrink-0 mt-0.5" />
                Your last request was declined{latestRequest.review_note ? `: ${latestRequest.review_note}` : '.'}
              </p>
            )}
            {!pending && latestRequest?.status === 'approved' && (
              <p className="flex items-center gap-1.5 text-caption text-emerald-600 dark:text-emerald-400">
                <CheckCircleIcon weight="fill" className="w-4 h-4" /> Your last name change was approved.
              </p>
            )}

            {/* request form / trigger */}
            {!pending &&
              (showRequest ? (
                <form onSubmit={submitRequest} className="space-y-3 pt-1">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-small-strong text-gray-600 dark:text-gray-300 mb-1.5 block">New first name</label>
                      <input value={reqFirst} onChange={(e) => setReqFirst(e.target.value)} placeholder="First name" className={fieldClass} />
                    </div>
                    <div>
                      <label className="text-small-strong text-gray-600 dark:text-gray-300 mb-1.5 block">New last name</label>
                      <input value={reqLast} onChange={(e) => setReqLast(e.target.value)} placeholder="Last name" className={fieldClass} />
                    </div>
                  </div>
                  <div>
                    <label className="text-small-strong text-gray-600 dark:text-gray-300 mb-1.5 block">Note (optional)</label>
                    <textarea
                      value={reqNote}
                      onChange={(e) => setReqNote(e.target.value)}
                      rows={2}
                      placeholder="Reason for the change…"
                      className={fieldClass}
                    />
                  </div>
                  {reqErr && (
                    <p className="text-small-strong text-red-500 bg-red-50 dark:bg-red-900/20 rounded-xl px-3 py-2">{reqErr}</p>
                  )}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => { setShowRequest(false); setReqErr(null); }}
                      className="flex-1 px-4 py-2.5 rounded-xl text-small-strong text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={busyReq}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-small-strong text-white bg-emerald-500 hover:bg-emerald-600 transition-colors disabled:opacity-50"
                    >
                      <PaperPlaneTiltIcon weight="bold" className="w-4 h-4" />
                      {busyReq ? 'Sending…' : 'Send request'}
                    </button>
                  </div>
                </form>
              ) : (
                <button
                  onClick={() => {
                    setReqFirst(user.first_name ?? '');
                    setReqLast(user.last_name ?? '');
                    setReqErr(null);
                    setShowRequest(true);
                  }}
                  className="flex items-center justify-center gap-2 w-full px-4 py-3 rounded-xl text-body-strong text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/15 border border-emerald-100 dark:border-emerald-900/30 hover:bg-emerald-100 dark:hover:bg-emerald-900/25 transition-colors"
                >
                  <PaperPlaneTiltIcon weight="bold" className="w-4 h-4" />
                  Request name change
                </button>
              ))}
          </div>
        )}
      </div>

      {/* APPEARANCE */}
      <div className="space-y-2">
        <h3 className="px-1 text-label text-gray-400">Appearance</h3>
        <div className={`${cardClass} overflow-hidden`}>
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
            <span className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${isDark ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-600'}`}>
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${isDark ? 'translate-x-5' : ''}`} />
            </span>
          </button>
        </div>
      </div>

      {/* ACCOUNT (read-only) */}
      <div className="space-y-2">
        <h3 className="px-1 text-label text-gray-400">Account</h3>
        <div className={`${cardClass} overflow-hidden`}>
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
