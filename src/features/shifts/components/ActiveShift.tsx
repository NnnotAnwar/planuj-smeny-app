import { useEffect, useRef, useState } from 'react';
import { motion, useMotionValue, useTransform, animate } from 'framer-motion';
import { StopIcon, ArrowLeftIcon, CaretDoubleRightIcon } from '@phosphor-icons/react';
import { LiveClockIcon } from '@shared/components/LiveClockIcon';
import { useAuthContext } from '../../auth/AuthContext';
import { useShiftContext } from '../ShiftContext';
import { useTranslation } from '@shared/preferences/PreferencesContext';
import { haptics } from '@shared/utils/haptics';
import { useElapsed } from '@shared/hooks/useElapsed';
import { formatTime } from '@shared/utils/date';
import { LocationPickerPopover } from '@features/locations/components/LocationPickerPopover';

/**
 * --- ACTIVE SHIFT COMPONENT ---
 * Status of the running shift, with a live elapsed-time readout.
 *
 * Ending is irreversible (it writes the timesheet), so we guard against
 * accidents differently per input: on mobile a deliberate swipe-to-end gesture;
 * on desktop a plain single click (a mouse doesn't mis-fire the way a thumb can).
 *
 * On desktop the glowing clock doubles as the location switcher — tapping it
 * opens the picker underneath (same confirm/switch flow as the sidebar).
 */
export function ActiveShift({ onPickLocation }: { onPickLocation?: (locationId: string) => void }) {
    const { user } = useAuthContext();
    const { activeShift, handleEndShift, locations, isEnding } = useShiftContext();
    const t = useTranslation();
    const [pickerOpen, setPickerOpen] = useState(false);
    const pickerAnchor = useRef<HTMLButtonElement>(null);

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

    // OFF SHIFT — a small, quiet status badge (mobile; desktop shows CheckIn's idle card).
    if (!activeShift) {
        return (
            <div className="mb-4 flex justify-center md:hidden">
                <div className="glass flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium text-ink-soft dark:text-slate-400">
                    <LiveClockIcon className="size-3.5 text-ink-soft/70 dark:text-slate-500" isActive={false} />
                    {t('shifts.noActive')}
                </div>
            </div>
        );
    }

    return (
        <>
            {/* --- MOBILE STATUS --- */}
            <div className="mb-4 flex flex-col items-center md:hidden">
                <div className="glass flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                    <LiveClockIcon className="size-3.5" isActive={true} />
                    {t('shifts.onShift')} · <span className="tabular-nums">{durationLabel}</span>
                </div>
                <p className="mt-2 text-center font-display text-base font-bold tracking-[-0.01em] text-ink dark:text-white">{locationName}</p>
                {previousLocation && (
                    <div className="mt-1.5 flex items-center gap-1 text-micro font-bold text-ink dark:text-white">
                        <ArrowLeftIcon weight="bold" className="size-3" />
                        <span>{t('shifts.movedFrom', { location: previousLocation.name })}</span>
                    </div>
                )}
            </div>

            {/* --- DESKTOP CARD --- */}
            <div className="glass mb-3 hidden items-center justify-between gap-4 rounded-2xl p-3.5 [--glass-shadow:var(--shadow-glass-lg)] md:flex">
                <div className="flex min-w-0 items-center gap-3">
                    <button
                        ref={pickerAnchor}
                        type="button"
                        onClick={() => setPickerOpen(true)}
                        aria-label={t('location.change')}
                        title={t('location.change')}
                        className="shrink-0 rounded-xl transition-transform hover:scale-[1.05] active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
                    >
                        <ShiftClockGlow />
                    </button>
                    <LocationPickerPopover
                        open={pickerOpen}
                        onClose={() => setPickerOpen(false)}
                        anchorRef={pickerAnchor}
                        onSelect={(id) => onPickLocation?.(id)}
                    />
                    <div className="min-w-0">
                        <div className="flex items-center gap-2">
                            <span className="text-eyebrow text-emerald-600 dark:text-emerald-300">{t('shifts.active')}</span>
                            {previousLocation && (
                                <span className="flex items-center gap-1 text-micro font-bold text-ink dark:text-white">
                                    <ArrowLeftIcon weight="bold" className="size-2.5" />
                                    {t('shifts.movedFrom', { location: previousLocation.name })}
                                </span>
                            )}
                        </div>
                        <h3 className="mt-1 truncate text-card-title text-ink dark:text-white">
                            {userName}{' '}
                            <span className="font-sans text-meta tracking-normal text-ink-soft dark:text-slate-400">
                                ({user.role.name})
                            </span>
                        </h3>
                        {/* Each later segment carries its own leading dot, so a wrap
                            moves dot + text together and never strands a dot at a line end. */}
                        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-meta text-ink-soft dark:text-slate-400">
                            <span className="truncate">{locationName}</span>
                            <span className="flex items-center gap-2">
                                <Dot />
                                {t('shifts.startedAt', { time: startTime })}
                            </span>
                            <span className="flex items-center gap-2 font-semibold tabular-nums text-ink dark:text-white">
                                <Dot />
                                {durationLabel}
                            </span>
                        </p>
                    </div>
                </div>
                {/* Desktop: a single click ends — no confirm. */}
                <EndShiftButton
                    busy={isEnding}
                    onClick={onEnd}
                    label={t('shifts.end')}
                    busyLabel={t('shifts.ending')}
                />
            </div>

            {/* --- MOBILE STICKY: swipe to end --- */}
            <div className="fixed bottom-[calc(3.5rem+env(safe-area-inset-bottom))] left-0 right-0 z-50 border-t border-white/70 bg-white/70 px-3 py-2.5 backdrop-blur-xl dark:border-white/5 dark:bg-slate-950/70 md:hidden">
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

/** Mid-dot separator for the shift detail line. */
function Dot() {
    return <span aria-hidden className="size-1 shrink-0 rounded-full bg-ink-soft/40 dark:bg-slate-500" />;
}

/**
 * The signature: an accent clock tile with a slow breathing glow — "you're on
 * the clock". In the lilac scheme the 300→500 ramp reads as lavender→violet.
 * Static under reduced motion.
 */
function ShiftClockGlow() {
    return (
        <div className="relative shrink-0">
            <span
                aria-hidden
                className="absolute -inset-0.5 rounded-2xl bg-emerald-400/60 blur-lg animate-glow-breathe motion-reduce:animate-none"
            />
            <div className="relative flex size-10 items-center justify-center rounded-xl bg-linear-to-br from-emerald-300 to-emerald-500 text-white shadow-md shadow-emerald-500/30 ring-1 ring-white/50">
                <LiveClockIcon className="size-5" isActive={true} />
            </div>
        </div>
    );
}

/**
 * Compact crimson end action — a top-lit gradient with an inset highlight and a
 * soft coloured shadow, sized to the content rather than spanning the card.
 */
function EndShiftButton({
    busy,
    onClick,
    label,
    busyLabel,
}: {
    busy: boolean;
    onClick: () => void;
    label: string;
    busyLabel: string;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={busy}
            className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl bg-linear-to-b from-rose-500 to-rose-600 px-3.5 text-meta font-semibold text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.25),0_6px_16px_-6px_rgb(225_29_72/0.6)] transition-all hover:brightness-105 active:scale-[0.98] disabled:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
        >
            {busy ? (
                <span className="size-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
            ) : (
                <StopIcon weight="fill" className="size-3.5" />
            )}
            {busy ? busyLabel : label}
        </button>
    );
}

/**
 * Swipe-to-confirm control for ending a shift on touch. A crimson thumb the user
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
    const THUMB = 44;
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
            className="relative h-12 select-none overflow-hidden rounded-xl bg-rose-500/10 dark:bg-rose-500/15"
        >
            {/* progress fill trailing the thumb */}
            <motion.div
                style={{ width: fillWidth }}
                className="pointer-events-none absolute inset-y-1 left-0 rounded-2xl bg-rose-500/20"
            />
            {/* centred label (stays visible while ending) */}
            <motion.span
                style={{ opacity: busy ? 1 : labelOpacity }}
                className="pointer-events-none absolute inset-0 flex items-center justify-center gap-2 text-body-strong text-rose-600 dark:text-rose-400"
            >
                {busy ? busyLabel : label}
                {!busy && <CaretDoubleRightIcon weight="bold" className="size-4" />}
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
                    className="absolute bottom-1 left-1 top-1 flex cursor-grab touch-none items-center justify-center rounded-lg bg-linear-to-b from-rose-500 to-rose-600 text-white shadow-md shadow-rose-500/30 active:cursor-grabbing"
                >
                    <StopIcon weight="fill" className="size-5" />
                </motion.div>
            )}
        </div>
    );
}
