import { useEffect, useRef, useState } from 'react';
import { StopIcon, ArrowLeftIcon } from '@phosphor-icons/react';
import { LiveClockIcon } from '@shared/components/LiveClockIcon';
import { useAuthContext } from '../../auth/AuthContext';
import { useShiftContext } from '../ShiftContext';
import { useTranslation } from '@shared/preferences/PreferencesContext';
import { haptics } from '@shared/utils/haptics';
import { Button } from '@shared/components/Button';
import { useElapsed } from '@shared/hooks/useElapsed';
import { formatTime } from '@shared/utils/date';

/**
 * --- ACTIVE SHIFT COMPONENT ---
 * The status of the running shift, with a live elapsed-time readout and a
 * two-step "End shift" button.
 *
 * UX notes:
 *  • Live duration — the worker's real question is "how long have I been on?",
 *    so we show a ticking "2h 34m", not just the start time.
 *  • Guarded end — ending a shift is irreversible (it writes the timesheet), so
 *    the red button asks for a confirming second tap instead of firing on a
 *    single accidental touch.
 */
export function ActiveShift() {
    const { user } = useAuthContext();
    const { activeShift, handleEndShift, locations, isEnding } = useShiftContext();
    const t = useTranslation();

    // Two-step confirm: first tap arms, second tap (within the window) ends.
    const [confirming, setConfirming] = useState(false);
    const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    // When a shift starts, the End button mounts exactly where Start was. On
    // touch the synthesized post-tap click can "fall through" onto it — so we
    // ignore any End tap in the first moments after the active shift appears.
    const armedAt = useRef(0);

    const elapsed = useElapsed(activeShift?.started_at);

    useEffect(() => {
        armedAt.current = Date.now();
    }, [activeShift?.id]);

    useEffect(() => {
        return () => {
            if (resetTimer.current) clearTimeout(resetTimer.current);
        };
    }, []);

    if (!user) return null;

    const durationLabel = elapsed
        ? elapsed.hours > 0
            ? t('shifts.durationHM', { h: elapsed.hours, m: elapsed.minutes })
            : t('shifts.durationM', { m: elapsed.minutes })
        : '';

    const onEndClick = () => {
        // Swallow the stray click that can follow starting a shift (see armedAt).
        if (Date.now() - armedAt.current < 800) return;
        if (!confirming) {
            // Arm — give a medium tap and auto-disarm after 3s if not confirmed.
            haptics.medium();
            setConfirming(true);
            resetTimer.current = setTimeout(() => setConfirming(false), 3000);
            return;
        }
        if (resetTimer.current) clearTimeout(resetTimer.current);
        haptics.heavy();
        handleEndShift();
    };

    const startTime = formatTime(activeShift?.started_at);
    const userName = `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.username;
    const location = locations.find((l) => l.id === activeShift?.location_id);
    const locationName = location?.name || t('shifts.unknownLocation');
    const previousLocation = activeShift?.previous_location_id
        ? locations.find((l) => l.id === activeShift.previous_location_id)
        : null;

    // OFF SHIFT — a small, quiet status badge.
    if (!activeShift) {
        return (
            <div className="mb-6 flex justify-center">
                <div className="flex items-center gap-1.5 rounded-full bg-gray-200/50 dark:bg-gray-800/50 px-3 py-1 text-body text-gray-500 dark:text-gray-400">
                    <LiveClockIcon className="h-4 w-4 text-gray-400 dark:text-gray-500" isActive={false} />
                    {t('shifts.noActive')}
                </div>
            </div>
        );
    }

    const endLabel = isEnding ? t('shifts.ending') : confirming ? t('shifts.confirmEnd') : t('shifts.end');

    return (
        <>
            {/* --- MOBILE STATUS --- */}
            <div className="mb-6 flex flex-col items-center md:hidden">
                <div className="flex items-center gap-1.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 px-3 py-1 text-body text-emerald-700 dark:text-emerald-400">
                    <LiveClockIcon className="h-4 w-4" isActive={true} />
                    {/* microcopy: state + live duration reads clearer than a bare time. */}
                    {t('shifts.onShift')} · {durationLabel}
                </div>
                <p className="mt-2 text-body-strong text-gray-900 dark:text-white text-center">{locationName}</p>
                {previousLocation && (
                    <div className="mt-2 flex items-center gap-1 text-micro font-bold text-gray-900 dark:text-white">
                        <ArrowLeftIcon weight="bold" className="w-3 h-3" />
                        <span>{t('shifts.movedFrom', { location: previousLocation.name })}</span>
                    </div>
                )}
            </div>

            {/* --- DESKTOP CARD --- */}
            <div className="relative mb-8 hidden flex-col items-start justify-between gap-5 overflow-hidden rounded-2xl border border-emerald-500/10 dark:border-white/5 bg-white/40 dark:bg-white/5 backdrop-blur-md p-5 shadow-xl shadow-emerald-500/5 md:flex md:flex-row md:items-center md:p-6 transition-all duration-300">
                <div className="absolute bottom-0 left-0 top-0 w-1.5 bg-linear-to-b from-emerald-500 to-emerald-700"></div>
                <div className="flex items-center gap-4 pl-2">
                    <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-emerald-500/10 to-emerald-600/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                        <LiveClockIcon className="h-6 w-6" isActive={true} />
                    </div>
                    <div>
                        <div className="mb-1 flex items-center gap-2">
                            <span className="text-label text-emerald-600 dark:text-emerald-400">{t('shifts.active')}</span>
                            {previousLocation && (
                                <span className="flex items-center gap-1 text-micro font-bold text-gray-900 dark:text-white">
                                    <ArrowLeftIcon weight="bold" className="w-2.5 h-2.5" />
                                    {t('shifts.movedFrom', { location: previousLocation.name })}
                                </span>
                            )}
                        </div>
                        <h3 className="text-title leading-tight text-gray-800 dark:text-white">
                            {userName} <span className="ml-1 text-body text-gray-500 dark:text-gray-400">({user.role.name})</span>
                        </h3>
                        <p className="mt-0.5 text-body text-gray-500 dark:text-gray-400">
                            {locationName} • {t('shifts.startedAt', { time: startTime })} • {durationLabel}
                        </p>
                    </div>
                </div>
                <div className="w-full md:w-auto shrink-0">
                    <Button
                        variant="danger"
                        size="lg"
                        icon={StopIcon}
                        loading={isEnding}
                        onClick={onEndClick}
                        fullWidth
                        className="md:w-auto md:px-8"
                    >
                        {endLabel}
                    </Button>
                </div>
            </div>

            {/* --- MOBILE STICKY END BUTTON --- */}
            <div className="fixed bottom-[calc(4rem+env(safe-area-inset-bottom))] left-0 right-0 z-50 bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl p-4 shadow-2xl md:hidden transition-all duration-300">
                <Button
                    variant="danger"
                    size="lg"
                    icon={StopIcon}
                    loading={isEnding}
                    onClick={onEndClick}
                    fullWidth
                    className="rounded-2xl py-4"
                >
                    {endLabel}
                </Button>
            </div>
        </>
    );
}
