import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { IdentificationBadgeIcon, ChatTextIcon, WarningOctagonIcon, PaperPlaneTiltIcon, EyeSlashIcon } from '@phosphor-icons/react';
import { Modal } from '@features/admin/components/Modal';
import { Button } from '@shared/components/Button';
import { Input, Textarea } from '@shared/components/Input';
import { Select } from '@shared/components/Select';
import { FormError } from '@shared/components/FormError';
import { useTranslation } from '@shared/preferences/PreferencesContext';
import { toast } from '@shared/toast/toastStore';
import { useAuthContext } from '@features/auth/AuthContext';
import { rolesService } from '@features/roles/rolesService';
import { roleKeys } from '@features/roles/useOrgRoles';
import { isLockedTop } from '@features/roles/types';
import { memberRequestError, memberRequestsService, type MemberRequestKind } from './memberRequestsService';
import { requestKeys } from './useRequests';

/**
 * --- NEW REQUEST ---
 * One form for everything that isn't time off or a name change:
 *   • Role      — ask for another role (approving applies it at once).
 *   • Other     — a subject + message.
 *   • Complaint — same, with an optional "send anonymously" (reviewers then
 *                 never see who sent it).
 */
const KINDS: { id: MemberRequestKind; Icon: typeof ChatTextIcon }[] = [
    { id: 'role', Icon: IdentificationBadgeIcon },
    { id: 'other', Icon: ChatTextIcon },
    { id: 'complaint', Icon: WarningOctagonIcon },
];

export function MemberRequestModal({ onClose, onSent }: { onClose: () => void; onSent?: () => void }) {
    const t = useTranslation();
    const qc = useQueryClient();
    const { user } = useAuthContext();
    const orgId = user?.organization_id ?? '';
    const [kind, setKind] = useState<MemberRequestKind>('role');
    const [roleId, setRoleId] = useState('');
    const [subject, setSubject] = useState('');
    const [body, setBody] = useState('');
    const [anonymous, setAnonymous] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const rolesQ = useQuery({ queryKey: roleKeys.list(orgId), queryFn: () => rolesService.list(orgId), enabled: !!orgId });
    // Any role but the top one and the one you already have.
    const roles = (rolesQ.data ?? []).filter((r) => !isLockedTop(r) && r.id !== user?.org_role_id);

    const send = useMutation({
        mutationFn: () =>
            memberRequestsService.submit({
                kind,
                orgRoleId: kind === 'role' ? roleId : null,
                subject: kind === 'role' ? null : subject,
                body,
                anonymous: kind === 'complaint' && anonymous,
            }),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: requestKeys.member });
            toast(t('mreq.sent'), 'success');
            onSent?.();
            onClose();
        },
        onError: (e) => {
            const code = memberRequestError(e);
            setError(code ? t(`mreq.err.${code}` as 'mreq.err.request_empty') : t('requests.error'));
        },
    });

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        if (kind === 'role' && !roleId) return setError(t('mreq.pickRole'));
        if (kind !== 'role' && !subject.trim() && !body.trim()) return setError(t('mreq.err.request_empty'));
        send.mutate();
    };

    return (
        <Modal title={t('mreq.new')} onClose={onClose}>
            <form onSubmit={submit} className="space-y-3">
                <div className="segmented w-full" role="tablist" aria-label={t('mreq.type')}>
                    {KINDS.map(({ id, Icon }) => (
                        <button
                            key={id}
                            type="button"
                            role="tab"
                            aria-selected={kind === id}
                            onClick={() => {
                                setKind(id);
                                setError(null);
                            }}
                            className={`flex flex-1 items-center justify-center gap-1.5 rounded-[9px] px-2 py-1 text-meta font-semibold transition-colors ${
                                kind === id ? 'segment-active text-ink dark:text-white' : 'text-ink-soft hover:text-ink dark:text-slate-400 dark:hover:text-white'
                            }`}
                        >
                            <Icon weight="bold" className="size-3.5" />
                            {t(`mreq.kind.${id}` as 'mreq.kind.role')}
                        </button>
                    ))}
                </div>
                <p className="-mt-1 px-1 text-caption text-ink-soft dark:text-slate-400">{t(`mreq.hint.${kind}` as 'mreq.hint.role')}</p>

                {kind === 'role' ? (
                    <div className="space-y-1.5">
                        <span className="text-label text-ink-soft dark:text-slate-400">{t('mreq.role')}</span>
                        <Select aria-label={t('mreq.role')} value={roleId} onChange={(e) => setRoleId(e.target.value)} fullWidth>
                            <option value="">{t('mreq.pickRole')}</option>
                            {roles.map((r) => (
                                <option key={r.id} value={r.id}>
                                    {r.name}
                                </option>
                            ))}
                        </Select>
                        {user?.org_role && (
                            <p className="text-caption text-ink-soft dark:text-slate-400">{t('mreq.currentRole', { role: user.org_role.name })}</p>
                        )}
                    </div>
                ) : (
                    <div className="space-y-1.5">
                        <label htmlFor="mreq-subject" className="text-label text-ink-soft dark:text-slate-400">
                            {t('mreq.subject')}
                        </label>
                        <Input
                            id="mreq-subject"
                            value={subject}
                            maxLength={120}
                            onChange={(e) => setSubject(e.target.value)}
                            placeholder={t(kind === 'complaint' ? 'mreq.subjectPhComplaint' : 'mreq.subjectPh')}
                            autoFocus
                        />
                    </div>
                )}

                <div className="space-y-1.5">
                    <label htmlFor="mreq-body" className="text-label text-ink-soft dark:text-slate-400">
                        {kind === 'role' ? t('mreq.why') : t('mreq.message')}
                    </label>
                    <Textarea
                        id="mreq-body"
                        rows={kind === 'role' ? 2 : 4}
                        value={body}
                        maxLength={2000}
                        onChange={(e) => setBody(e.target.value)}
                        placeholder={kind === 'role' ? t('mreq.whyPh') : t('mreq.messagePh')}
                    />
                </div>

                {kind === 'complaint' && (
                    <label className="flex cursor-pointer items-start gap-2 rounded-xl bg-ink/4 px-3 py-2 dark:bg-white/4">
                        <input type="checkbox" checked={anonymous} onChange={(e) => setAnonymous(e.target.checked)} className="mt-0.5 size-4 accent-emerald-600" />
                        <span className="min-w-0">
                            <span className="flex items-center gap-1 text-meta font-semibold text-ink dark:text-white">
                                <EyeSlashIcon weight="bold" className="size-3.5" />
                                {t('mreq.anonymous')}
                            </span>
                            <span className="block text-caption text-ink-soft dark:text-slate-400">{t('mreq.anonymousHint')}</span>
                        </span>
                    </label>
                )}

                <FormError message={error} />
                <div className="flex justify-end gap-2">
                    <Button type="button" size="sm" variant="ghost" onClick={onClose} disabled={send.isPending}>
                        {t('common.cancel')}
                    </Button>
                    <Button type="submit" size="sm" icon={PaperPlaneTiltIcon} loading={send.isPending}>
                        {t('mreq.send')}
                    </Button>
                </div>
            </form>
        </Modal>
    );
}
