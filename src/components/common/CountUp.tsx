import React, { useEffect, useState } from 'react';

interface CountUpProps {
    end: number;
    duration?: number;
    decimals?: number;
    suffix?: string;
    prefix?: string;
    separator?: string;
}

export const CountUp: React.FC<CountUpProps> = ({ 
    end, 
    duration = 1000, 
    decimals = 0,
    suffix = '',
    prefix = '',
    separator = ','
}) => {
    const [count, setCount] = useState(0);

    useEffect(() => {
        let startTime: number | null = null;
        let animationFrame: number;

        const animate = (timestamp: number) => {
            if (!startTime) startTime = timestamp;
            const progress = timestamp - startTime;
            const percentage = Math.min(progress / duration, 1);
            
            // Easing function (easeOutExpo)
            const ease = percentage === 1 ? 1 : 1 - Math.pow(2, -10 * percentage);
            
            setCount(ease * end);

            if (progress < duration) {
                animationFrame = requestAnimationFrame(animate);
            }
        };

        animationFrame = requestAnimationFrame(animate);

        return () => cancelAnimationFrame(animationFrame);
    }, [end, duration]);

    const formattedCount = count.toFixed(decimals);
    const [intPart, decPart] = formattedCount.split('.');
    
    // Add separator
    const formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, separator);

    return (
        <span>
            {prefix}{formattedInt}{decimals > 0 ? `.${decPart}` : ''}{suffix}
        </span>
    );
};
