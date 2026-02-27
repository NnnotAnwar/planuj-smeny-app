import { useState, useEffect } from 'react';

interface ClockProps {
    className?: string;
    seconds: boolean
}

export default function Clock({ className = "", seconds }: ClockProps) {
    const [time, setTime] = useState(() => new Date());


    useEffect(() => {
        const timer = setInterval(() => setTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);


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