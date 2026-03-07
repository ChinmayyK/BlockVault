import { FC } from 'react';

export const FileListSkeleton: FC<{ count?: number }> = ({ count = 3 }) => {
    return (
        <div className="space-y-4">
            {Array.from({ length: count }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 p-4 rounded-xl border border-border bg-card/50">
                    <div className="w-10 h-10 rounded bg-muted animate-pulse shrink-0" />
                    <div className="flex-1 space-y-2">
                        <div className="h-4 w-1/3 bg-muted rounded animate-pulse" />
                        <div className="h-3 w-1/4 bg-muted/60 rounded animate-pulse" />
                    </div>
                    <div className="w-24 h-8 rounded bg-muted animate-pulse shrink-0" />
                    <div className="w-8 h-8 rounded bg-muted animate-pulse shrink-0" />
                </div>
            ))}
        </div>
    );
};
