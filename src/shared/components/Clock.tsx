import { useState, useEffect } from 'react';

/**
 * --- CLOCK COMPONENT ---
 * This simple component displays the current time.
 * It's generic, meaning it can be used anywhere (Shared).
 * 
 * Props:
 * - className: Optional CSS classes.
 * - seconds: Boolean - If true, it shows HH:MM:SS. If false, just HH:MM.
 */

interface ClockProps {
    className?: string;
    seconds: boolean;
}

export function Clock({ className = "", seconds }: ClockProps) {
    // 1. STATE: We store the current date object.
    const [time, setTime] = useState(() => new Date());

    // 2. EFFECT: We set up an interval to update the time every second (1000ms).
    useEffect(() => {
        const timer = setInterval(() => {
            setTime(new Date());
        }, 1000);

        // 3. CLEANUP: When the component is removed, we MUST clear the timer.
        return () => clearInterval(timer);
    }, []);

    // 4. RENDER: We format the time for humans.
    return (
        <span className={className}>
            {
                !seconds
                    ? time.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
                    : time.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
            }
        </span>
    );
}
