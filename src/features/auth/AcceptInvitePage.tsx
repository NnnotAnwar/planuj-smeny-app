import { useState, useEffect, useCallback, type SyntheticEvent, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    BuildingsIcon,
    IdentificationBadgeIcon,
    CheckCircleIcon,
    AtIcon,
    LockIcon,
    EyeIcon,
    EyeSlashIcon,
    SunIcon,
    MoonIcon,
    WarningCircleIcon,
} from '@phosphor-icons/react';
import { supabase } from '@shared/api/supabaseClient';
import { useTheme } from '@app/providers/ThemeContext';
import { useTranslation } from '@shared/preferences/PreferencesContext';
import { Button } from '@shared/components/Button';
import { Input } from '@shared/components/Input';
import { FormError } from '@shared/components/FormError';
import { authService } from './authService';
import { getRoleBadgeColor } from '@shared/utils/roleColors';

/**
 * --- ACCEPT INVITE PAGE ---
 * Landing page for the invitation email link. Supabase establishes a session
 * from the URL (detectSessionInUrl); we then show the invitee exactly where and
 * as what they were invited, and let them set a password to finish joining.
 */

type Status = 'loading' | 'ready' | 'invalid';

// Mirrors the rule enforced in Settings + the DB unique_username constraint.
const USERNAME_RE = /^[a-z0-9._-]{3,30}$/;

interface InviteInfo {
    email: string;
    role: string;
    org: string;
}

/** Branded shell shared by every state: app gradient, ambient glow, theme toggle. */
function PageShell({ children }: { children: ReactNode }) {
    const { resolvedTheme, setTheme } = useTheme();
    const isDark = resolvedTheme === 'dark';
    const t = useTranslation();
    return (
        <div className="relative min-h-dvh flex items-center justify-center overflow-hidden px-4 py-10">
            <div className="pointer-events-none absolute -top-24 -left-24 w-80 h-80 rounded-full bg-emerald-500/20 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-32 -right-20 w-96 h-96 rounded-full bg-emerald-400/10 blur-3xl" />

            <button
                onClick={() => setTheme(isDark ? 'light' : 'dark')}
                aria-label={t('common.toggleTheme')}
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

            {children}
        </div>
    );
}

export function AcceptInvitePage() {
    const navigate = useNavigate();
    const t = useTranslation();
    const [status, setStatus] = useState<Status>('loading');
    const [info, setInfo] = useState<InviteInfo | null>(null);
    const [username, setUsername] = useState('');
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [showPwd, setShowPwd] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const loadFromSession = useCallback(async (userId: string) => {
        try {
            const profile = await authService.getUserProfile(userId);
            if (!profile) return setStatus('invalid');

            const { data: org } = await supabase
                .from('organizations')
                .select('name')
                .eq('id', profile.organization_id)
                .single();

            setInfo({ email: profile.email, role: profile.role.name, org: org?.name ?? '—' });
            setUsername(profile.username ?? '');
            setFirstName(profile.first_name ?? '');
            setLastName(profile.last_name ?? '');
            setStatus('ready');
        } catch {
            setStatus('invalid');
        }
    }, []);

    // verifyOtp is called explicitly so the invitee's session replaces any
    // existing session (e.g. the admin who sent the invite). An onAuthStateChange
    // listener would fire with the admin session first and set handled=true,
    // silently discarding the verifyOtp result — so we don't use one here.
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const tokenHash = params.get('token_hash');
        const type = params.get('type');

        async function bootstrap() {
            if (tokenHash && type === 'invite') {
                const { data, error } = await supabase.auth.verifyOtp({
                    token_hash: tokenHash,
                    type: 'invite',
                });
                if (!error && data.user) {
                    // Burn-once: drop the token from the URL so a reload (or a
                    // double-mount) can't re-submit the now-consumed token and
                    // bounce the user to "invalid".
                    window.history.replaceState({}, '', '/accept-invite');
                    await loadFromSession(data.user.id);
                    return;
                }
                // The token is one-time: a previous load in THIS browser may have
                // already redeemed it and established the invitee's session. Fall
                // through to the session check rather than failing outright.
            }

            // Implicit hash flow, or recovery of a session redeemed moments ago.
            const { data: { session } } = await supabase.auth.getSession();
            if (session) { await loadFromSession(session.user.id); return; }

            await new Promise<void>(r => setTimeout(r, 1200));
            const { data: { session: retry } } = await supabase.auth.getSession();
            if (retry) await loadFromSession(retry.user.id);
            else setStatus('invalid');
        }

        bootstrap();
    }, [loadFromSession]);

    const handleSubmit = async (e: SyntheticEvent) => {
        e.preventDefault();
        const uname = username.trim().toLowerCase();
        if (!USERNAME_RE.test(uname)) {
            return setError(t('profile.editor.usernameInvalid'));
        }
        if (password.length < 6) return setError(t('invite.passwordShort'));
        if (password !== confirm) return setError(t('invite.passwordMismatch'));

        setBusy(true);
        setError(null);
        try {
            const { error: updateError } = await supabase.auth.updateUser({
                password,
                data: { first_name: firstName.trim(), last_name: lastName.trim() },
            });
            if (updateError) throw updateError;

            // Persist the chosen username + names to the profile row.
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { error: profileError } = await supabase
                    .from('profiles')
                    .update({
                        username: uname,
                        first_name: firstName.trim() || null,
                        last_name: lastName.trim() || null,
                    })
                    .eq('id', user.id);
                if (profileError) {
                    setError(
                        profileError.code === '23505'
                            ? t('profile.editor.usernameTaken')
                            : profileError.message || t('invite.saveError'),
                    );
                    setBusy(false);
                    return;
                }
            }

            // Full reload so AuthProvider re-initialises with the now-complete session.
            window.location.replace('/');
        } catch (err) {
            setError(err instanceof Error ? err.message : t('invite.setupError'));
            setBusy(false);
        }
    };

    if (status === 'loading') {
        return (
            <PageShell>
                <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            </PageShell>
        );
    }

    if (status === 'invalid') {
        return (
            <PageShell>
                <motion.div
                    initial={{ opacity: 0, y: 20, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ type: 'spring', stiffness: 260, damping: 26 }}
                    className="relative w-full max-w-md bg-white/70 dark:bg-gray-900/60 backdrop-blur-xl border border-white/60 dark:border-white/10 rounded-3xl shadow-2xl shadow-emerald-500/5 p-8 text-center"
                >
                    <div className="w-14 h-14 mx-auto rounded-2xl bg-red-50 dark:bg-red-900/20 text-red-500 flex items-center justify-center">
                        <WarningCircleIcon weight="fill" className="w-7 h-7" />
                    </div>
                    <h1 className="text-title text-gray-900 dark:text-white mt-5">{t('invite.unavailable')}</h1>
                    <p className="text-body text-gray-500 dark:text-gray-400 mt-2">
                        {t('invite.invalidDesc')}
                    </p>
                    <Button
                        size="lg"
                        fullWidth
                        onClick={() => navigate('/login', { replace: true })}
                        className="mt-6 shadow-lg shadow-emerald-500/25"
                    >
                        {t('invite.goSignIn')}
                    </Button>
                </motion.div>
            </PageShell>
        );
    }

    return (
        <PageShell>
            <motion.div
                initial={{ opacity: 0, y: 20, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ type: 'spring', stiffness: 260, damping: 26 }}
                className="relative w-full max-w-md"
            >
                <div className="bg-white/70 dark:bg-gray-900/60 backdrop-blur-xl border border-white/60 dark:border-white/10 rounded-3xl shadow-2xl shadow-emerald-500/5 overflow-hidden">
                    {/* Invite summary — clearly states where and as what */}
                    <div className="p-6 bg-emerald-500/5 border-b border-emerald-100/60 dark:border-emerald-900/30 space-y-4">
                        <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                            <CheckCircleIcon weight="fill" className="w-5 h-5" />
                            <p className="text-micro">{t('invite.invited')}</p>
                        </div>
                        <div className="space-y-3">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                                    <BuildingsIcon weight="bold" className="w-5 h-5" />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-micro text-gray-400">{t('profile.field.organization')}</p>
                                    <p className="text-body-strong text-gray-900 dark:text-white truncate">{info?.org}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 flex items-center justify-center shrink-0">
                                    <IdentificationBadgeIcon weight="bold" className="w-5 h-5" />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-micro text-gray-400">{t('profile.field.role')}</p>
                                    <span className={`inline-block px-2 py-0.5 text-micro rounded-md ${getRoleBadgeColor(info?.role ?? '')}`}>
                                        {info?.role}
                                    </span>
                                </div>
                            </div>
                        </div>
                        <p className="text-caption text-gray-400">{info?.email}</p>
                    </div>

                    {/* Set password to finish */}
                    <form onSubmit={handleSubmit} className="p-6 space-y-4">
                        <div>
                            <h2 className="text-heading text-gray-900 dark:text-white">{t('invite.setup')}</h2>
                            <p className="text-small text-gray-400 mt-0.5">{t('invite.setupHint')}</p>
                        </div>

                        <div>
                            <label htmlFor="username" className="text-micro text-gray-400 ml-1">{t('profile.field.username')}</label>
                            <div className="mt-1.5">
                                <Input
                                    id="username"
                                    icon={AtIcon}
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    placeholder="username"
                                    autoCapitalize="none"
                                    autoCorrect="off"
                                    spellCheck={false}
                                />
                            </div>
                            <p className="text-caption text-gray-400 mt-1.5 ml-1">{t('invite.usernameHint')}</p>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <Input
                                value={firstName}
                                onChange={(e) => setFirstName(e.target.value)}
                                placeholder={t('profile.field.firstName')}
                                autoComplete="given-name"
                            />
                            <Input
                                value={lastName}
                                onChange={(e) => setLastName(e.target.value)}
                                placeholder={t('profile.field.lastName')}
                                autoComplete="family-name"
                            />
                        </div>

                        <Input
                            icon={LockIcon}
                            type={showPwd ? 'text' : 'password'}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder={t('auth.password')}
                            autoComplete="new-password"
                            autoFocus
                            trailing={
                                <button
                                    type="button"
                                    onClick={() => setShowPwd((v) => !v)}
                                    aria-label={showPwd ? t('auth.hidePassword') : t('auth.showPassword')}
                                    className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
                                >
                                    {showPwd ? <EyeSlashIcon weight="bold" className="w-4 h-4" /> : <EyeIcon weight="bold" className="w-4 h-4" />}
                                </button>
                            }
                        />

                        <Input
                            icon={LockIcon}
                            type={showPwd ? 'text' : 'password'}
                            value={confirm}
                            onChange={(e) => setConfirm(e.target.value)}
                            placeholder={t('auth.confirmPassword')}
                            autoComplete="new-password"
                        />

                        <FormError message={error} />

                        <Button type="submit" size="lg" fullWidth loading={busy} className="shadow-lg shadow-emerald-500/25">
                            {busy ? t('invite.joining') : t('invite.join', { org: info?.org ?? '' })}
                        </Button>
                    </form>
                </div>
            </motion.div>
        </PageShell>
    );
}
