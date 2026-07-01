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
 * guides the user forward — it opens the location picker and hints why — so
 * there's always a next step.
 */
export function CheckIn() {
    const { selectedLocationId, activeShift, handleStartShift, isStarting } = useShiftContext();
    const t = useTranslation();

    // If a shift is already running, we don't show the check-in button.
    if (activeShift) return null;

    const onStartShiftClick = () => {
        if (!selectedLocationId) {
            // Guide, don't block. On mobile this opens the location sheet (feedback
            // enough on its own). On desktop nothing is subscribed, so fall back to
            // a toast explaining why — never a silent no-op.
            haptics.error();
            const opened = openLocationPicker();
            if (!opened) toast(t('shifts.selectLocation'), 'info');
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
                    onClick={onStartShiftClick}
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
                    onClick={onStartShiftClick}
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
