import { useMutation, useQueryClient } from '@tanstack/react-query';
import { shiftService } from '../shiftService';
import { toast } from '@shared/toast/toastStore';
import { type Shift, type ShiftWithProfile, type User } from '@shared/types';
import { shiftKeys } from '../shiftKeys';
import type { ActiveShiftStatus } from '../shiftService';

/**
 * --- useShiftMutations ---
 * The three shift actions as React Query mutations with optimistic updates and
 * rollback. This replaces the old hand-rolled isStarting/isEnding/... booleans
 * and per-action try/catch: `isPending` guards double-submits, `onError` rolls
 * the cache back to the pre-action snapshot and surfaces a toast, and
 * `onSettled` reconciles with the server.
 */
export function useShiftMutations(user: User | null) {
    const qc = useQueryClient();
    const boardKey = shiftKeys.board(user?.organization_id ?? 'anon');
    const activeKey = shiftKeys.active(user?.id ?? 'anon');
    const historyKey = shiftKeys.history(user?.id ?? 'anon');
    const locationsKey = user ? shiftKeys.locations(user.organization_id) : null;

    const reconcileActiveBoard = () => {
        qc.invalidateQueries({ queryKey: activeKey });
        qc.invalidateQueries({ queryKey: boardKey });
        if (user) qc.invalidateQueries({ queryKey: ['shift-status', user.id] });
    };

    const startShift = useMutation({
        mutationFn: (locationId: string) => {
            if (!user) throw new Error('You must be signed in to start a shift.');
            return shiftService.startShift(user, locationId);
        },
        onMutate: async (locationId) => {
            if (!user) return {};
            await qc.cancelQueries({ queryKey: boardKey });
            await qc.cancelQueries({ queryKey: ['shift-status', user.id] });
            const prevBoard = qc.getQueryData<ShiftWithProfile[]>(boardKey);
            const prevStatus = qc.getQueryData(['shift-status', user.id]);

            const optimistic: ShiftWithProfile = {
                id: `optimistic-${Date.now()}`,
                user_id: user.id,
                location_id: locationId,
                previous_location_id: null,
                organization_id: user.organization_id,
                started_at: new Date().toISOString(),
                ended_at: null,
                role: user.role.name,
                profiles: {
                    username: user.username,
                    first_name: user.first_name,
                    last_name: user.last_name,
                },
            };
            qc.setQueryData<ShiftWithProfile[]>(boardKey, (b = []) => [...b, optimistic]);

            // Optimistic status for profile badges (with location name from cache if available)
            let locName: string | null = null;
            if (locationsKey) {
                const locs = qc.getQueryData<any[]>(locationsKey) || [];
                const found = locs.find((l: any) => l.id === locationId);
                locName = found?.name ?? null;
            }
            const optimisticStatus = {
                started_at: new Date().toISOString(),
                location_id: locationId,
                location_name: locName,
            };
            qc.setQueryData(['shift-status', user.id], optimisticStatus);

            return { prevBoard, prevStatus };
        },
        onError: (err, _vars, ctx) => {
            if (ctx?.prevBoard) qc.setQueryData(boardKey, ctx.prevBoard);
            if (ctx?.prevStatus !== undefined && user) {
                qc.setQueryData(['shift-status', user.id], ctx.prevStatus);
            }
            toast(err instanceof Error ? err.message : 'Could not start your shift. Please try again.');
        },
        onSuccess: (shift) => {
            qc.setQueryData<Shift | null>(activeKey, shift);
            if (user) qc.invalidateQueries({ queryKey: ['shift-status', user.id] });
        },
        onSettled: reconcileActiveBoard,
    });

    const endShift = useMutation({
        mutationFn: (shiftId: string) => shiftService.endShift(shiftId),
        onMutate: async (shiftId) => {
            await qc.cancelQueries({ queryKey: boardKey });
            await qc.cancelQueries({ queryKey: ['shift-status', user?.id ?? 'anon'] });
            const prevBoard = qc.getQueryData<ShiftWithProfile[]>(boardKey);
            const prevActive = qc.getQueryData<Shift | null>(activeKey);
            const prevStatus = user ? qc.getQueryData<ActiveShiftStatus | null>(['shift-status', user.id]) : null;

            qc.setQueryData<ShiftWithProfile[]>(boardKey, (b = []) => b.filter((s) => s.id !== shiftId));
            qc.setQueryData<Shift | null>(activeKey, null);
            if (user) qc.setQueryData(['shift-status', user.id], null);

            return { prevBoard, prevActive, prevStatus };
        },
        onError: (err, _vars, ctx) => {
            if (ctx?.prevBoard) qc.setQueryData(boardKey, ctx.prevBoard);
            if (ctx?.prevActive !== undefined) qc.setQueryData(activeKey, ctx.prevActive);
            if (ctx?.prevStatus !== undefined && user) {
                qc.setQueryData(['shift-status', user.id], ctx.prevStatus);
            }
            toast(err instanceof Error ? err.message : 'Could not end your shift. Please try again.');
        },
        onSettled: () => {
            reconcileActiveBoard();
            qc.invalidateQueries({ queryKey: historyKey });
            if (user) qc.invalidateQueries({ queryKey: ['shift-status', user.id] });
        },
    });

    const changeLocation = useMutation({
        mutationFn: ({ shiftId, newLocationId, previousLocationId }: {
            shiftId: string;
            newLocationId: string;
            previousLocationId: string | null;
        }) => shiftService.changeShiftLocation(shiftId, newLocationId, previousLocationId),
        onMutate: async ({ shiftId, newLocationId, previousLocationId }) => {
            await qc.cancelQueries({ queryKey: activeKey });
            await qc.cancelQueries({ queryKey: ['shift-status', user?.id ?? 'anon'] });
            const prevActive = qc.getQueryData<Shift | null>(activeKey);
            const prevBoard = qc.getQueryData<ShiftWithProfile[]>(boardKey);
            const prevStatus = user ? qc.getQueryData<ActiveShiftStatus | null>(['shift-status', user.id]) : null;

            qc.setQueryData<Shift | null>(activeKey, (s) =>
                s ? { ...s, location_id: newLocationId, previous_location_id: previousLocationId } : s,
            );
            qc.setQueryData<ShiftWithProfile[]>(boardKey, (b = []) =>
                b.map((s) =>
                    s.id === shiftId
                        ? { ...s, location_id: newLocationId, previous_location_id: previousLocationId }
                        : s,
                ),
            );

            if (user && prevStatus) {
                let locName: string | null = prevStatus.location_name;
                if (locationsKey) {
                    const locs = qc.getQueryData<any[]>(locationsKey) || [];
                    const found = locs.find((l: any) => l.id === newLocationId);
                    locName = found?.name ?? locName;
                }
                qc.setQueryData(['shift-status', user.id], {
                    ...prevStatus,
                    location_id: newLocationId,
                    location_name: locName,
                });
            }

            return { prevActive, prevBoard, prevStatus };
        },
        onError: (err, _vars, ctx) => {
            if (ctx?.prevActive !== undefined) qc.setQueryData(activeKey, ctx.prevActive);
            if (ctx?.prevBoard) qc.setQueryData(boardKey, ctx.prevBoard);
            if (ctx?.prevStatus !== undefined && user) {
                qc.setQueryData(['shift-status', user.id], ctx.prevStatus);
            }
            toast(err instanceof Error ? err.message : 'Could not change location. Please try again.');
        },
        onSettled: reconcileActiveBoard,
    });

    return { startShift, endShift, changeLocation };
}
