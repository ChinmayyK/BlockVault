import { FC, useEffect, useState } from 'react';

interface RedactionProgressProps {
    stage: 'analyzing' | 'detecting' | 'applying' | 'generating' | 'complete';
}

export const RedactionProgress: FC<RedactionProgressProps> = ({ stage }) => {
    const stages = [
        { id: 'analyzing', label: 'Analyzing document', blocks: 1 },
        { id: 'detecting', label: 'Detecting sensitive entities', blocks: 2 },
        { id: 'applying', label: 'Applying redactions', blocks: 4 },
        { id: 'generating', label: 'Generating zero-knowledge proof', blocks: 5 },
        { id: 'complete', label: 'Processing complete', blocks: 6 }
    ];

    const currentIndex = stages.findIndex(s => s.id === stage);
    const activeStage = stages[currentIndex > -1 ? currentIndex : 0];

    // Smooth visual progression
    const [displayBlocks, setDisplayBlocks] = useState(0);

    useEffect(() => {
        const targetBlocks = activeStage.blocks;
        const interval = setInterval(() => {
            setDisplayBlocks(prev => {
                if (prev < targetBlocks) return prev + 1;
                if (prev > targetBlocks) return prev - 1;
                return prev;
            });
        }, 150);
        return () => clearInterval(interval);
    }, [activeStage.blocks]);

    const renderBlocks = () => {
        const total = 6;
        const blocks = [];
        for (let i = 0; i < total; i++) {
            blocks.push(
                <div
                    key={i}
                    className={`w-3 h-4 rounded-sm transition-all duration-300 ${i < displayBlocks
                            ? 'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)]'
                            : 'bg-muted/30'
                        }`}
                />
            );
        }
        return blocks;
    };

    return (
        <div className="flex flex-col items-center justify-center p-6 space-y-4 rounded-xl border border-border bg-card/50">
            <div className="text-sm font-medium text-muted-foreground animate-pulse">
                {activeStage.label}...
            </div>

            <div className="flex items-center gap-1.5 font-mono text-xs">
                <span className="text-muted-foreground mr-2">[</span>
                {renderBlocks()}
                <span className="text-muted-foreground ml-2">]</span>
            </div>
        </div>
    );
};
