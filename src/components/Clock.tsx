import { useState, useEffect } from 'react';

interface ClockProps {
    className?: string;
}

export default function Clock({ className = "" }: ClockProps) {
    const [time, setTime] = useState(() => new Date());

    useEffect(() => {
        const timer = setInterval(() => setTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    return (
        <span className={className}>
            {time.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
        </span>
    );
}