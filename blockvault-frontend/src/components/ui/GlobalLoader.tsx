import { FC } from 'react';
import { useLoading } from '@/contexts/LoadingContext';
import { SecureLoader } from './SecureLoader';

export const GlobalLoader: FC = () => {
    const { isLoading, loadingMessage } = useLoading();

    if (!isLoading) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center backdrop-blur-md bg-background/60 transition-all duration-300">
            <div className="flex flex-col items-center justify-center space-y-6 max-w-sm w-full p-8 rounded-2xl bg-card/50 border border-white/5 shadow-2xl animate-in zoom-in duration-300">
                <SecureLoader size={64} />

                {loadingMessage && (
                    <div className="text-center space-y-2 animate-in fade-in slide-in-from-bottom-2 duration-500 delay-150">
                        <p className="text-sm font-medium text-foreground max-w-[250px] mx-auto tracking-wide">
                            {loadingMessage}
                        </p>
                        <div className="h-1 w-32 bg-secondary rounded-full overflow-hidden mx-auto">
                            <div className="h-full bg-blue-500/50 w-full animate-[progress_1.5s_ease-in-out_infinite]" style={{ transformOrigin: '0% 50%' }} />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
