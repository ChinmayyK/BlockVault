import { RedactEntity, ManualRect } from "../../types/redactor";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertCircle, Trash2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EntitySidebarProps {
    entities: RedactEntity[];
    manualBoxes?: ManualRect[];
    onToggleEntity: (id: string, checked: boolean) => void;
    onDeleteManualEntity: (id: string) => void;
    onApplyRedaction: () => void;
    isApplying: boolean;
    hoveredEntityId?: string | null;
    onHoverEntity?: (id: string | null) => void;
    redactionComplete?: boolean;
}

export function EntitySidebar({
    entities,
    manualBoxes = [],
    onToggleEntity,
    onDeleteManualEntity,
    onApplyRedaction,
    isApplying,
    hoveredEntityId,
    onHoverEntity,
    redactionComplete
}: EntitySidebarProps) {

    // Group entities by type and then by term group matching
    const typeGroups = entities.reduce((acc, ent) => {
        const type = ent.entity_type || "UNKNOWN";
        if (!acc[type]) acc[type] = { singletons: [], termGroups: {} };
        
        if (ent.group_id) {
            if (!acc[type].termGroups[ent.group_id]) acc[type].termGroups[ent.group_id] = [];
            acc[type].termGroups[ent.group_id].push(ent);
        } else {
            acc[type].singletons.push(ent);
        }
        return acc;
    }, {} as Record<string, { singletons: RedactEntity[], termGroups: Record<string, RedactEntity[]> }>);

    const handleToggleGroup = (type: string, checked: boolean) => {
        const typeData = typeGroups[type];
        if (!typeData) return;
        
        typeData.singletons.forEach(ent => {
             if (ent.id) onToggleEntity(ent.id, checked);
        });
        Object.values(typeData.termGroups).forEach(group => {
             group.forEach(ent => {
                 if (ent.id) onToggleEntity(ent.id, checked);
             });
        });
    };

    const selectedCount = entities.filter(e => e.approved !== false).length + manualBoxes.length;
    const confidenceWarning = entities.some(e => e.score && e.score < 0.8 && e.approved !== false);

    return (
        <div className="flex h-full w-full min-h-0 flex-col bg-card">
            <div className="p-4 border-b bg-muted/10">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                    Detected Sensitive Data
                    <Badge variant="secondary" className="ml-auto">{entities.length}</Badge>
                </h2>
                <p className="text-xs text-muted-foreground mt-1">Review and select entities to be permanently redacted.</p>
            </div>

            {confidenceWarning && (
                <div className="m-4 p-3 bg-amber-500/10 border border-amber-500/20 text-amber-500 rounded-md flex gap-2 text-sm items-start">
                    <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                    <p>Some selected entities have lower confidence scores. Please review them carefully.</p>
                </div>
            )}

            <ScrollArea className="flex-1 p-4">
                {entities.length === 0 && manualBoxes.length === 0 ? (
                    <div className="text-center py-10 text-muted-foreground text-sm">
                        <CheckCircle2 className="w-10 h-10 mx-auto mb-3 opacity-20" />
                        No sensitive entities detected.
                    </div>
                ) : (
                    <>
                        {Object.keys(typeGroups).sort().map(type => {
                            const typeData = typeGroups[type];
                            const typeEntities = [...typeData.singletons, ...Object.values(typeData.termGroups).flat()];
                            const allGroupChecked = typeEntities.every(e => e.approved !== false);

                            return (
                                <div key={`group-${type}`} className="mb-6">
                                    <div className="flex items-center justify-between mb-3 border-b pb-1">
                                        <div className="flex items-center gap-2">
                                            <Checkbox
                                                checked={allGroupChecked}
                                                onCheckedChange={(c) => handleToggleGroup(type, c === true)}
                                            />
                                            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
                                                {type}
                                            </h3>
                                        </div>
                                        <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">{typeEntities.length}</span>
                                    </div>

                                    <div className="space-y-2">
                                        {/* Render Term Groups */}
                                        {Object.entries(typeData.termGroups).map(([groupId, groupEntities]) => {
                                            const allTermChecked = groupEntities.every(e => e.approved !== false);
                                            const termText = groupEntities[0].text;
                                            // Handle case where some are checked and some aren't
                                            const someChecked = groupEntities.some(e => e.approved !== false);
                                            const isIndeterminate = someChecked && !allTermChecked;

                                            return (
                                                <div key={groupId} className={`flex flex-col gap-1 p-2 rounded-md transition-colors ${allTermChecked ? 'bg-indigo-500/10 border border-indigo-500/30' : isIndeterminate ? 'bg-amber-500/10 border border-amber-500/30' : 'bg-muted/30 border border-transparent'} hover:bg-muted/50`}>
                                                   <div className="flex items-start gap-3">
                                                       <Checkbox 
                                                            className="mt-1"
                                                            checked={isIndeterminate ? "indeterminate" : allTermChecked} 
                                                            onCheckedChange={(c) => {
                                                                const checkedState = c === true || c === "indeterminate"; // If indeterminate was clicked, it usually resolves to true
                                                                groupEntities.forEach(ent => onToggleEntity(ent.id!, checkedState));
                                                            }} 
                                                       />
                                                       <div className="flex-1 min-w-0">
                                                           <div className="flex items-center justify-between">
                                                               <span className={`text-[10px] font-medium tracking-wide flex items-center gap-1 ${isIndeterminate ? 'text-amber-500' : 'text-indigo-400'}`}>
                                                                   REPEATED TERM
                                                                   <span className={`${isIndeterminate ? 'bg-amber-500/20 text-amber-500 border-amber-500/30' : 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30'} border text-[9px] px-1.5 py-0.5 rounded-full`}>{groupEntities.length}</span>
                                                               </span>
                                                           </div>
                                                           <p className={`text-sm mt-0.5 break-words ${allTermChecked || isIndeterminate ? 'text-foreground' : 'text-muted-foreground line-through opacity-70'}`} title={termText}>
                                                               {termText}
                                                           </p>
                                                           <div className="mt-1 flex flex-wrap gap-1">
                                                               {Array.from(new Set(groupEntities.map(e => e.page))).map(page => (
                                                                   <span key={page} className="text-[9px] text-muted-foreground bg-muted px-1 rounded-sm">Pg {page}</span>
                                                               ))}
                                                           </div>
                                                       </div>
                                                   </div>
                                                </div>
                                            );
                                        })}

                                        {/* Render Singletons */}
                                        {typeData.singletons.map((ent, idx) => {
                                            const isChecked = ent.approved !== false;
                                            const isManual = ent.entity_type === "MANUAL";

                                            return (
                                                <div
                                                    key={ent.id || `${ent.entity_type}-${idx}`}
                                                    className={`flex flex-col gap-1 p-2 rounded-md transition-colors cursor-pointer ${isChecked ? 'bg-primary/5 border border-primary/20' : 'bg-muted/30 border border-transparent'} ${hoveredEntityId === ent.id ? 'bg-blue-500/10 border-blue-500/50' : 'hover:bg-muted/50'}`}
                                                    onMouseEnter={() => onHoverEntity?.(ent.id!)}
                                                    onMouseLeave={() => onHoverEntity?.(null)}
                                                    onClick={() => {
                                                        if (ent.id) {
                                                            const el = document.getElementById(`entity-${ent.id}`);
                                                            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                                        }
                                                    }}
                                                >
                                                    <div className="flex items-start gap-3">
                                                        <Checkbox
                                                            className="mt-1"
                                                            checked={isChecked}
                                                            onCheckedChange={(c) => onToggleEntity(ent.id!, c === true)}
                                                            onClick={(e) => e.stopPropagation()}
                                                        />
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center justify-between">
                                                                <span className="text-[10px] text-muted-foreground font-medium">Page {ent.page}</span>
                                                                {ent.score !== undefined && !isManual && (
                                                                    <span className={`text-[10px] pr-1 ${ent.score < 0.8 ? 'text-amber-500' : 'text-green-500'}`}>
                                                                        {Math.round(ent.score * 100)}%
                                                                    </span>
                                                                )}
                                                                {isManual && (
                                                                    <button
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            onDeleteManualEntity(ent.id!);
                                                                        }}
                                                                        className="text-muted-foreground hover:text-destructive"
                                                                    >
                                                                        <Trash2 className="w-3.5 h-3.5" />
                                                                    </button>
                                                                )}
                                                            </div>
                                                            <p className={`text-sm mt-0.5 break-words ${isChecked ? 'text-foreground' : 'text-muted-foreground line-through opacity-70'}`} title={ent.text}>
                                                                {ent.text || "[Area Redaction]"}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}

                        {/* Manual Redactions Group */}
                        {manualBoxes.length > 0 && (
                            <div className="mb-6">
                                <div className="flex items-center justify-between mb-3 border-b pb-1">
                                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
                                        Manual Redactions
                                    </h3>
                                    <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">{manualBoxes.length}</span>
                                </div>

                                <div className="space-y-2">
                                    {manualBoxes.map((box, idx) => (
                                        <div
                                            key={box.id}
                                            className="flex flex-col gap-1 p-2 rounded-md transition-colors bg-primary/5 border border-primary/20 hover:bg-muted/50"
                                        >
                                            <div className="flex items-start gap-3">
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-[10px] text-muted-foreground font-medium">Page {box.page}</span>
                                                        <button
                                                            onClick={() => onDeleteManualEntity(box.id)}
                                                            className="text-muted-foreground hover:text-destructive"
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                    <p className="text-sm mt-0.5 break-words text-foreground">
                                                        [Area Redaction] ({Math.round(box.width)}x{Math.round(box.height)})
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </>
                )}
            </ScrollArea>

            {!redactionComplete && (
                <div className="p-4 border-t bg-card mt-auto space-y-3 shrink-0">
                    <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Selected for redaction</span>
                        <span className="font-semibold">{selectedCount} entities</span>
                    </div>
                    <Button
                        className="w-full relative overflow-hidden group"
                        onClick={onApplyRedaction}
                        disabled={isApplying || (entities.length === 0 && manualBoxes.length === 0)}
                    >
                        {isApplying ? "Applying Redactions..." : "Apply & Create Copy"}
                    </Button>
                    <p className="text-[10px] text-center text-muted-foreground leading-tight">
                        Redacting will generate a fully anonymized copy of the document. The operation is irreversible.
                    </p>
                </div>
            )}
        </div>
    );
}
