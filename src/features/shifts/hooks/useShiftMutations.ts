import { useMutation, useQueryClient } from '@tanstack/react-query';
import { shiftService } from '../shiftService';
import { toast } from '@shared/toast/toastStore';
import { type Shift, type ShiftWithProfile, type User } from '@shared/types';
import { shiftKeys } from '../shiftKeys';

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

    const reconcileActiveBoard = () => {
        qc.invalidateQueries({ queryKey: activeKey });
        qc.invalidateQueries({ queryKey: boardKey });
    };

    const startShift = useMutation({
        mutationFn: (locationId: string) => {
            if (!user) throw new Error('You must be signed in to start a shift.');
            return shiftService.startShift(user, locationId);
        },
        onMutate: async (locationId) => {
            if (!user) return {};
            await qc.cancelQueries({ queryKey: boardKey });
            const prevBoard = qc.getQueryData<ShiftWithProfile[]>(boardKey);
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
            return { prevBoard };
        },
        onError: (err, _vars, ctx) => {
            if (ctx?.prevBoard) qc.setQueryData(boardKey, ctx.prevBoard);
            toast(err instanceof Error ? err.message : 'Could not start your shift. Please try again.');
        },
        onSuccess: (shift) => {
            qc.setQueryData<Shift | null>(activeKey, shift);
        },
        onSettled: reconcileActiveBoard,
    });

    const endShift = useMutation({
        mutationFn: (shiftId: string) => shiftService.endShift(shiftId),
        onMutate: async (shiftId) => {
            await qc.cancelQueries({ queryKey: boardKey });
            const prevBoard = qc.getQueryData<ShiftWithProfile[]>(boardKey);
            const prevActive = qc.getQueryData<Shift | null>(activeKey);
            qc.setQueryData<ShiftWithProfile[]>(boardKey, (b = []) => b.filter((s) => s.id !== shiftId));
            qc.setQueryData<Shift | null>(activeKey, null);
            return { prevBoard, prevActive };
        },
        onError: (err, _vars, ctx) => {
            if (ctx?.prevBoard) qc.setQueryData(boardKey, ctx.prevBoard);
            if (ctx?.prevActive !== undefined) qc.setQueryData(activeKey, ctx.prevActive);
            toast(err instanceof Error ? err.message : 'Could not end your shift. Please try again.');
        },
        onSettled: () => {
            reconcileActiveBoard();
            qc.invalidateQueries({ queryKey: historyKey });
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
            const prevActive = qc.getQueryData<Shift | null>(activeKey);
            const prevBoard = qc.getQueryData<ShiftWithProfile[]>(boardKey);
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
            return { prevActive, prevBoard };
        },
        onError: (err, _vars, ctx) => {
            if (ctx?.prevActive !== undefined) qc.setQueryData(activeKey, ctx.prevActive);
            if (ctx?.prevBoard) qc.setQueryData(boardKey, ctx.prevBoard);
            toast(err instanceof Error ? err.message : 'Could not change location. Please try again.');
        },
        onSettled: reconcileActiveBoard,
    });

    return { startShift, endShift, changeLocation };
}
