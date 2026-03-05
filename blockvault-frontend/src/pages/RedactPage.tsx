import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "react-hot-toast";
import { Shield, ArrowLeft, Loader2, Lock, CheckCircle2, Square, Hand, Undo, Redo, Eye, Trash } from "lucide-react";

import { useFiles } from "@/contexts/FileContext";
import { analyzeRedaction, applyRedaction, verifyRedaction } from "@/api/redactor";
import { RedactApplyResponse, RedactEntity, ManualRect } from "@/types/redactor";
import { DocumentViewer } from "@/components/redact/DocumentViewer";
import { EntitySidebar } from "@/components/redact/EntitySidebar";
import { LegalModalFrame } from "@/components/legal/modals/LegalModalFrame";
import { getApiBase } from "@/lib/getApiBase";
import { readStoredUser } from "@/utils/authStorage";

export default function RedactPage() {
    const { fileId } = useParams<{ fileId: string }>();
    const navigate = useNavigate();
    const { files, loading } = useFiles();
    const apiBase = getApiBase();

    const [documentUrl, setDocumentUrl] = useState<string | null>(null);
    const [fileName, setFileName] = useState<string>("");
    const [passphraseInput, setPassphraseInput] = useState<string>("");
    const [confirmedPassphrase, setConfirmedPassphrase] = useState<string>("");
    const [showPassphraseModal, setShowPassphraseModal] = useState(false);
    const [isLoadingDocument, setIsLoadingDocument] = useState(false);
    const [redactionResult, setRedactionResult] = useState<RedactApplyResponse | null>(null);
    const [proofStatus, setProofStatus] = useState<string | null>(null);

    const [entities, setEntities] = useState<RedactEntity[]>([]);
    const [manualBoxes, setManualBoxes] = useState<ManualRect[]>([]);
    const [manualHistory, setManualHistory] = useState<ManualRect[][]>([[]]);
    const [historyIndex, setHistoryIndex] = useState(0);

    const [isAnalyzed, setIsAnalyzed] = useState(false);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [isApplying, setIsApplying] = useState(false);
    const canContinuePassphrase = passphraseInput.trim().length > 0;

    // Toolbar modes
    const [activeTool, setActiveTool] = useState<"select" | "draw">("select");
    const [previewMode, setPreviewMode] = useState(false);

    useEffect(() => {
        return () => {
            if (documentUrl) {
                URL.revokeObjectURL(documentUrl);
            }
        };
    }, [documentUrl]);

    // Fetch file bytes on load (requires passphrase)
    useEffect(() => {
        async function loadFileObj() {
            if (!fileId || loading) return;
            const f = files.find((fItem) => fItem.id === fileId || ('file_id' in fItem && fItem.file_id === fileId) || ('_id' in fItem && fItem._id === fileId));
            if (!f) {
                toast.error("File not found.");
                navigate("/files");
                return;
            }

            const fileRef = f as unknown as Record<string, unknown>;
            const fileIdActual = String(fileRef.file_id || fileRef.id || fileRef._id);
            const nameActual = String(fileRef.name || fileRef.file_name || fileRef.original_name || "document.pdf");
            setFileName(nameActual);

            if (!confirmedPassphrase) {
                setShowPassphraseModal(true);
                return;
            }

            try {
                setIsLoadingDocument(true);
                const user = readStoredUser();
                if (!user?.jwt) {
                    toast.error("Authentication required. Please log in again.");
                    navigate("/login");
                    return;
                }

                const response = await fetch(`${apiBase}/files/${fileIdActual}/content?key=${encodeURIComponent(confirmedPassphrase)}`, {
                    headers: { Authorization: `Bearer ${user.jwt}` },
                    cache: 'no-store',
                });

                if (!response.ok) {
                    throw new Error("Failed to load file");
                }
                const contentType = (response.headers.get("content-type") || "").toLowerCase();
                if (!contentType.includes("application/pdf")) {
                    const errText = await response.text();
                    throw new Error(`Unexpected content type: ${contentType || "unknown"} ${errText.slice(0, 200)}`);
                }
                const blob = await response.blob();
                if (!blob.size) {
                    throw new Error("Fetched file is empty");
                }
                const url = URL.createObjectURL(blob);
                setDocumentUrl((prev) => {
                    if (prev) URL.revokeObjectURL(prev);
                    return url;
                });
            } catch (err) {
                console.error("Failed to load document for redaction", err);
                toast.error("Decryption or download failed. Please check your passphrase.");
                setConfirmedPassphrase("");
                setShowPassphraseModal(true);
            } finally {
                setIsLoadingDocument(false);
            }
        }
        loadFileObj();
    }, [fileId, files, loading, navigate, confirmedPassphrase, apiBase]);

    // Analyze Document
    const handleAnalyze = async () => {
        if (!fileId) return;
        if (!confirmedPassphrase) {
            setShowPassphraseModal(true);
            return;
        }
        setIsAnalyzing(true);
        const loadingToast = toast.loading("Analyzing document for PII...");

        try {
            const response = await analyzeRedaction(fileId, confirmedPassphrase);
            const annotated = response.entities.map((ent, idx) => ({
                ...ent,
                id: `auto-${idx}`,
                approved: true,
            }));
            setEntities(annotated);
            setIsAnalyzed(true);
            toast.success(`Found ${annotated.length} potential entities.`, { id: loadingToast });
        } catch (error) {
            console.error(error);
            toast.error("Analysis failed. Backend might be unreachable.", { id: loadingToast });
        } finally {
            setIsAnalyzing(false);
        }
    };

    // Toggle entity selection
    const handleToggleEntity = (id: string, checked: boolean) => {
        setEntities(prev => prev.map(e => e.id === id ? { ...e, approved: checked } : e));
    };

    const updateManualBoxesWithHistory = (newBoxes: ManualRect[]) => {
        const newHistory = manualHistory.slice(0, historyIndex + 1);
        newHistory.push(newBoxes);
        setManualBoxes(newBoxes);
        setManualHistory(newHistory);
        setHistoryIndex(newHistory.length - 1);
    };

    const handleAddManualRect = (rect: ManualRect) => {
        updateManualBoxesWithHistory([...manualBoxes, rect]);
    };

    const handleDeleteManualEntity = (id: string) => {
        updateManualBoxesWithHistory(manualBoxes.filter(b => b.id !== id));
    };

    const handleUndo = () => {
        if (historyIndex > 0) {
            setHistoryIndex(i => i - 1);
            setManualBoxes(manualHistory[historyIndex - 1]);
        }
    };

    const handleRedo = () => {
        if (historyIndex < manualHistory.length - 1) {
            setHistoryIndex(i => i + 1);
            setManualBoxes(manualHistory[historyIndex + 1]);
        }
    };

    // Keyboard Shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Do not capture if typing in input
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

            if (e.key === "r" || e.key === "R") setActiveTool("draw");
            if (e.key === "e" || e.key === "E") setActiveTool("select");

            if (e.key === "z" && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                if (e.shiftKey) handleRedo();
                else handleUndo();
            }

            if (e.key === "Enter") {
                handleApplyRedaction();
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [historyIndex, manualHistory]);

    // Apply Redactions
    const handleApplyRedaction = async () => {
        if (!fileId) return;
        if (!confirmedPassphrase) {
            setShowPassphraseModal(true);
            return;
        }
        setIsApplying(true);
        const loadingToast = toast.loading("Burnishing redactions into document...");

        try {
            const approvedEntities = entities.filter(e => e.approved !== false);
            const result = await applyRedaction(fileId, confirmedPassphrase, approvedEntities, manualBoxes);
            setRedactionResult(result);
            setProofStatus(result.redaction_status || "pending");

            const redactedFileId = result.file_id;
            if (redactedFileId) {
                const user = readStoredUser();
                if (!user?.jwt) {
                    throw new Error("Authentication required");
                }
                const response = await fetch(`${apiBase}/files/${redactedFileId}/content?key=${encodeURIComponent(confirmedPassphrase)}`, {
                    headers: { Authorization: `Bearer ${user.jwt}` },
                    cache: 'no-store',
                });
                if (!response.ok) {
                    throw new Error("Failed to download redacted file");
                }
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement("a");
                const baseName = fileName || "document.pdf";
                a.href = url;
                a.download = baseName.replace(".pdf", "_redacted.pdf");
                document.body.appendChild(a);
                a.click();
                a.remove();
                window.URL.revokeObjectURL(url);
            }

            toast.success("Redaction applied successfully! File downloaded.", { id: loadingToast });
        } catch (error) {
            console.error("Redact failed", error);
            toast.error("Failed to apply redactions.", { id: loadingToast });
        } finally {
            setIsApplying(false);
        }
    };

    const handleCheckProofStatus = async () => {
        if (!redactionResult?.file_id) return;
        try {
            const user = readStoredUser();
            if (!user?.jwt) {
                throw new Error("Authentication required");
            }
            const data = await verifyRedaction(redactionResult.file_id);
            const verified = data.proof_valid ?? data.valid_proof;
            setProofStatus(data.status || (verified ? "complete" : "pending"));
            if (verified) {
                toast.success("Redaction proof verified.");
            } else {
                toast("Proof still processing.", { icon: "⏳" });
            }
        } catch (err) {
            toast.error("Unable to check proof status.");
        }
    };

    if (loading || isLoadingDocument) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[500px] h-full">
                <Loader2 className="w-8 h-8 animate-spin text-primary opacity-50 mb-4" />
                <p className="text-muted-foreground">Loading encrypted document...</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-[calc(100vh-4rem)] -m-4 sm:-m-6 md:-m-8">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b bg-card shrink-0">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => navigate("/files")}
                        className="p-2 -ml-2 rounded-full hover:bg-muted text-muted-foreground transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div>
                        <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
                            <Shield className="w-5 h-5 text-primary" />
                            Document Redaction Engine
                        </h1>
                        <p className="text-sm text-muted-foreground mt-0.5 max-w-xl truncate">
                            {fileName}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    {!isAnalyzed && (
                        <button
                            onClick={handleAnalyze}
                            disabled={isAnalyzing || !confirmedPassphrase}
                            className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground shadow hover:bg-primary/90 h-9 px-4 py-2"
                        >
                            {isAnalyzing ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Analyzing Document...
                                </>
                            ) : (
                                "Scan for Sensitive Data"
                            )}
                        </button>
                    )}
                    {redactionResult?.file_id && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <CheckCircle2 className="w-4 h-4 text-green-500" />
                            Proof status: <span className="font-medium text-foreground">{proofStatus || "pending"}</span>
                            <button
                                onClick={handleCheckProofStatus}
                                className="ml-2 text-xs text-primary hover:underline"
                            >
                                Check
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Main Workspace: 2 Pane Layout */}
            <div className="flex-1 overflow-hidden flex bg-background">
                {/* PDF Viewer Pane */}
                <div className="flex-1 relative flex flex-col min-w-0">
                    {/* Toolbar */}
                    <div className="h-12 border-b flex items-center px-4 gap-2 bg-muted/40 shrink-0">
                        <button
                            className={`p-2 rounded flex items-center gap-1.5 text-sm font-medium ${activeTool === 'select' ? 'bg-primary/10 text-primary hover:bg-primary/20' : 'text-muted-foreground hover:bg-muted'}`}
                            onClick={() => setActiveTool("select")}
                            title="Select (E)"
                        >
                            <Hand className="w-4 h-4" /> Select
                        </button>
                        <button
                            className={`p-2 rounded flex items-center gap-1.5 text-sm font-medium ${activeTool === 'draw' ? 'bg-primary/10 text-primary hover:bg-primary/20' : 'text-muted-foreground hover:bg-muted'}`}
                            onClick={() => setActiveTool("draw")}
                            title="Draw Rectangle (R)"
                        >
                            <Square className="w-4 h-4" /> Area
                        </button>

                        <div className="w-px h-6 bg-border mx-2" />

                        <button
                            className="p-2 rounded text-muted-foreground hover:bg-muted disabled:opacity-30 disabled:hover:bg-transparent"
                            onClick={handleUndo}
                            disabled={historyIndex === 0}
                            title="Undo (Ctrl+Z)"
                        >
                            <Undo className="w-4 h-4" />
                        </button>
                        <button
                            className="p-2 rounded text-muted-foreground hover:bg-muted disabled:opacity-30 disabled:hover:bg-transparent"
                            onClick={handleRedo}
                            disabled={historyIndex >= manualHistory.length - 1}
                            title="Redo (Ctrl+Shift+Z)"
                        >
                            <Redo className="w-4 h-4" />
                        </button>

                        <div className="w-px h-6 bg-border mx-2" />

                        <button
                            className="p-2 rounded flex items-center gap-1.5 text-sm font-medium text-destructive/80 hover:bg-destructive/10 hover:text-destructive transition-colors disabled:opacity-50"
                            onClick={() => updateManualBoxesWithHistory([])}
                            disabled={manualBoxes.length === 0}
                            title="Clear Manual Redactions"
                        >
                            <Trash className="w-4 h-4" /> Clear
                        </button>

                        <div className="ml-auto flex items-center">
                            <button
                                className={`px-3 py-1.5 rounded flex items-center gap-2 text-sm font-medium transition-colors ${previewMode ? 'bg-slate-900 text-slate-100 hover:bg-black' : 'text-muted-foreground hover:bg-muted'}`}
                                onClick={() => setPreviewMode(!previewMode)}
                            >
                                <Eye className="w-4 h-4" /> {previewMode ? "Preview Mode ON" : "Preview"}
                            </button>
                        </div>
                    </div>

                    {documentUrl ? (
                        <DocumentViewer
                            file={documentUrl}
                            entities={entities}
                            manualBoxes={manualBoxes}
                            onAddManualBox={handleAddManualRect}
                            onUpdateManualBox={(id, rect) => {
                                const newBoxes = manualBoxes.map(b => b.id === id ? { ...b, ...rect } : b);
                                updateManualBoxesWithHistory(newBoxes);
                            }}
                            onToggleEntity={(id) => {
                                const ent = entities.find(e => e.id === id);
                                if (ent) handleToggleEntity(id, ent.approved === false ? true : false);
                            }}
                            activeTool={activeTool}
                            previewMode={previewMode}
                        />
                    ) : (
                        <div className="flex-1 flex items-center justify-center bg-muted/10 text-muted-foreground p-8 text-center">
                            Failed to decrypt or load document for viewing.
                        </div>
                    )}
                </div>

                {/* Sidebar Pane */}
                {isAnalyzed && (
                    <div className="shrink-0 animate-in slide-in-from-right-8 duration-300 pointer-events-auto h-full z-20">
                        <EntitySidebar
                            entities={entities}
                            manualBoxes={manualBoxes}
                            onToggleEntity={handleToggleEntity}
                            onDeleteManualEntity={handleDeleteManualEntity}
                            onApplyRedaction={handleApplyRedaction}
                            isApplying={isApplying}
                        />
                    </div>
                )}
            </div>

            {showPassphraseModal && (
                <LegalModalFrame
                    icon={<Lock className="h-5 w-5 text-white" />}
                    title="Enter Encryption Passphrase"
                    subtitle="Authenticate access to decrypt this file for redaction."
                    onClose={() => {
                        setShowPassphraseModal(false);
                        setPassphraseInput("");
                        setConfirmedPassphrase("");
                        navigate("/files");
                    }}
                    widthClassName="max-w-md"
                    contentClassName="space-y-6"
                    footer={(
                        <div className="flex justify-end gap-3">
                            <button
                                className="px-4 py-2 text-sm rounded-lg border border-slate-700 text-slate-200 hover:bg-slate-800"
                                onClick={() => {
                                    setShowPassphraseModal(false);
                                    setPassphraseInput("");
                                    setConfirmedPassphrase("");
                                    navigate("/files");
                                }}
                            >
                                Cancel
                            </button>
                            <button
                                className={`px-4 py-2 text-sm rounded-lg font-medium transition-colors ${
                                    canContinuePassphrase
                                        ? "bg-blue-600 text-white border border-blue-500 hover:bg-blue-500"
                                        : "bg-slate-700 text-slate-400 border border-slate-600 cursor-not-allowed"
                                }`}
                                onClick={() => {
                                    if (!canContinuePassphrase) return;
                                    setConfirmedPassphrase(passphraseInput);
                                    setShowPassphraseModal(false);
                                }}
                                disabled={!canContinuePassphrase}
                            >
                                Continue
                            </button>
                        </div>
                    )}
                    headerAccent="blue"
                >
                    <div className="space-y-3">
                        <p className="text-sm text-slate-300">
                            Enter the passphrase that was used to encrypt this file. This ensures only authorized parties can decrypt the content locally.
                        </p>
                        <div className="relative">
                            <input
                                type="password"
                                placeholder="Enter passphrase"
                                value={passphraseInput}
                                onChange={(e) => setPassphraseInput(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && canContinuePassphrase) {
                                        setConfirmedPassphrase(passphraseInput);
                                        setShowPassphraseModal(false);
                                    }
                                }}
                                className="w-full rounded-xl border border-slate-700/60 bg-slate-900/80 px-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-500/60"
                                autoFocus
                            />
                            <Lock className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                        </div>
                        <p className="text-xs text-slate-500">
                            If you can’t recall the original passphrase, contact the file owner or refer to your secure passphrase manager.
                        </p>
                    </div>
                </LegalModalFrame>
            )}
        </div>
    );
}
