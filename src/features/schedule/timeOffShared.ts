import type { useTranslation } from '@shared/preferences/PreferencesContext';

/** Shared bits of the time-off UI (Schedule card + Requests page). */

export const KIND_KEYS = {
    vacation: 'timeoff.vacation',
    sick: 'timeoff.sick',
    other: 'timeoff.other',
} as const;

export const todayStr = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export type Translate = (key: Parameters<ReturnType<typeof useTranslation>>[0]) => string;

/** Localize service errors (TIMEOFF_OVERLAP = leave already covers those days). */
export const leaveErr = (err: unknown, t: Translate): string => {
    const msg = err instanceof Error ? err.message : '';
    if (msg === 'TIMEOFF_OVERLAP') return t('timeoff.overlap');
    return msg || t('common.actionFailed');
};

