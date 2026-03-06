import { useState, useEffect } from 'react';

interface LiveClockIconProps {
    className?: string;
    isActive?: boolean;
}

export default function LiveClockIcon({ className = 'h-6 w-6', isActive = true }: LiveClockIconProps) {
    const [degrees, setDegrees] = useState(() => new Date().getSeconds() * 6);

    useEffect(() => {
        if (!isActive) return;

        const timer = setInterval(() => {
            const currentSeconds = new Date().getSeconds();

            setDegrees((prevDegrees) => {
                const currentMod = prevDegrees % 360;
                const targetMod = currentSeconds * 6;

                let diff = targetMod - currentMod;

                if (diff < 0) {
                    diff += 360;
                }

                return prevDegrees + diff;
            });
        }, 1000);

        return () => clearInterval(timer);
    }, [isActive]);

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