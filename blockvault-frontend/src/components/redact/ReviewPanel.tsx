import React, { useEffect } from "react";
import { Check, X, Edit, Trash2, ArrowLeft, ArrowRight, EyeOff } from "lucide-react";
import { RedactEntity } from "@/types/redactor";
import { Button } from "@/components/ui/button";

interface ReviewPanelProps {
    entities: RedactEntity[];
    currentIndex: number;
    onAccept: () => void;
    onSkip: () => void;
    onPrevious: () => void;
    onNext: () => void;
    onEdit: () => void;
    onFinish: () => void;
    onDelete?: () => void; // Optional if we want to support deleting manual entities from here
}

export function ReviewPanel({
    entities,
    currentIndex,
    onAccept,
    onSkip,
    onPrevious,
    onNext,
    onEdit,
    onFinish,
    onDelete
}: ReviewPanelProps) {
    const currentEntity = entities[currentIndex];
    const total = entities.length;
    const progressPercent = Math.round(((currentIndex + 1) / total) * 100);

    // Provide keyboard shortcut hints
    useEffect(() => {
        // The actual keydown listening happens in RedactPage for broader context capture,
        // but this component just renders the UI.
    }, []);

    if (!currentEntity) return null;

    const isApproved = currentEntity.approved !== false;
    const isManual = currentEntity.entity_type === "MANUAL";

    return (
        <div className="flex h-full w-full flex-col bg-card animate-in slide-in-from-right-8 duration-300">
            {/* Header / Progress */}
            <div className="p-4 border-b bg-muted/10 shrink-0">
                <div className="flex items-center justify-between mb-2">
                    <h2 className="text-lg font-semibold flex items-center gap-2">
                        Redaction Review
                    </h2>
                    <Button variant="ghost" size="sm" onClick={onFinish} className="text-muted-foreground hover:text-foreground">
                        Finish Review
                    </Button>
                </div>
                
                <div className="flex items-center justify-between text-xs text-muted-foreground mb-2 font-medium tracking-wide">
                    <span>Detection {currentIndex + 1} of {total}</span>
                    <span>{progressPercent}%</span>
                </div>
                <div className="h-1.5 w-full bg-border rounded-full overflow-hidden shadow-inner">
                    <div 
                        className="h-full bg-primary rounded-full transition-all duration-300"
                        style={{ width: `${progressPercent}%` }}
                    />
                </div>
            </div>

            {/* Entity Details */}
            <div className="flex-1 p-6 flex flex-col items-center justify-center text-center space-y-6 overflow-y-auto">
                <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 text-primary mb-2 shadow-inner ring-1 ring-primary/20">
                    <EyeOff className="w-8 h-8" />
                </div>
                
                <div>
                    <div className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-muted text-muted-foreground uppercase tracking-wider mb-3">
                        {currentEntity.entity_type || "UNKNOWN"}
                    </div>
                    
                    <h3 className="text-2xl font-bold text-foreground break-words max-w-xs leading-tight">
                        {currentEntity.text || "[Area Redaction]"}
                    </h3>
                    
                    <p className="text-sm text-muted-foreground mt-2 font-medium">
                        Found on Page {currentEntity.page}
                        {currentEntity.score !== undefined && !isManual && (
                            <span className="ml-2 px-1.5 py-0.5 rounded bg-muted">
                                {Math.round(currentEntity.score * 100)}% Match
                            </span>
                        )}
                    </p>
                </div>

                {/* Status Badge */}
                <div className="mt-4">
                    {isApproved ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                            <Check className="w-3.5 h-3.5" />
                            Marked for Redaction
                        </span>
                    ) : (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-500 border border-amber-500/20">
                            <X className="w-3.5 h-3.5" />
                            Skipped
                        </span>
                    )}
                </div>
            </div>

            {/* Action Bar */}
            <div className="p-4 border-t bg-muted/5 shrink-0 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                    <Button 
                        variant="outline" 
                        onClick={onSkip}
                        className="h-12 border-destructive/20 text-destructive hover:bg-destructive/10 hover:text-destructive group relative overflow-hidden"
                    >
                        <X className="w-4 h-4 mr-2" />
                        Skip
                        <kbd className="absolute bottom-1 right-2 text-[10px] text-destructive/50 font-sans tracking-tight">S</kbd>
                    </Button>
                    <Button 
                        variant="default" 
                        onClick={onAccept}
                        className="h-12 bg-primary text-primary-foreground hover:bg-primary/90 shadow-md group relative overflow-hidden"
                    >
                        <Check className="w-4 h-4 mr-2" />
                        Accept
                        <kbd className="absolute bottom-1 right-2 text-[10px] text-primary-foreground/50 font-sans tracking-tight">A</kbd>
                    </Button>
                </div>

                <div className="flex items-center justify-between gap-2 pt-2">
                    <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={onPrevious}
                        disabled={currentIndex === 0}
                        className="h-9 w-9 text-muted-foreground hover:text-foreground shrinks-0"
                        title="Previous (Left Arrow)"
                    >
                        <ArrowLeft className="w-4 h-4" />
                    </Button>
                    
                    <div className="flex flex-1 gap-2">
                        <Button 
                            variant="secondary" 
                            size="sm" 
                            className="flex-1 text-xs gap-1.5"
                            onClick={onEdit}
                        >
                            <Edit className="w-3.5 h-3.5" />
                            Edit Area <kbd className="hidden sm:inline-block ml-1 opacity-50">E</kbd>
                        </Button>
                        
                        {isManual && onDelete && (
                            <Button 
                                variant="outline" 
                                size="sm" 
                                className="flex-1 text-xs text-destructive border-destructive/20 hover:bg-destructive/10 hover:text-destructive"
                                onClick={onDelete}
                            >
                                <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                                Delete
                            </Button>
                        )}
                    </div>
                    
                    <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={onNext}
                        disabled={currentIndex === total - 1}
                        className="h-9 w-9 text-muted-foreground hover:text-foreground shrinks-0"
                        title="Next (Right Arrow)"
                    >
                        <ArrowRight className="w-4 h-4" />
                    </Button>
                </div>
            </div>
        </div>
    );
}
