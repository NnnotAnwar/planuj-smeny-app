import { useState, type SyntheticEvent } from 'react';
import { Link } from 'react-router-dom';
import { BuildingsIcon, EnvelopeSimpleIcon, EyeIcon, EyeSlashIcon, LockIcon, UserIcon, PaperPlaneTiltIcon } from '@phosphor-icons/react';
import { useTranslation } from '@shared/preferences/PreferencesContext';
import { Button } from '@shared/components/Button';
import { Input } from '@shared/components/Input';
import { FormError } from '@shared/components/FormError';
import { authService } from './authService';
import { AuthShell } from './AuthShell';

/**
 * --- CREATE AN ORGANIZATION (owner sign-up) ---
 * For the store release: the owner registers themselves and their business.
 * Staff never sign up here — they join through an invite. After sign-up the
 * owner confirms their email; when the project skips confirmation, a session
 * comes back right away and <PublicRoute> takes them into the app.
 */

const MIN_PASSWORD = 8;

export function SignupPage() {
    const t = useTranslation();
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [orgName, setOrgName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [agreed, setAgreed] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [sentTo, setSentTo] = useState<string | null>(null);

    const submit = async (e: SyntheticEvent) => {
        e.preventDefault();
        setError('');
        if (!orgName.trim()) return setError(t('signup.orgRequired'));
        if (password.length < MIN_PASSWORD) return setError(t('signup.weakPassword', { n: MIN_PASSWORD }));
        if (!agreed) return setError(t('signup.agreeRequired'));
        setBusy(true);
        const { data, error: err } = await authService.signUpOwner({
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            email: email.trim(),
            password,
            organizationName: orgName.trim(),
        });
        if (err) {
            const m = err.message.toLowerCase();
            setError(
                m.includes('already') ? t('signup.exists')
                : m.includes('password') ? t('signup.weakPassword', { n: MIN_PASSWORD })
                : m.includes('not allowed') || m.includes('disabled') ? t('signup.disabled')
                : t('signup.error'),
            );
            setBusy(false);
            return;
        }
        // With a session, PublicRoute redirects into the app on its own.
        if (!data.session) {
            setSentTo(email.trim());
            setBusy(false);
        }
    };

    if (sentTo) {
        return (
            <AuthShell title={t('signup.checkTitle')} eyebrow={t('signup.eyebrow')}>
                <div className="space-y-4 text-center">
                    <div className="mx-auto flex size-11 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-300">
                        <PaperPlaneTiltIcon weight="duotone" className="size-6" />
                    </div>
                    <p className="text-body text-ink dark:text-slate-200">{t('signup.checkBody', { email: sentTo })}</p>
                    <p className="text-caption text-ink-soft dark:text-slate-400">{t('signup.checkHint')}</p>
                    <Link to="/login" className="inline-block text-meta font-semibold text-emerald-700 hover:underline dark:text-emerald-300">
                        {t('signup.backToLogin')}
                    </Link>
                </div>
            </AuthShell>
        );
    }

    // Placeholders carry the visible label so the whole form fits one phone
    // screen; the real <label> stays for screen readers.
    const label = (id: string, text: string) => (
        <label htmlFor={id} className="sr-only">
            {text}
        </label>
    );

    return (
        <AuthShell
            title={t('signup.title')}
            eyebrow={t('signup.eyebrow')}
            below={
                <p className="mt-4 text-center text-meta text-ink-soft dark:text-slate-400">
                    {t('signup.haveAccount')}{' '}
                    <Link to="/login" className="font-semibold text-emerald-700 hover:underline dark:text-emerald-300">
                        {t('auth.signIn')}
                    </Link>
                </p>
            }
        >
            <p className="-mt-2 mb-3 text-center text-caption text-ink-soft sm:mb-4 sm:text-meta dark:text-slate-400">{t('signup.lead')}</p>
            <form className="space-y-2.5" onSubmit={submit} noValidate>
                <div>
                    {label('org', t('signup.orgName'))}
                    <div>
                        <Input id="org" icon={BuildingsIcon} required maxLength={80} value={orgName} onChange={(e) => setOrgName(e.target.value)} placeholder={t('signup.orgName')} autoComplete="organization" />
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                    <div>
                        {label('first', t('signup.firstName'))}
                        <div>
                            <Input id="first" icon={UserIcon} required maxLength={60} value={firstName} onChange={(e) => setFirstName(e.target.value)} autoComplete="given-name" placeholder={t('signup.firstName')} />
                        </div>
                    </div>
                    <div>
                        {label('last', t('signup.lastName'))}
                        <div>
                            <Input id="last" required maxLength={60} value={lastName} onChange={(e) => setLastName(e.target.value)} autoComplete="family-name" placeholder={t('signup.lastName')} />
                        </div>
                    </div>
                </div>
                <div>
                    {label('email', t('signup.email'))}
                    <div>
                        <Input
                            id="email"
                            icon={EnvelopeSimpleIcon}
                            type="email"
                            required
                            autoCapitalize="none"
                            autoCorrect="off"
                            autoComplete="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder={t('signup.email')}
                        />
                    </div>
                </div>
                <div>
                    {label('pw', t('auth.password'))}
                    <div>
                        <Input
                            id="pw"
                            icon={LockIcon}
                            type={showPassword ? 'text' : 'password'}
                            required
                            minLength={MIN_PASSWORD}
                            autoComplete="new-password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder={t('signup.passwordPh', { n: MIN_PASSWORD })}
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

                {/* Legal links open in a new tab so the half-filled form survives. */}
                <label className="flex items-start gap-2 px-1 text-caption text-ink-soft dark:text-slate-400">
                    <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-0.5 size-4 accent-emerald-600" />
                    <span>
                        {t('signup.agreeBefore')}{' '}
                        <a href="/terms" target="_blank" rel="noreferrer" className="font-semibold text-emerald-700 hover:underline dark:text-emerald-300">{t('signup.terms')}</a>{' '}
                        {t('signup.and')}{' '}
                        <a href="/privacy" target="_blank" rel="noreferrer" className="font-semibold text-emerald-700 hover:underline dark:text-emerald-300">{t('signup.privacy')}</a>.
                    </span>
                </label>

                <FormError message={error} />

                <Button type="submit" size="lg" fullWidth loading={busy}>
                    {busy ? t('signup.creating') : t('signup.submit')}
                </Button>
                <p className="px-1 text-center text-caption text-ink-soft dark:text-slate-400">{t('signup.staffHint')}</p>
            </form>
        </AuthShell>
    );
}
