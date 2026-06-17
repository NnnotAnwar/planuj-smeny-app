import { useState, useEffect, useCallback, type SyntheticEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { BuildingsIcon, IdentificationBadgeIcon, CheckCircleIcon } from '@phosphor-icons/react';
import { supabase } from '@shared/api/supabaseClient';
import { authService } from './authService';
import { getRoleBadgeColor } from '@shared/utils/roleColors';

/**
 * --- ACCEPT INVITE PAGE ---
 * Landing page for the invitation email link. Supabase establishes a session
 * from the URL (detectSessionInUrl); we then show the invitee exactly where and
 * as what they were invited, and let them set a password to finish joining.
 */

type Status = 'loading' | 'ready' | 'invalid';

interface InviteInfo {
    email: string;
    role: string;
    org: string;
}

export function AcceptInvitePage() {
    const navigate = useNavigate();
    const [status, setStatus] = useState<Status>('loading');
    const [info, setInfo] = useState<InviteInfo | null>(null);
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
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
            setFirstName(profile.first_name ?? '');
            setLastName(profile.last_name ?? '');
            setStatus('ready');
        } catch {
            setStatus('invalid');
        }
    }, []);

    // The invite token in the URL is processed asynchronously by supabase-js;
    // listen for the resulting session, with a fallback timeout for bad links.
    useEffect(() => {
        let handled = false;
        const handle = (userId: string) => {
            if (handled) return;
            handled = true;
            loadFromSession(userId);
        };

        const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
            if (session) handle(session.user.id);
        });

        (async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (session) return handle(session.user.id);
            setTimeout(async () => {
                if (handled) return;
                const { data: { session: retry } } = await supabase.auth.getSession();
                if (retry) handle(retry.user.id);
                else setStatus('invalid');
            }, 1500);
        })();

        return () => sub.subscription.unsubscribe();
    }, [loadFromSession]);

    const handleSubmit = async (e: SyntheticEvent) => {
        e.preventDefault();
        if (password.length < 6) return setError('Password must be at least 6 characters.');
        if (password !== confirm) return setError('Passwords do not match.');

        setBusy(true);
        setError(null);
        try {
            const { error: updateError } = await supabase.auth.updateUser({
                password,
                data: { first_name: firstName.trim(), last_name: lastName.trim() },
            });
            if (updateError) throw updateError;

            // Persist names to the profile row as well.
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                await supabase
                    .from('profiles')
                    .update({ first_name: firstName.trim() || null, last_name: lastName.trim() || null })
                    .eq('id', user.id);
            }

            // Full reload so AuthProvider re-initialises with the now-complete session.
            window.location.replace('/');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Could not complete your setup.');
            setBusy(false);
        }
    };

    if (status === 'loading') {
        return (
            <div className="min-h-dvh flex items-center justify-center bg-white dark:bg-gray-950">
                <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    if (status === 'invalid') {
        return (
            <div className="min-h-dvh flex items-center justify-center bg-white dark:bg-gray-950 p-6">
                <div className="text-center space-y-3 max-w-sm">
                    <h1 className="text-xl font-black text-gray-900 dark:text-white">Invitation unavailable</h1>
                    <p className="text-sm text-gray-500">
                        This invitation link is invalid or has expired. Please ask an administrator to send a new one.
                    </p>
                    <button
                        onClick={() => navigate('/login', { replace: true })}
                        className="text-emerald-600 dark:text-emerald-400 font-bold text-sm"
                    >
                        Go to sign in
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-dvh flex items-center justify-center bg-gradient-to-br from-emerald-50 via-white to-white dark:from-emerald-950/30 dark:via-gray-950 dark:to-gray-950 p-4">
            <div className="w-full max-w-md bg-white dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-2xl overflow-hidden">
                {/* Invite summary — clearly states where and as what */}
                <div className="p-6 bg-emerald-500/5 border-b border-emerald-100 dark:border-emerald-900/30 space-y-4">
                    <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                        <CheckCircleIcon weight="fill" className="w-5 h-5" />
                        <p className="text-[10px] font-black uppercase tracking-widest">You've been invited</p>
                    </div>
                    <div className="space-y-3">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                                <BuildingsIcon weight="bold" className="w-5 h-5" />
                            </div>
                            <div className="min-w-0">
                                <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Organization</p>
                                <p className="font-bold text-gray-900 dark:text-white truncate">{info?.org}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 flex items-center justify-center shrink-0">
                                <IdentificationBadgeIcon weight="bold" className="w-5 h-5" />
                            </div>
                            <div className="min-w-0">
                                <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Role</p>
                                <span
                                    className={`inline-block px-2 py-0.5 text-[10px] font-black rounded-md uppercase tracking-widest ${getRoleBadgeColor(
                                        info?.role ?? '',
                                    )}`}
                                >
                                    {info?.role}
                                </span>
                            </div>
                        </div>
                    </div>
                    <p className="text-[11px] text-gray-400">{info?.email}</p>
                </div>

                {/* Set password to finish */}
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div>
                        <h2 className="font-black text-gray-900 dark:text-white">Set up your account</h2>
                        <p className="text-xs text-gray-400 mt-0.5">Choose a password to accept the invitation.</p>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <input
                            value={firstName}
                            onChange={(e) => setFirstName(e.target.value)}
                            placeholder="First name"
                            className="w-full bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 focus:border-emerald-500 rounded-xl px-3 py-2.5 text-sm outline-none dark:text-white"
                        />
                        <input
                            value={lastName}
                            onChange={(e) => setLastName(e.target.value)}
                            placeholder="Last name"
                            className="w-full bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 focus:border-emerald-500 rounded-xl px-3 py-2.5 text-sm outline-none dark:text-white"
                        />
                    </div>

                    <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Password"
                        autoFocus
                        className="w-full bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 focus:border-emerald-500 rounded-xl px-3 py-2.5 text-sm outline-none dark:text-white"
                    />
                    <input
                        type="password"
                        value={confirm}
                        onChange={(e) => setConfirm(e.target.value)}
                        placeholder="Confirm password"
                        className="w-full bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 focus:border-emerald-500 rounded-xl px-3 py-2.5 text-sm outline-none dark:text-white"
                    />

                    {error && (
                        <p className="text-xs font-bold text-red-500 bg-red-50 dark:bg-red-900/20 rounded-xl px-3 py-2">{error}</p>
                    )}

                    <button
                        type="submit"
                        disabled={busy}
                        className="w-full px-4 py-3 rounded-xl font-bold text-sm text-white bg-emerald-500 hover:bg-emerald-600 transition-colors disabled:opacity-60 shadow-lg shadow-emerald-500/25"
                    >
                        {busy ? 'Joining…' : `Join ${info?.org ?? ''}`}
                    </button>
                </form>
            </div>
        </div>
    );
}
