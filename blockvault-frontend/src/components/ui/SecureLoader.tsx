import { FC } from 'react';
import { Hexagon } from 'lucide-react';

export const SecureLoader: FC<{ className?: string, size?: number }> = ({ className = '', size = 48 }) => {
    return (
        <div className={`relative flex items-center justify-center ${className}`} style={{ width: size, height: size }}>
            {/* Outer rotating hexagon with glow */}
            <div className="absolute inset-0 animate-spin-slow" style={{ animationDuration: '4s' }}>
                <Hexagon
                    className="w-full h-full text-blue-500/20 drop-shadow-[0_0_8px_rgba(59,130,246,0.6)]"
                    strokeWidth={1}
                />
            </div>

            {/* Inner pulsing hexagon */}
            <div className="absolute inset-2 animate-pulse" style={{ animationDuration: '2s' }}>
                <Hexagon
                    className="w-full h-full text-blue-400/50"
                    strokeWidth={1.5}
                />
            </div>

            {/* Core dot */}
            <div className="w-2 h-2 bg-blue-400 rounded-full shadow-[0_0_10px_rgba(96,165,250,1)] animate-pulse" />
        </div>
    );
};
