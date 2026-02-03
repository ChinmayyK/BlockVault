import { FC, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

export const RouteProgress: FC = () => {
    const [progress, setProgress] = useState(0);
    const [visible, setVisible] = useState(false);
    const location = useLocation();

    useEffect(() => {
        // Start progress when location changes
        setVisible(true);
        setProgress(15);

        const interval = setInterval(() => {
            setProgress(prev => {
                if (prev >= 90) return prev;
                return prev + 5;
            });
        }, 100);

        // Finish progress immediately on next tick after render
        const timeout = setTimeout(() => {
            setProgress(100);
            setTimeout(() => {
                setVisible(false);
                setTimeout(() => setProgress(0), 300);
            }, 300);
        }, 300);

        return () => {
            clearInterval(interval);
            clearTimeout(timeout);
        };
    }, [location.pathname]);

    if (!visible) return null;

    return (
        <div className="fixed top-0 left-0 right-0 h-1 z-[100] overflow-hidden bg-transparent">
            <div
                className="h-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.8)] transition-all ease-out duration-300"
                style={{ width: `${progress}%` }}
            />
        </div>
    );
};
