import { useEffect, useRef, useState } from 'react';
import { motion, useMotionValue, useTransform, animate } from 'framer-motion';
import { StopIcon, ArrowLeftIcon, CaretDoubleRightIcon } from '@phosphor-icons/react';
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
 * Status of the running shift, with a live elapsed-time readout.
 *
 * Ending is irreversible (it writes the timesheet), so we guard against
 * accidents differently per input: on mobile a deliberate swipe-to-end gesture;
 * on desktop a plain single click (a mouse doesn't mis-fire the way a thumb can).
 */
export function ActiveShift() {
    const { user } = useAuthContext();
    const { activeShift, handleEndShift, locations, isEnding } = useShiftContext();
    const t = useTranslation();

    const elapsed = useElapsed(activeShift?.started_at);

    if (!user) return null;

    const durationLabel = elapsed
        ? elapsed.hours > 0
            ? t('shifts.durationHM', { h: elapsed.hours, m: elapsed.minutes })
            : t('shifts.durationM', { m: elapsed.minutes })
        : '';

    const onEnd = () => {
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

    return (
        <>
            {/* --- MOBILE STATUS --- */}
            <div className="mb-6 flex flex-col items-center md:hidden">
                <div className="flex items-center gap-1.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 px-3 py-1 text-body text-emerald-700 dark:text-emerald-400">
                    <LiveClockIcon className="h-4 w-4" isActive={true} />
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
                    {/* Desktop: a single click ends — no confirm. */}
                    <Button
                        variant="danger"
                        size="lg"
                        icon={StopIcon}
                        iconWeight="fill"
                        loading={isEnding}
                        onClick={onEnd}
                        fullWidth
                        className="md:w-auto md:px-8"
                    >
                        {isEnding ? t('shifts.ending') : t('shifts.end')}
                    </Button>
                </div>
            </div>

            {/* --- MOBILE STICKY: swipe to end --- */}
            <div className="fixed bottom-[calc(4rem+env(safe-area-inset-bottom))] left-0 right-0 z-50 bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl p-4 shadow-2xl md:hidden transition-all duration-300">
                <SwipeToEnd
                    busy={isEnding}
                    label={t('shifts.swipeToEnd')}
                    busyLabel={t('shifts.ending')}
                    onEnd={onEnd}
                />
            </div>
        </>
    );
}

/**
 * Swipe-to-confirm control for ending a shift on touch. A red thumb the user
 * drags across the track; releasing past ~85% commits, otherwise it springs
 * back. Deliberate by design, so a stray tap can't end a shift.
 */
function SwipeToEnd({
    busy,
    label,
    busyLabel,
    onEnd,
}: {
    busy: boolean;
    label: string;
    busyLabel: string;
    onEnd: () => void;
}) {
    const THUMB = 52;
    const PAD = 4;
    const trackRef = useRef<HTMLDivElement>(null);
    const x = useMotionValue(0);
    const [maxX, setMaxX] = useState(0);
    const wasBusy = useRef(false);

    // Track width can change (rotation, keyboard) — recompute the travel range.
    useEffect(() => {
        const measure = () => {
            const w = trackRef.current?.offsetWidth ?? 0;
            setMaxX(Math.max(0, w - THUMB - PAD * 2));
        };
        measure();
        window.addEventListener('resize', measure);
        return () => window.removeEventListener('resize', measure);
    }, []);

    // A successful end unmounts this control; if it instead FAILS, `busy` falls
    // back to false — spring the thumb home so the user can retry.
    useEffect(() => {
        if (busy) wasBusy.current = true;
        else if (wasBusy.current) {
            wasBusy.current = false;
            animate(x, 0, { type: 'spring', stiffness: 500, damping: 40 });
        }
    }, [busy, x]);

    const labelOpacity = useTransform(x, [0, Math.max(1, maxX * 0.5)], [1, 0]);
    const fillWidth = useTransform(x, (v) => v + THUMB + PAD);

    const handleDragEnd = () => {
        if (!busy && maxX > 0 && x.get() >= maxX * 0.85) {
            haptics.heavy();
            animate(x, maxX, { type: 'spring', stiffness: 500, damping: 44 });
            onEnd();
        } else {
            animate(x, 0, { type: 'spring', stiffness: 500, damping: 40 });
        }
    };

    return (
        <div
            ref={trackRef}
            className="relative h-14 rounded-2xl bg-red-500/10 dark:bg-red-500/15 overflow-hidden select-none"
        >
            {/* progress fill trailing the thumb */}
            <motion.div
                style={{ width: fillWidth }}
                className="absolute inset-y-1 left-0 rounded-2xl bg-red-500/20 pointer-events-none"
            />
            {/* centred label (stays visible while ending) */}
            <motion.span
                style={{ opacity: busy ? 1 : labelOpacity }}
                className="absolute inset-0 flex items-center justify-center gap-2 text-body-strong text-red-600 dark:text-red-400 pointer-events-none"
            >
                {busy ? busyLabel : label}
                {!busy && <CaretDoubleRightIcon weight="bold" className="w-4 h-4" />}
            </motion.span>
            {/* draggable thumb (hidden while the end request is in flight) */}
            {!busy && (
                <motion.div
                    drag="x"
                    dragConstraints={{ left: 0, right: maxX }}
                    dragElastic={0}
                    dragMomentum={false}
                    style={{ x, width: THUMB }}
                    onDragEnd={handleDragEnd}
                    aria-label={label}
                    className="absolute top-1 bottom-1 left-1 flex items-center justify-center rounded-xl bg-red-500 text-white shadow-lg shadow-red-500/30 touch-none cursor-grab active:cursor-grabbing"
                >
                    <StopIcon weight="fill" className="w-6 h-6" />
                </motion.div>
            )}
        </div>
    );
}
