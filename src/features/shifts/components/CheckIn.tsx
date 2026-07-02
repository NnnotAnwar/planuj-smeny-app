import { PlayIcon } from '@phosphor-icons/react';
import { useShiftContext } from '../ShiftContext';
import { useTranslation } from '@shared/preferences/PreferencesContext';
import { haptics } from '@shared/utils/haptics';
import { Button } from '@shared/components/Button';
import { toast } from '@shared/toast/toastStore';
import { openLocationPicker } from '@features/locations/locationPickerSignal';

/**
 * --- CHECK-IN COMPONENT ---
 * The "Start Shift" button, shown only when the user has no active shift.
 *
 * UX: the button is never disabled for a missing location (a dead, unexplained
 * button is a classic dead-end). Instead, tapping it with nothing selected
 * guides the user forward — so there's always a next step.
 *
 * Desktop and mobile are separate buttons (CSS-toggled), and the location
 * picker lives in different places: a bottom sheet on mobile, the sidebar on
 * desktop. The mobile field stays mounted-but-hidden on desktop, so we can't
 * infer context from "is a picker subscribed" — each button passes its own
 * guide explicitly (`sheet` opens the mobile sheet; `hint` shows a toast).
 */
export function CheckIn() {
    const { selectedLocationId, activeShift, handleStartShift, isStarting } = useShiftContext();
    const t = useTranslation();

    // If a shift is already running, we don't show the check-in button.
    if (activeShift) return null;

    const attemptStart = (guide: 'sheet' | 'hint') => {
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

    return (
        <>
            {/* --- DESKTOP --- */}
            <div className="mb-8 hidden justify-center md:flex">
                <Button
                    size="lg"
                    icon={PlayIcon}
                    iconWeight="fill"
                    loading={isStarting}
                    onClick={() => attemptStart('hint')}
                    className="px-10"
                >
                    {label}
                </Button>
            </div>

            {/* --- MOBILE STICKY --- */}
            <div className="fixed bottom-[calc(4rem+env(safe-area-inset-bottom))] left-0 right-0 z-50 bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl p-4 shadow-2xl md:hidden transition-all duration-300">
                <Button
                    size="xl"
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
                    <p className="mt-2 text-center text-xs text-gray-500 dark:text-gray-300 font-medium">
                        {t('shifts.selectLocation')}
                    </p>
                )}
            </div>
        </>
    );
}
