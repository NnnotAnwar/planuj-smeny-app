import { useEffect, useState } from 'react';

/**
 * --- useElapsed ---
 * Live elapsed time since an ISO timestamp, for the "how long have I been on
 * shift" readout. Returns hours/minutes and re-renders on a coarse interval
 * (30 s by default) so the number feels live without burning battery ticking
 * every second. Returns null when there's nothing to count.
 */
export function useElapsed(startIso?: string | null, tickMs = 30_000) {
    const [now, setNow] = useState(() => Date.now());

    useEffect(() => {
        if (!startIso) return;
        const id = setInterval(() => setNow(Date.now()), tickMs);
        return () => clearInterval(id);
    }, [startIso, tickMs]);

    if (!startIso) return null;

    const totalMinutes = Math.max(0, Math.floor((now - new Date(startIso).getTime()) / 60_000));
    return { hours: Math.floor(totalMinutes / 60), minutes: totalMinutes % 60, totalMinutes };
}
