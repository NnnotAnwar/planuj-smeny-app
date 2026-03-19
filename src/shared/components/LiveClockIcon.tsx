import { useState, useEffect } from 'react';

/**
 * --- LIVE CLOCK ICON ---
 * An animated SVG icon where the "second hand" rotates based on the actual time.
 * 
 * Logic:
 * It calculates degrees (0-360) based on the current second (0-60).
 */

interface LiveClockIconProps {
    className?: string;
    isActive?: boolean;
}

export function LiveClockIcon({ className = 'h-6 w-6', isActive = true }: LiveClockIconProps) {
    // Calculate initial degrees based on the current second (6 degrees per second).
    const [degrees, setDegrees] = useState(() => new Date().getSeconds() * 6);

    useEffect(() => {
        if (!isActive) return;

        // Update every second to keep it in sync.
        const timer = setInterval(() => {
            const currentSeconds = new Date().getSeconds();

            setDegrees((prevDegrees) => {
                const currentMod = prevDegrees % 360;
                const targetMod = currentSeconds * 6;

                let diff = targetMod - currentMod;

                // Handle the wrap-around from 59s to 0s to keep rotation smooth.
                if (diff < 0) {
                    diff += 360;
                }

                return prevDegrees + diff;
            });
        }, 1000);

        return () => clearInterval(timer);
    }, [isActive]);

    // If not active, the clock hands stay at 12:00.
    const finalDegrees = isActive ? degrees : 0;

    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2.5}
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={className}
        >
            <circle cx="12" cy="12" r="9" />
            <path d="M12 12h3" />
            <path
                d="M12 12v-5"
                style={{
                    transform: `rotate(${finalDegrees}deg)`,
                    transformOrigin: '12px 12px',
                    transition: isActive ? 'transform 0.1s linear' : 'none',
                }}
            />
        </svg>
    );
}
