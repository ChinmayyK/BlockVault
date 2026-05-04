import { FC } from 'react';

export const DocumentSkeleton: FC = () => {
    return (
        <div className="w-full h-full min-h-[600px] flex flex-col items-center justify-center p-8 bg-muted/5 rounded-lg border border-border/50">
            <div className="w-full max-w-3xl aspect-[1/1.4] bg-muted/20 rounded shadow-sm relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full animate-[shimmer_2s_infinite]" />

                <div className="p-12 space-y-8">
                    <div className="h-8 w-1/3 bg-muted/30 rounded animate-pulse mx-auto" />

                    <div className="space-y-4">
                        <div className="h-4 w-full bg-muted/20 rounded animate-pulse" />
                        <div className="h-4 w-5/6 bg-muted/20 rounded animate-pulse" />
                        <div className="h-4 w-4/6 bg-muted/20 rounded animate-pulse" />
                        <div className="h-4 w-full bg-muted/20 rounded animate-pulse" />
                        <div className="h-4 w-3/4 bg-muted/20 rounded animate-pulse" />
                    </div>

                    <div className="space-y-4 pt-12">
                        <div className="h-4 w-full bg-muted/20 rounded animate-pulse" />
                        <div className="h-4 w-5/6 bg-muted/20 rounded animate-pulse" />
                        <div className="h-4 w-1/2 bg-muted/20 rounded animate-pulse" />
                    </div>
                </div>
            </div>
        </div>
    );
};
