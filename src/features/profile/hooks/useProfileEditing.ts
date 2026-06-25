import { useState, useEffect, useCallback, type SyntheticEvent } from 'react';
import { useAuthContext } from '@features/auth/AuthContext';
import { authService } from '@features/auth/authService';
import type { NameChangeRequest } from '@shared/types';

/**
 * --- useProfileEditing ---
 * All self-service profile-editing state + handlers, extracted from SettingsPage
 * so the Settings screen and the inline editor on the Profile page share one
 * source of truth for the rules:
 *  - Username is self-service but limited to once every 7 days.
 *  - Staff (rank < 30) cannot edit their own name — they file a request an admin
 *    approves. Admins (rank >= 30) edit names directly.
 */

const USERNAME_RE = /^[a-z0-9._-]{3,30}$/;
const ADMIN_RANK = 30;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export function useProfileEditing() {
    const { user, refreshUser } = useAuthContext();
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

    // --- username weekly limit ---
    const lastChanged = user?.username_changed_at ? new Date(user.username_changed_at).getTime() : null;
    const nextAllowedAt = lastChanged ? lastChanged + WEEK_MS : null;
    const usernameLocked = nextAllowedAt ? nowTs < nextAllowedAt : false;
    const nextAllowedStr = nextAllowedAt
        ? new Date(nextAllowedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
        : '';

    const normalizedUsername = username.trim().toLowerCase();
    const usernameDirty = normalizedUsername !== (user?.username ?? '');

    const saveUsername = async (e: SyntheticEvent) => {
        e.preventDefault();
        if (!user) return;
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
    const nameDirty = firstName.trim() !== (user?.first_name ?? '') || lastName.trim() !== (user?.last_name ?? '');

    const saveName = async (e: SyntheticEvent) => {
        e.preventDefault();
        if (!user) return;
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

    const openRequest = () => {
        setReqFirst(user?.first_name ?? '');
        setReqLast(user?.last_name ?? '');
        setReqErr(null);
        setShowRequest(true);
    };

    const closeRequest = () => {
        setShowRequest(false);
        setReqErr(null);
    };

    const pending = latestRequest?.status === 'pending' ? latestRequest : null;

    return {
        user,
        isStaff,
        // username
        username, setUsername, busyUser, userErr, userSaved,
        usernameLocked, nextAllowedStr, usernameDirty, saveUsername,
        // name (admins)
        firstName, setFirstName, lastName, setLastName,
        busyName, nameErr, nameSaved, nameDirty, saveName,
        // name request (staff)
        latestRequest, pending, showRequest, setShowRequest,
        reqFirst, setReqFirst, reqLast, setReqLast, reqNote, setReqNote,
        busyReq, reqErr, submitRequest, cancelRequest, openRequest, closeRequest,
    };
}
