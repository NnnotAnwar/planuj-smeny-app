import { useCallback, useEffect, useLayoutEffect, useState, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { useShiftContext } from '@features/shifts/ShiftContext';
import { useRecentLocations } from '../useRecentLocations';
import { LocationPicker } from './LocationPicker';

const PANEL_WIDTH = 288; // w-72
const PANEL_MAX_HEIGHT = 420;

/**
 * --- LOCATION PICKER POPOVER ---
 * The shared LocationPicker in a floating glass panel anchored under any trigger
 * (e.g. the dashboard's shift clock), so a location can be chosen right where the
 * user is looking. Controlled by the caller (`open` / `onClose`) so a button
 * elsewhere — like "Start shift" with nothing picked — can open it too.
 * Selection goes through the caller's `onSelect`, i.e. the same confirm/switch
 * flow as the sidebar picker.
 */
export function LocationPickerPopover({
    open,
    onClose,
    anchorRef,
    onSelect,
}: {
    open: boolean;
    onClose: () => void;
    anchorRef: RefObject<HTMLElement | null>;
    onSelect: (locationId: string) => void;
}) {
    const { locations, selectedLocationId, activeShift } = useShiftContext();
    const { recentIds, recordPick } = useRecentLocations();
    const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

    // Below the trigger, left-aligned to it, clamped inside the viewport.
    const place = useCallback(() => {
        const r = anchorRef.current?.getBoundingClientRect();
        if (!r) return;
        const left = Math.min(Math.max(8, r.left), window.innerWidth - PANEL_WIDTH - 8);
        const top = Math.max(8, Math.min(r.bottom + 8, window.innerHeight - PANEL_MAX_HEIGHT - 8));
        setPos({ left, top });
    }, [anchorRef]);

    useLayoutEffect(() => {
        if (open) place();
    }, [open, place]);

    useEffect(() => {
        if (!open) return;
        const onMove = () => place();
        const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
        window.addEventListener('resize', onMove);
        window.addEventListener('scroll', onMove, true);
        window.addEventListener('keydown', onKey);
        return () => {
            window.removeEventListener('resize', onMove);
            window.removeEventListener('scroll', onMove, true);
            window.removeEventListener('keydown', onKey);
        };
    }, [open, place, onClose]);

    if (!open || !pos) return null;

    return createPortal(
        <>
            <div className="fixed inset-0 z-59" onClick={onClose} />
            <motion.div
                initial={{ opacity: 0, y: -6, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.15, ease: 'easeOut' }}
                role="dialog"
                className="glass glass-menu fixed z-60 flex w-72 max-h-[420px] flex-col rounded-2xl p-2"
                style={{ left: pos.left, top: pos.top }}
            >
                <LocationPicker
                    locations={locations}
                    selectedLocationId={selectedLocationId}
                    recentIds={recentIds}
                    isOnShift={!!activeShift}
                    onSelect={(id) => {
                        recordPick(id);
                        onSelect(id);
                        onClose();
                    }}
                />
            </motion.div>
        </>,
        document.body,
    );
}
