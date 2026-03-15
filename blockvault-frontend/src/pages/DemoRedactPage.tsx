import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "react-hot-toast";
import { ArrowLeft, CheckCircle2, Shield, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { jsPDF } from "jspdf";

import { apiClient } from "@/api/client";
import { RedactEntity, ManualRect, SearchMatch } from "@/types/redactor";
import { DocumentViewer } from "@/components/redact/DocumentViewer";
import { EntitySidebar } from "@/components/redact/EntitySidebar";
import { DocumentSkeleton } from "@/components/skeleton/DocumentSkeleton";
import { RedactionProgress } from "@/components/redact/RedactionProgress";

export default function DemoRedactPage() {
    const { fileId } = useParams<{ fileId: string }>();
    const navigate = useNavigate();

    const [documentUrl, setDocumentUrl] = useState<string | null>(null);
    const [fileName, setFileName] = useState<string>("");
    const [isLoadingDocument, setIsLoadingDocument] = useState(true);
    
    const [entities, setEntities] = useState<RedactEntity[]>([]);
    const [manualBoxes, setManualBoxes] = useState<ManualRect[]>([]);
    const [searchMatches] = useState<SearchMatch[]>([]);
    
    const [isApplying, setIsApplying] = useState(false);
    const [redactionComplete, setRedactionComplete] = useState(false);
    const [proofStatus, setProofStatus] = useState<"pending" | "valid" | null>(null);
    
    const [hoveredEntityId, setHoveredEntityId] = useState<string | null>(null);
    const [selectedBoxId, setSelectedBoxId] = useState<string | null>(null);

    // Initialize Demo Data
    useEffect(() => {
        const initDemo = async () => {
            if (!fileId) return;
            try {
                // Fetch file metadata
                const fileRes = await apiClient.get(`/demo/files/${fileId}`);
                setFileName(fileRes.data.name);

                // Fetch entities
                const entRes = await apiClient.get(`/demo/files/${fileId}/entities`);
                setEntities(entRes.data.entities || []);

                // Generate PDF client-side to match the entities
                generateDemoPDF(fileRes.data.name, entRes.data.entities || []);
            } catch (err) {
                console.error("Demo init error:", err);
                toast.error("Failed to initialize demo document");
            } finally {
                setIsLoadingDocument(false);
            }
        };

        const generateDemoPDF = (name: string, demoEntities: RedactEntity[]) => {
            const doc = new jsPDF({ unit: 'pt', format: 'a4' });
            
            // Draw some background text for realism
            doc.setFontSize(24);
            doc.text(name.replace('.pdf', '').toUpperCase(), 50, 80);
            doc.setFontSize(12);
            doc.setTextColor(100);
            doc.text("This is an interactive BlockVault demo document.", 50, 110);
            doc.text("Sensitive information has been detected below:", 50, 130);
            
            // Draw the actual entity text exactly where their bboxes are
            doc.setTextColor(0);
            doc.setFontSize(11);
            demoEntities.forEach(ent => {
                // bbox is [x0, y0, x1, y1]
                const [x0, y0, x1, y1] = ent.bbox;
                const textY = y1 - 2; // Approximate baseline
                doc.text(ent.text, x0, textY);
            });

            // Generate Blob
            const blob = doc.output('blob');
            const url = URL.createObjectURL(blob);
            setDocumentUrl(url);
        };

        initDemo();
    }, [fileId]);

    const handleSidebarToggleEntity = (id: string, checked: boolean) => {
        setEntities(prev => prev.map(e => e.id === id ? { ...e, approved: checked } : e));
    };

    const handleViewerToggleEntity = (id: string) => {
        setEntities(prev => prev.map(e => e.id === id ? { ...e, approved: e.approved === false ? true : false } : e));
    };

    const handleAddManualBox = (rect: ManualRect) => {
        setManualBoxes(prev => [...prev, rect]);
    };

    const handleDeleteManualBox = (id: string) => {
        setManualBoxes(prev => prev.filter(b => b.id !== id));
    };
    
    const handleUpdateManualBox = (id: string, updates: Partial<ManualRect>) => {
        setManualBoxes(prev => prev.map(box => box.id === id ? { ...box, ...updates } : box));
    };

    const applyDemoRedaction = async () => {
        setIsApplying(true);
        setProofStatus("pending");
        
        try {
            const activeEntities = entities.filter(e => e.approved !== false);
            await apiClient.post(`/demo/files/${fileId}/redact`, {
                entities: activeEntities,
                manual_boxes: manualBoxes
            });
            
            toast.success("Redactions applied successfully");
            setRedactionComplete(true);
            setProofStatus("valid");
            
            // Update the timeline (simulation)
        } catch (err) {
            toast.error("Demo failed to apply redaction");
        } finally {
            setIsApplying(false);
        }
    };

    if (isLoadingDocument) {
        return <DocumentSkeleton />;
    }

    return (
        <div className="flex flex-col h-[calc(100vh-4rem)] -m-6 overflow-hidden bg-background">
            {/* Header */}
            <div className="flex-none h-14 border-b bg-card flex items-center justify-between px-4">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => navigate("/files")}>
                        <ArrowLeft className="w-5 h-5" />
                    </Button>
                    <div>
                        <h1 className="font-semibold">{fileName}</h1>
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Shield className="w-3 h-3" />
                            Secure Interactive Demo
                        </p>
                    </div>
                </div>
                {proofStatus === 'valid' && (
                    <div className="flex items-center gap-2 bg-green-500/10 text-green-500 px-3 py-1.5 rounded-full text-sm font-medium border border-green-500/20">
                        <CheckCircle2 className="w-4 h-4" />
                        Zero-Knowledge Proof Verified
                    </div>
                )}
            </div>

            {/* Main Workspace */}
            <div className="flex-1 flex overflow-hidden">
                {/* Document Viewer Area */}
                <div className="flex-1 relative bg-black/5 dark:bg-black/40 overflow-hidden">
                    {documentUrl ? (
                         <div className="absolute inset-0 overflow-auto flex justify-center p-8 pb-32">
                             <DocumentViewer
                                 file={documentUrl}
                                 entities={entities}
                                 manualBoxes={manualBoxes}
                                 searchMatches={searchMatches}
                                 activeTool="select"
                                 previewMode={redactionComplete}
                                 onAddManualBox={handleAddManualBox}
                                 onUpdateManualBox={handleUpdateManualBox}
                                 onToggleEntity={redactionComplete ? undefined : handleViewerToggleEntity}
                                 selectedBoxId={selectedBoxId}
                                 onSelectBox={setSelectedBoxId}
                                 hoveredEntityId={hoveredEntityId}
                                 onHoverEntity={setHoveredEntityId}
                             />
                         </div>
                    ) : (
                        <div className="flex h-full items-center justify-center">
                            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                        </div>
                    )}
                    
                    {/* Redaction Overlay Animation */}
                    {isApplying && (
                        <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
                            <RedactionProgress stage="applying" />
                        </div>
                    )}
                </div>

                {/* Sidebar */}
                <div className="w-80 border-l bg-card flex flex-col z-10 shrink-0 shadow-xl overflow-hidden">
                    {/* We can show the timeline if redaction is complete, or sidebar otherwise */}
                    {redactionComplete ? (
                        <div className="flex flex-col h-full bg-card p-6">
                             <div className="flex items-center gap-3 mb-6">
                                 <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center shrink-0">
                                     <CheckCircle2 className="w-5 h-5 text-green-500" />
                                 </div>
                                 <div>
                                     <h2 className="text-lg font-semibold text-green-500">Secured</h2>
                                     <p className="text-sm text-muted-foreground">Document is fully redacted</p>
                                 </div>
                             </div>
                             
                             <div className="space-y-4 flex-1">
                                 <h3 className="text-sm font-medium text-muted-foreground">Verification</h3>
                                 <div className="bg-muted/30 border p-4 rounded-xl space-y-3">
                                     <div className="flex items-center justify-between text-sm">
                                         <span className="text-muted-foreground">ZK Proof</span>
                                         <span className="text-green-500 font-medium font-mono text-xs text-right">Verified<br/>Groth16</span>
                                     </div>
                                     <div className="flex items-center justify-between text-sm pt-3 border-t">
                                         <span className="text-muted-foreground">Anchor Tx</span>
                                         <a href="#" className="text-primary hover:underline font-mono text-xs text-right truncate max-w-[120px]">
                                             0x123abc456def...
                                         </a>
                                     </div>
                                 </div>
                             </div>
                             
                             <Button className="w-full mt-auto" onClick={() => navigate("/files")}>
                                 Return to Workspace
                             </Button>
                        </div>
                    ) : (
                        <EntitySidebar
                            entities={entities}
                            manualBoxes={manualBoxes}
                            onToggleEntity={handleSidebarToggleEntity}
                            onDeleteManualEntity={handleDeleteManualBox}
                            onApplyRedaction={applyDemoRedaction}
                            isApplying={isApplying}
                            hoveredEntityId={hoveredEntityId}
                            onHoverEntity={setHoveredEntityId}
                        />
                    )}
                </div>
            </div>
        </div>
    );
}
