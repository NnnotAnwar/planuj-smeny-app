import { useEffect, useRef, useState } from 'react';
import { haptics } from '@shared/utils/haptics';

/**
 * --- PULL TO REFRESH ---
 * Touch-driven pull-to-refresh for the page (window scroll). Engages only when
 * the page is scrolled to the very top and the user drags down; past the
 * threshold on release it runs `onRefresh`. Returns the live pull distance and
 * refreshing flag so the caller can render an indicator. No content transform —
 * so it never breaks position:fixed children (e.g. the sticky action button).
 *
 * Touch-only by nature, so it's inert on desktop (mouse) without extra gating.
 */
export function usePullToRefresh(
    onRefresh: () => Promise<void>,
    { threshold = 70, max = 90 }: { threshold?: number; max?: number } = {},
) {
    const [pull, setPull] = useState(0);
    const [refreshing, setRefreshing] = useState(false);

    const pullRef = useRef(0);
    const refreshingRef = useRef(false);
    const startY = useRef<number | null>(null);
    const onRefreshRef = useRef(onRefresh);

    useEffect(() => {
        onRefreshRef.current = onRefresh;
    });

    useEffect(() => {
        const setPullBoth = (v: number) => {
            pullRef.current = v;
            setPull(v);
        };

        const onStart = (e: TouchEvent) => {
            if (refreshingRef.current) return;
            startY.current = window.scrollY <= 0 ? e.touches[0].clientY : null;
        };

        const onMove = (e: TouchEvent) => {
            if (startY.current === null || refreshingRef.current) return;
            const dy = e.touches[0].clientY - startY.current;
            if (dy > 0 && window.scrollY <= 0) {
                setPullBoth(Math.min(dy * 0.5, max));
            } else {
                setPullBoth(0);
            }
        };

        const onEnd = async () => {
            if (startY.current === null) return;
            const reached = pullRef.current >= threshold;
            startY.current = null;
            if (!reached) {
                setPullBoth(0);
                return;
            }
            refreshingRef.current = true;
            haptics.medium();
            setRefreshing(true);
            setPullBoth(threshold);
            try {
                await onRefreshRef.current();
            } finally {
                refreshingRef.current = false;
                setRefreshing(false);
                setPullBoth(0);
            }
        };

        window.addEventListener('touchstart', onStart, { passive: true });
        window.addEventListener('touchmove', onMove, { passive: true });
        window.addEventListener('touchend', onEnd);
        return () => {
            window.removeEventListener('touchstart', onStart);
            window.removeEventListener('touchmove', onMove);
            window.removeEventListener('touchend', onEnd);
        };
    }, [threshold, max]);

    return { pull, refreshing, threshold };
}
