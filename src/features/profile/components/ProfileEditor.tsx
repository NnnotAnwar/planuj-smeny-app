import {
    AtIcon,
    CheckCircleIcon,
    ClockIcon,
    LockIcon,
    PaperPlaneTiltIcon,
    HourglassMediumIcon,
    XCircleIcon,
} from '@phosphor-icons/react';
import { useProfileEditing } from '../hooks/useProfileEditing';

/**
 * Inline self-profile editor used on the Profile page. Shares all rules with
 * the Settings screen via useProfileEditing (username weekly limit, admin
 * direct name edit vs. staff name-change request).
 */

const fieldClass =
    'w-full bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 focus:border-emerald-500 rounded-xl px-3 py-2.5 text-body outline-none text-gray-900 dark:text-white transition-colors disabled:opacity-60 disabled:cursor-not-allowed';
const cardClass =
    'bg-white dark:bg-gray-800/40 border border-gray-100 dark:border-gray-800 rounded-3xl shadow-sm';

export function ProfileEditor() {
    const {
        user, isStaff,
        username, setUsername, busyUser, userErr, userSaved, usernameLocked, nextAllowedStr, usernameDirty, saveUsername,
        firstName, setFirstName, lastName, setLastName, busyName, nameErr, nameSaved, nameDirty, saveName,
        latestRequest, pending, showRequest,
        reqFirst, setReqFirst, reqLast, setReqLast, reqNote, setReqNote,
        busyReq, reqErr, submitRequest, cancelRequest, openRequest, closeRequest,
    } = useProfileEditing();

    if (!user) return null;

    return (
        <div className="space-y-4">
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
                                            onClick={closeRequest}
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
                                    onClick={openRequest}
                                    className="flex items-center justify-center gap-2 w-full px-4 py-3 rounded-xl text-body-strong text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/15 border border-emerald-100 dark:border-emerald-900/30 hover:bg-emerald-100 dark:hover:bg-emerald-900/25 transition-colors"
                                >
                                    <PaperPlaneTiltIcon weight="bold" className="w-4 h-4" />
                                    Request name change
                                </button>
                            ))}
                    </div>
                )}
            </div>
        </div>
    );
}
