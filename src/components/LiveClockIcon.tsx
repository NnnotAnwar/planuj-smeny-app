import { useState, useEffect } from 'react';

interface LiveClockIconProps {
    className?: string;
    isActive?: boolean; // New prop to control animation
}

export default function LiveClockIcon({ className = 'h-6 w-6', isActive = true }: LiveClockIconProps) {
    const [time, setTime] = useState(() => new Date());

    useEffect(() => {
        // If not active, don't run the timer
        if (!isActive) return;

        const timer = setInterval(() => setTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, [isActive]);

    // If active, get real seconds. If inactive, stick to 0 (points at 12 o'clock)
    const seconds = isActive ? time.getSeconds() : 0;
    const secondDeg = seconds * 6;

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
                    transform: `rotate(${secondDeg}deg)`,
                    transformOrigin: '12px 12px',
                    transition: isActive ? 'transform 0.1s linear' : 'none',
                }}
            />
        </svg>
    );
}