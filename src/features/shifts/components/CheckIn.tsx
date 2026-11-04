import { useRef, useState } from 'react';
import { PlayIcon } from '@phosphor-icons/react';
import { useShiftContext } from '../ShiftContext';
import { useTranslation } from '@shared/preferences/PreferencesContext';
import { haptics } from '@shared/utils/haptics';
import { Button } from '@shared/components/Button';
import { LiveClockIcon } from '@shared/components/LiveClockIcon';
import { toast } from '@shared/toast/toastStore';
import { openLocationPicker } from '@features/locations/locationPickerSignal';
import { LocationPickerPopover } from '@features/locations/components/LocationPickerPopover';
import { useOnline } from '@shared/hooks/useOnline';

/**
 * --- CHECK-IN COMPONENT ---
 * The "Start Shift" action, shown only when the user has no active shift.
 *
 * UX: the button is never disabled for a missing location (a dead, unexplained
 * button is a classic dead-end). Instead, tapping it with nothing selected
 * guides the user forward — so there's always a next step.
 *
 * Desktop renders an idle card that mirrors the Active Shift card (same slot,
 * same shape, muted clock) so starting a shift reads as one card waking up.
 * The clock is the location picker: tapping it (or the title) opens the picker
 * right under it, and while nothing is picked a blinking ring points at it.
 * Desktop and mobile are separate (CSS-toggled), and the location picker lives
 * in different places: a bottom sheet on mobile, the sidebar on desktop. The
 * mobile field stays mounted-but-hidden on desktop, so we can't infer context
 * from "is a picker subscribed" — each button passes its own guide explicitly
 * (`sheet` opens the mobile sheet; `hint` shows a toast). On desktop Start
 * never opens the picker for you: the toast + blinking ring point the way and
 * the person picks the location themselves.
 */
export function CheckIn({ onPickLocation }: { onPickLocation?: (locationId: string) => void }) {
    const { selectedLocationId, activeShift, handleStartShift, isStarting, locations } = useShiftContext();
    const t = useTranslation();
    const online = useOnline();
    const [pickerOpen, setPickerOpen] = useState(false);
    const pickerAnchor = useRef<HTMLButtonElement>(null);

    // If a shift is already running, we don't show the check-in button.
    if (activeShift) return null;

    const attemptStart = (guide: 'sheet' | 'hint') => {
        // Starting a shift needs the server — block it (with a reason) while offline.
        if (!online) {
            haptics.error();
            toast(t('offline.cantStart'), 'error');
            return;
        }
        if (!selectedLocationId) {
            haptics.error();
            if (guide === 'sheet') openLocationPicker();
            else toast(t('shifts.selectLocation'), 'info');
            return;
        }
        haptics.heavy();
        handleStartShift();
    };

    const label = isStarting ? t('shifts.starting') : t('shifts.start');
    const selectedName = locations.find((l) => l.id === selectedLocationId)?.name;

    return (
        <>
            {/* --- DESKTOP: idle card --- */}
            <div className="glass mb-3 hidden items-center justify-between gap-4 rounded-2xl p-3.5 md:flex">
                {/* Clock + title = one big location-picker target. */}
                <button
                    ref={pickerAnchor}
                    type="button"
                    onClick={() => setPickerOpen(true)}
                    className="group flex min-w-0 items-center gap-3 rounded-xl text-left focus-visible:outline-none"
                >
                    <span className="relative flex size-10 shrink-0 items-center justify-center rounded-xl bg-ink/5 text-ink-soft ring-1 ring-ink/5 transition-colors group-hover:bg-emerald-500/10 group-hover:text-emerald-600 group-focus-visible:ring-2 group-focus-visible:ring-emerald-500 dark:bg-white/6 dark:text-slate-400 dark:ring-white/8 dark:group-hover:text-emerald-300">
                        {/* Nothing picked yet → a blinking ring says "start here". */}
                        {!selectedName && (
                            <span
                                aria-hidden
                                className="pointer-events-none absolute -inset-1 rounded-2xl ring-2 ring-emerald-500 animate-hint-blink motion-reduce:animate-none"
                            />
                        )}
                        <LiveClockIcon className="size-5" isActive={false} />
                    </span>
                    <span className="min-w-0">
                        <span className="block text-eyebrow text-ink-soft dark:text-slate-400">{t('shifts.noActive')}</span>
                        <span className="mt-1 block truncate text-card-title text-ink dark:text-white">
                            {selectedName ?? t('location.select')}
                        </span>
                        <span
                            className={`mt-0.5 block text-meta ${
                                selectedName
                                    ? 'text-emerald-600 group-hover:underline underline-offset-2 dark:text-emerald-300'
                                    : 'text-ink-soft dark:text-slate-400'
                            }`}
                        >
                            {selectedName ? t('location.change') : t('home.pickLocationHint')}
                        </span>
                    </span>
                </button>
                <LocationPickerPopover
                    open={pickerOpen}
                    onClose={() => setPickerOpen(false)}
                    anchorRef={pickerAnchor}
                    onSelect={(id) => onPickLocation?.(id)}
                />
                <button
                    type="button"
                    onClick={() => attemptStart('hint')}
                    disabled={isStarting}
                    className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl bg-linear-to-b from-emerald-500 to-emerald-600 px-3.5 text-meta font-semibold text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.25),0_6px_16px_-6px_var(--color-emerald-500)] transition-all hover:brightness-105 active:scale-[0.98] disabled:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
                >
                    {isStarting ? (
                        <span className="size-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                    ) : (
                        <PlayIcon weight="fill" className="size-3.5" />
                    )}
                    {label}
                </button>
            </div>

            {/* --- MOBILE STICKY --- */}
            <div className="fixed bottom-[calc(3.5rem+env(safe-area-inset-bottom))] left-0 right-0 z-50 border-t border-white/70 bg-white/70 px-3 py-2.5 backdrop-blur-xl transition-all duration-300 dark:border-white/5 dark:bg-slate-950/70 md:hidden">
                <Button
                    size="lg"
                    icon={PlayIcon}
                    iconWeight="fill"
                    loading={isStarting}
                    onClick={() => attemptStart('sheet')}
                    fullWidth
                    className="rounded-2xl"
                >
                    {label}
                </Button>
                {!selectedLocationId && !isStarting && (
                    <p className="mt-1.5 text-center text-xs font-medium text-ink-soft dark:text-slate-300">
                        {t('shifts.selectLocation')}
                    </p>
                )}
            </div>
        </>
    );
}
