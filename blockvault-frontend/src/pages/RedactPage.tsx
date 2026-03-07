import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "react-hot-toast";
import { Shield, ArrowLeft, Loader2, Lock, CheckCircle2, Square, Hand, Undo, Redo, Eye, Trash, Download, FileText, Search } from "lucide-react";

import { useFiles } from "@/contexts/FileContext";
import { analyzeRedaction, applyRedaction, verifyRedaction, searchRedactionMatches } from "@/api/redactor";
import { RedactApplyResponse, RedactEntity, ManualRect, VerifyRedactionResponse, SearchMatch } from "@/types/redactor";
import { DocumentViewer } from "@/components/redact/DocumentViewer";
import { DocumentSkeleton } from "@/components/skeleton/DocumentSkeleton";
import { RedactionProgress } from "@/components/redact/RedactionProgress";
import { EntitySidebar } from "@/components/redact/EntitySidebar";
import { LegalModalFrame } from "@/components/legal/modals/LegalModalFrame";
import { getApiBase } from "@/lib/getApiBase";
import { readStoredUser } from "@/utils/authStorage";

type ProofStatus = "pending" | "valid" | "invalid" | "failed" | null;

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
    const [isUnlockingDocument, setIsUnlockingDocument] = useState(false);
    const [redactionResult, setRedactionResult] = useState<RedactApplyResponse | null>(null);
    const [redactionComplete, setRedactionComplete] = useState(false);
    const [redactedFileUrl, setRedactedFileUrl] = useState<string | null>(null);
    const [proofStatus, setProofStatus] = useState<ProofStatus>(null);
    const [verificationResult, setVerificationResult] = useState<VerifyRedactionResponse | null>(null);

    const [entities, setEntities] = useState<RedactEntity[]>([]);
    const [manualBoxes, setManualBoxes] = useState<ManualRect[]>([]);
    const [manualHistory, setManualHistory] = useState<ManualRect[][]>([[]]);
    const [historyIndex, setHistoryIndex] = useState(0);

    const [isAnalyzed, setIsAnalyzed] = useState(false);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [isApplying, setIsApplying] = useState(false);
    const canContinuePassphrase = passphraseInput.trim().length > 0;

    // Selection and Hover State
    const [selectedBoxId, setSelectedBoxId] = useState<string | null>(null);
    const [hoveredEntityId, setHoveredEntityId] = useState<string | null>(null);

    // Search state
    const [searchQuery, setSearchQuery] = useState("");
    const [searchMatches, setSearchMatches] = useState<SearchMatch[]>([]);
    const [isSearching, setIsSearching] = useState(false);

    // Toolbar modes
    const [activeTool, setActiveTool] = useState<"select" | "draw">("select");
    const [previewMode, setPreviewMode] = useState(false);
    const approvedEntityCount = entities.filter((entity) => entity.approved !== false).length;
    const hasPendingRedactions = approvedEntityCount > 0 || manualBoxes.length > 0 || searchMatches.length > 0;
    const activeRedactedFileId = redactionResult?.file_id || null;
    const proofStatusLabel =
        proofStatus === "valid"
            ? "Proof Verified"
            : proofStatus === "failed"
                ? "Proof Failed"
            : proofStatus === "invalid"
                ? "Proof Invalid"
                : proofStatus === "pending"
                    ? "Proof Generating..."
                    : "Not checked";
    const documentLoadRequestRef = useRef(0);
    const proofPollingInFlightRef = useRef(false);

    useEffect(() => {
        setDocumentUrl((previousUrl) => {
            if (previousUrl) {
                URL.revokeObjectURL(previousUrl);
            }
            return null;
        });
        setFileName("");
        setPassphraseInput("");
        setConfirmedPassphrase("");
        setShowPassphraseModal(false);
        setRedactionResult(null);
        setRedactionComplete(false);
        setProofStatus(null);
        setVerificationResult(null);
        setEntities([]);
        setManualBoxes([]);
        setSearchQuery("");
        setSearchMatches([]);
        setManualHistory([[]]);
        setHistoryIndex(0);
        setIsAnalyzed(false);
        setSelectedBoxId(null);
        setHoveredEntityId(null);
        setRedactedFileUrl((previousUrl) => {
            if (previousUrl) {
                URL.revokeObjectURL(previousUrl);
            }
            return null;
        });
    }, [fileId]);

    useEffect(() => {
        return () => {
            if (documentUrl) {
                URL.revokeObjectURL(documentUrl);
            }
        };
    }, [documentUrl]);

    useEffect(() => {
        return () => {
            if (redactedFileUrl) {
                URL.revokeObjectURL(redactedFileUrl);
            }
        };
    }, [redactedFileUrl]);

    const getAuthHeader = () => {
        const user = readStoredUser<{ jwt?: string }>();
        if (!user?.jwt) {
            throw new Error("Authentication required");
        }
        return { Authorization: `Bearer ${user.jwt}` };
    };

    const buildDownloadName = (baseName: string, suffix: string, fallbackExtension = ".pdf") => {
        if (!baseName) {
            return `document${suffix}${fallbackExtension}`;
        }
        const dotIndex = baseName.lastIndexOf(".");
        if (dotIndex === -1) {
            return `${baseName}${suffix}${fallbackExtension}`;
        }
        const stem = baseName.slice(0, dotIndex);
        const extension = baseName.slice(dotIndex) || fallbackExtension;
        return `${stem}${suffix}${extension}`;
    };

    const triggerBlobDownload = (blob: Blob, downloadName: string) => {
        const url = window.URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = downloadName;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        window.URL.revokeObjectURL(url);
    };

    const fetchBlobWithAuth = async (path: string, accept?: string) => {
        const response = await fetch(`${apiBase}${path}`, {
            headers: {
                ...getAuthHeader(),
                ...(accept ? { Accept: accept } : {}),
            },
            cache: "no-store",
        });

        if (!response.ok) {
            throw new Error(`Request failed with status ${response.status}`);
        }

        const blob = await response.blob();
        const disposition = response.headers.get("content-disposition") || "";
        const fileNameMatch = disposition.match(/filename\*?=(?:UTF-8''|")?([^\";]+)/i);
        const resolvedName = fileNameMatch?.[1] ? decodeURIComponent(fileNameMatch[1].replace(/"/g, "")) : null;

        return { blob, fileName: resolvedName };
    };

    const primeRedactedFileUrl = async (targetFileId: string, passphrase: string) => {
        const { blob } = await fetchBlobWithAuth(
            `/files/${targetFileId}/content?key=${encodeURIComponent(passphrase)}`,
            "application/pdf",
        );
        const nextUrl = window.URL.createObjectURL(blob);
        setRedactedFileUrl((previousUrl) => {
            if (previousUrl) {
                URL.revokeObjectURL(previousUrl);
            }
            return nextUrl;
        });
    };

    const getCurrentFileRecord = () => {
        if (!fileId) {
            return null;
        }

        return files.find(
            (item) =>
                item.id === fileId ||
                ("file_id" in item && item.file_id === fileId) ||
                ("_id" in item && item._id === fileId),
        ) as (typeof files)[number] | undefined;
    };

    const loadDocumentWithPassphrase = async (passphrase: string) => {
        const targetFile = getCurrentFileRecord();
        if (!targetFile) {
            throw new Error("File not found.");
        }

        const fileRef = targetFile as unknown as Record<string, unknown>;
        const fileIdActual = String(fileRef.file_id || fileRef.id || fileRef._id);
        const nameActual = String(fileRef.name || fileRef.file_name || fileRef.original_name || "document.pdf");
        const requestId = ++documentLoadRequestRef.current;

        setFileName(nameActual);
        setIsLoadingDocument(true);

        try {
            const headers = getAuthHeader();
            const response = await fetch(`${apiBase}/files/${fileIdActual}/content?key=${encodeURIComponent(passphrase)}`, {
                headers,
                cache: "no-store",
            });

            if (!response.ok) {
                const errorText = await response.text().catch(() => "");
                throw new Error(`${response.status}:${errorText}`);
            }

            const contentType = (response.headers.get("content-type") || "").toLowerCase();
            if (!contentType.includes("application/pdf")) {
                const errText = await response.text().catch(() => "");
                throw new Error(`unexpected-content:${contentType}:${errText.slice(0, 200)}`);
            }

            const blob = await response.blob();
            if (!blob.size) {
                throw new Error("Fetched file is empty");
            }

            if (requestId !== documentLoadRequestRef.current) {
                return;
            }

            const url = URL.createObjectURL(blob);
            setDocumentUrl((previousUrl) => {
                if (previousUrl) {
                    URL.revokeObjectURL(previousUrl);
                }
                return url;
            });
            setConfirmedPassphrase(passphrase);
        } finally {
            if (requestId === documentLoadRequestRef.current) {
                setIsLoadingDocument(false);
            }
        }
    };

    const handleConfirmPassphrase = async () => {
        const normalizedPassphrase = passphraseInput.trim();
        if (!normalizedPassphrase) {
            return;
        }

        setIsUnlockingDocument(true);
        try {
            try {
                await loadDocumentWithPassphrase(normalizedPassphrase);
            } catch (initialError) {
                const initialMessage = initialError instanceof Error ? initialError.message : "";
                if (initialMessage.startsWith("401:") || initialMessage.startsWith("404:")) {
                    throw initialError;
                }

                // The decryption fetch can fail once while the page is settling.
                // Retry once before surfacing a passphrase error to the user.
                await new Promise((resolve) => window.setTimeout(resolve, 150));
                await loadDocumentWithPassphrase(normalizedPassphrase);
            }
            setShowPassphraseModal(false);
        } catch (error) {
            console.error("Failed to load document for redaction", error);
            setConfirmedPassphrase("");

            const message = error instanceof Error ? error.message : "";
            if (message.startsWith("401:")) {
                toast.error("Authentication expired. Please log in again.");
                navigate("/login");
            } else if (message.startsWith("404:")) {
                toast.error("File not found.");
                navigate("/files");
            } else if (message.startsWith("400:")) {
                toast.error("Incorrect passphrase. Please try again.");
            } else {
                toast.error("Unable to decrypt or load the document right now.");
            }
        } finally {
            setIsUnlockingDocument(false);
        }
    };

    useEffect(() => {
        if (!fileId || loading) {
            return;
        }

        const targetFile = getCurrentFileRecord();
        if (!targetFile) {
            toast.error("File not found.");
            navigate("/files");
            return;
        }

        const fileRef = targetFile as unknown as Record<string, unknown>;
        const nameActual = String(fileRef.name || fileRef.file_name || fileRef.original_name || "document.pdf");
        setFileName(nameActual);

        if (!documentUrl) {
            setShowPassphraseModal(true);
        }
    }, [documentUrl, fileId, files, loading, navigate]);

    useEffect(() => {
        if (!fileId || loading) {
            return;
        }

        const latestRedactedFile = files
            .filter((item) => {
                const record = item as unknown as Record<string, unknown>;
                return String(record.redacted_from || record.source_file_id || "") === fileId;
            })
            .sort((left, right) => {
                const leftCreated = Number((left as Record<string, unknown>).created_at || 0);
                const rightCreated = Number((right as Record<string, unknown>).created_at || 0);
                return rightCreated - leftCreated;
            })[0];

        if (!latestRedactedFile) {
            return;
        }

        const restoredRecord = latestRedactedFile as unknown as Record<string, unknown>;
        const restoredFileId = String(restoredRecord.file_id || restoredRecord.id || restoredRecord._id || "");
        if (!restoredFileId) {
            return;
        }

        setRedactionResult((current) => {
            if (current?.file_id === restoredFileId) {
                return current;
            }
            return {
                file_id: restoredFileId,
                name: String(restoredRecord.name || restoredRecord.file_name || restoredRecord.original_name || buildDownloadName(fileName || "document.pdf", "_redacted")),
                sha256: String(restoredRecord.sha256 || ""),
                redaction_status: typeof restoredRecord.redaction_status === "string" ? restoredRecord.redaction_status : undefined,
                source_file_id: fileId,
            };
        });
        setRedactionComplete(true);
        setProofStatus((current) => {
            if (current === "valid") {
                return current;
            }
            if (restoredRecord.redaction_status === "failed") {
                return "failed";
            }
            return "pending";
        });
    }, [fileId, fileName, files, loading]);

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
        if (selectedBoxId === id) setSelectedBoxId(null);
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

            if (e.key === "Delete" || e.key === "Backspace") {
                if (selectedBoxId) {
                    handleDeleteManualEntity(selectedBoxId);
                }
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [historyIndex, manualHistory, selectedBoxId]);

    // Apply Redactions
    const handleSearch = async (query: string, isRegex = false) => {
        if (!fileId || !query) return;
        setIsSearching(true);
        try {
            const res = await searchRedactionMatches(fileId, confirmedPassphrase, query, isRegex);
            setSearchMatches(res.matches || []);
            setSearchQuery(isRegex ? "" : query);
        } catch (error: any) {
            toast.error("Search failed: " + (error.message || "Unknown error"));
        } finally {
            setIsSearching(false);
        }
    };

    const handleApplyRedaction = async () => {
        if (!fileId) return;
        if (!confirmedPassphrase) {
            setShowPassphraseModal(true);
            return;
        }
        if (!hasPendingRedactions) {
            toast.error("Select detected entities or draw at least one redaction area first.");
            return;
        }
        setIsApplying(true);
        const loadingToast = toast.loading("Burnishing redactions into document...");

        try {
            const approvedEntities = entities.filter(e => e.approved !== false);
            const result = await applyRedaction(fileId, confirmedPassphrase, approvedEntities, manualBoxes, searchMatches);
            setRedactionResult(result);
            setRedactionComplete(true);
            setVerificationResult(null);
            setProofStatus(result.redaction_status === "failed" ? "failed" : "pending");

            if (result.file_id) {
                primeRedactedFileUrl(result.file_id, confirmedPassphrase).catch((error) => {
                    console.warn("Unable to prefetch redacted document", error);
                });
            }

            toast.success("Redaction applied successfully. Review the result panel for download and verification actions.", { id: loadingToast });
        } catch (error) {
            console.error("Redact failed", error);
            toast.error("Failed to apply redactions.", { id: loadingToast });
        } finally {
            setIsApplying(false);
        }
    };

    const verifyProofForFile = async (targetFileId: string, silent = false) => {
        if (!targetFileId) {
            if (!silent) {
                toast.error("No redacted document is available yet.");
            }
            return null;
        }

        if (!silent) {
            setProofStatus("pending");
        }
        try {
            const data = await verifyRedaction(targetFileId, { silent });
            const verified = data.proof_valid ?? data.valid_proof;
            setVerificationResult(data);
            if (verified) {
                setProofStatus("valid");
                if (!silent) {
                    toast.success("Redaction proof verified.");
                }
            } else if (data.status === "pending") {
                setProofStatus("pending");
                if (!silent) {
                    toast("Proof is still being generated.", { icon: "⏳" });
                }
            } else if (data.status === "failed") {
                setProofStatus("failed");
                if (!silent) {
                    toast.error(data.error || "Proof generation failed.");
                }
            } else {
                setProofStatus("invalid");
                if (!silent) {
                    toast.error("Proof verification failed.");
                }
            }
            return data;
        } catch (err) {
            const responseStatus =
                typeof err === "object" && err && "response" in err
                    ? (err as { response?: { status?: number } }).response?.status
                    : undefined;

            if (responseStatus === 429) {
                setProofStatus((current) => (current === "valid" ? current : "pending"));
                if (!silent) {
                    toast("Proof check is being throttled. Trying again shortly.", { icon: "⏳" });
                }
                return null;
            }

            setProofStatus((current) => (current === "valid" ? current : "pending"));
            if (!silent) {
                toast.error("Unable to check proof status.");
            }
            return null;
        }
    };

    const verifyProof = async (silent = false) => {
        return verifyProofForFile(activeRedactedFileId || "", silent);
    };

    useEffect(() => {
        if (!redactionComplete || !activeRedactedFileId) {
            return;
        }

        if (proofStatus === "valid" || proofStatus === "invalid" || proofStatus === "failed") {
            return;
        }

        let cancelled = false;

        const pollProofStatus = async () => {
            if (cancelled || proofPollingInFlightRef.current) {
                return;
            }

            proofPollingInFlightRef.current = true;
            try {
                await verifyProofForFile(activeRedactedFileId, true);
            } finally {
                proofPollingInFlightRef.current = false;
            }
        };

        void pollProofStatus();
        const intervalId = window.setInterval(() => {
            void pollProofStatus();
        }, 15000);

        return () => {
            cancelled = true;
            window.clearInterval(intervalId);
        };
    }, [activeRedactedFileId, proofStatus, redactionComplete]);

    const downloadRedacted = async () => {
        if (!activeRedactedFileId) {
            toast.error("No redacted document is available yet.");
            return;
        }
        if (!confirmedPassphrase) {
            setShowPassphraseModal(true);
            return;
        }

        const fallbackName = buildDownloadName(redactionResult?.name || fileName || "document.pdf", "_redacted");

        try {
            if (redactedFileUrl) {
                const anchor = document.createElement("a");
                anchor.href = redactedFileUrl;
                anchor.download = fallbackName;
                document.body.appendChild(anchor);
                anchor.click();
                anchor.remove();
                return;
            }

            try {
                const { blob, fileName: responseFileName } = await fetchBlobWithAuth(
                    `/files/${fileId}/download?variant=redacted`,
                    "application/pdf",
                );
                triggerBlobDownload(blob, responseFileName || fallbackName);
                return;
            } catch (primaryError) {
                console.warn("Primary redacted download endpoint unavailable, falling back to direct file fetch.", primaryError);
            }

            const { blob, fileName: responseFileName } = await fetchBlobWithAuth(
                `/files/${activeRedactedFileId}/content?key=${encodeURIComponent(confirmedPassphrase)}`,
                "application/pdf",
            );
            triggerBlobDownload(blob, responseFileName || fallbackName);
        } catch (error) {
            console.error("Failed to download redacted file", error);
            toast.error("Unable to download the redacted document.");
        }
    };

    const downloadCertificate = async () => {
        if (!activeRedactedFileId) {
            toast.error("No redaction certificate is available yet.");
            return;
        }

        const certificateFileName = `${buildDownloadName(redactionResult?.name || fileName || "document.pdf", "_certificate", ".json").replace(/\.pdf$/i, ".json")}`;

        try {
            try {
                const { blob, fileName: responseFileName } = await fetchBlobWithAuth(
                    `/files/${fileId}/certificate`,
                    "application/pdf, application/json",
                );
                triggerBlobDownload(blob, responseFileName || certificateFileName);
                return;
            } catch (primaryError) {
                console.warn("Certificate endpoint unavailable, falling back to generated JSON certificate.", primaryError);
            }

            const verifyData = verificationResult || await verifyProof(true);
            const certificatePayload = {
                source_file_id: redactionResult?.source_file_id || fileId,
                redacted_file_id: activeRedactedFileId,
                file_name: redactionResult?.name || fileName,
                generated_at: new Date().toISOString(),
                proof_status: proofStatus,
                proof_type: redactionResult?.proof_type || verifyData?.proof_type || null,
                proof_version: redactionResult?.proof_version || verifyData?.proof_version || null,
                original_hash: verifyData?.original_hash || null,
                redacted_hash: verifyData?.redacted_hash || redactionResult?.sha256 || null,
                original_root: verifyData?.original_root || null,
                redacted_root: verifyData?.redacted_root || null,
                modified_chunks: verifyData?.modified_chunks || [],
                anchor_hash: verifyData?.anchor_hash || redactionResult?.anchor_hash || null,
                anchor_tx: verifyData?.anchor_tx || redactionResult?.anchor_tx || null,
                redaction_mask: redactionResult?.redaction_mask || [],
            };

            const certificateBlob = new Blob([JSON.stringify(certificatePayload, null, 2)], {
                type: "application/json",
            });
            triggerBlobDownload(certificateBlob, certificateFileName);
            toast.success("Downloaded generated redaction certificate.");
        } catch (error) {
            console.error("Failed to download certificate", error);
            toast.error("Unable to download the redaction certificate.");
        }
    };

    const resultPanel = redactionComplete && activeRedactedFileId ? (
        <div className="border-t border-border bg-card/95 p-4 space-y-4 shadow-[0_-12px_30px_rgba(15,23,42,0.18)]">
            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4">
                <div className="flex items-start gap-3">
                    <div className="mt-0.5 rounded-full bg-emerald-500/15 p-2 text-emerald-400">
                        <CheckCircle2 className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                        <h3 className="text-sm font-semibold text-foreground">Redaction Completed</h3>
                        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                            The redacted copy is ready. Download the document, export the certificate, or verify the zero-knowledge proof.
                        </p>
                    </div>
                </div>
            </div>

            <div className="grid gap-2">
                <button
                    onClick={downloadRedacted}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90"
                >
                    <Download className="h-4 w-4" />
                    Download Redacted Document
                </button>
                <button
                    onClick={downloadCertificate}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-background px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted/50"
                >
                    <FileText className="h-4 w-4" />
                    Download Redaction Certificate
                </button>
                <button
                    onClick={() => verifyProof()}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-background px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted/50"
                >
                    <Shield className="h-4 w-4" />
                    {proofStatus === "pending" ? "Check Proof Status" : "Verify Proof"}
                </button>
            </div>

            {proofStatus === "pending" && (
                <div className="rounded-xl border border-sky-500/20 bg-sky-500/10 p-3 text-xs text-sky-100">
                    <div className="flex items-center gap-2 font-medium">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Generating zero-knowledge proof
                    </div>
                    <p className="mt-1 leading-relaxed text-sky-100/80">
                        The redacted copy is already saved. BlockVault is generating and verifying proof artifacts in the background.
                    </p>
                    {verificationResult?.progress && (
                        <div className="mt-2.5 space-y-1.5">
                            <div className="flex items-center justify-between text-[10px] text-sky-100/80 font-medium tracking-wide">
                                <span>Generating Proof {verificationResult.progress.current} of {verificationResult.progress.total}</span>
                                <span>{Math.round((verificationResult.progress.current / verificationResult.progress.total) * 100)}%</span>
                            </div>
                            <div className="h-1.5 w-full bg-sky-950/40 rounded-full overflow-hidden shadow-inner">
                                <div
                                    className="h-full bg-sky-400 rounded-full transition-all duration-500 ease-out"
                                    style={{ width: `${Math.round((verificationResult.progress.current / Math.max(1, verificationResult.progress.total)) * 100)}%` }}
                                />
                            </div>
                        </div>
                    )}
                    {(verificationResult?.modified_chunks?.length || verificationResult?.chunk_count) && (
                        <p className="mt-1 text-sky-100/70">
                            {verificationResult?.modified_chunks?.length
                                ? `${verificationResult.modified_chunks.length} modified chunk${verificationResult.modified_chunks.length === 1 ? "" : "s"}`
                                : "Chunk metadata loaded"}
                            {verificationResult?.chunk_count
                                ? ` across ${verificationResult.chunk_count} total chunk${verificationResult.chunk_count === 1 ? "" : "s"}`
                                : ""}
                            .
                        </p>
                    )}
                    <p className="mt-1 text-sky-100/70">This panel updates automatically while the worker is generating proofs.</p>
                </div>
            )}

            <div className={`rounded-xl border px-3 py-2 text-xs font-medium ${proofStatus === "valid"
                ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
                : proofStatus === "failed"
                    ? "border-amber-500/20 bg-amber-500/10 text-amber-300"
                : proofStatus === "invalid"
                    ? "border-rose-500/20 bg-rose-500/10 text-rose-400"
                    : "border-amber-500/20 bg-amber-500/10 text-amber-400"
                }`}>
                {proofStatus === "valid" && "✓ Proof Verified"}
                {proofStatus === "failed" && "⚠ Proof Generation Failed"}
                {proofStatus === "invalid" && "⚠ Proof Invalid"}
                {proofStatus === "pending" && "Processing Proof..."}
                {!proofStatus && "Proof has not been checked yet."}
            </div>

            {proofStatus === "failed" && verificationResult?.error && (
                <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-100/90">
                    {verificationResult.error}
                </div>
            )}

            {(verificationResult?.original_hash || verificationResult?.redacted_hash) && (
                <div className="space-y-2 rounded-xl border border-border bg-muted/20 p-3 text-[11px] text-muted-foreground">
                    {verificationResult?.original_hash && (
                        <p className="truncate">
                            Original hash: <span className="font-mono text-foreground">{verificationResult.original_hash}</span>
                        </p>
                    )}
                    {verificationResult?.redacted_hash && (
                        <p className="truncate">
                            Redacted hash: <span className="font-mono text-foreground">{verificationResult.redacted_hash}</span>
                        </p>
                    )}
                </div>
            )}
        </div>
    ) : null;

    if (loading || isLoadingDocument) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[600px] h-full p-4">
                <DocumentSkeleton />
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
                    {redactionComplete && activeRedactedFileId && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            {proofStatus === "pending" ? (
                                <Loader2 className="w-4 h-4 animate-spin text-sky-400" />
                            ) : (
                                <CheckCircle2 className={`w-4 h-4 ${proofStatus === "valid" ? "text-green-500" : proofStatus === "failed" ? "text-amber-400" : "text-amber-400"}`} />
                            )}
                            Proof status: <span className="font-medium text-foreground">{proofStatusLabel}</span>
                            <button
                                onClick={() => verifyProof()}
                                className="ml-2 text-xs text-primary hover:underline"
                            >
                                {proofStatus === "pending" ? "Check now" : "Verify"}
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
                        isApplying ? (
                            <div className="flex-1 flex flex-col items-center justify-center p-8 bg-muted/5">
                                <RedactionProgress stage="applying" />
                            </div>
                        ) : (
                            <DocumentViewer
                                file={documentUrl}
                                entities={entities}
                                manualBoxes={manualBoxes}
                                searchMatches={searchMatches}
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
                                selectedBoxId={selectedBoxId}
                                hoveredEntityId={hoveredEntityId}
                                onSelectBox={setSelectedBoxId}
                                onHoverEntity={setHoveredEntityId}
                            />
                        )
                    ) : (
                        <div className="flex-1 flex items-center justify-center bg-muted/10 text-muted-foreground p-8 text-center">
                            Failed to decrypt or load document for viewing.
                        </div>
                    )}
                </div>

                {/* Sidebar Pane */}
                <div className="w-80 shrink-0 pointer-events-auto h-full z-20 flex flex-col bg-card border-l shadow-xl">
                    <div className="p-4 border-b bg-muted/10">
                        <h3 className="text-sm font-semibold mb-2">Find Text to Redact</h3>
                        <div className="flex gap-2 mb-2">
                            <input
                                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                                placeholder="John Smith, Acme Corp"
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') handleSearch(searchQuery) }}
                                disabled={isSearching || !documentUrl}
                            />
                            <button
                                onClick={() => handleSearch(searchQuery)}
                                disabled={!searchQuery || isSearching || !documentUrl}
                                className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80 h-9 px-3 shrink-0"
                            >
                                {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                            </button>
                        </div>
                        <div className="flex flex-wrap gap-1.5 mb-2">
                            <button onClick={() => handleSearch("[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[A-Za-z]{2,}", true)} disabled={isSearching || !documentUrl} className="text-[10px] px-2 py-1 bg-background border rounded hover:bg-muted disabled:opacity-50 transition-colors">Emails</button>
                            <button onClick={() => handleSearch("\\+?[0-9]{10,}", true)} disabled={isSearching || !documentUrl} className="text-[10px] px-2 py-1 bg-background border rounded hover:bg-muted disabled:opacity-50 transition-colors">Phones</button>
                            <button onClick={() => handleSearch("\\b\\d{3}-\\d{2}-\\d{4}\\b", true)} disabled={isSearching || !documentUrl} className="text-[10px] px-2 py-1 bg-background border rounded hover:bg-muted disabled:opacity-50 transition-colors">SSN</button>
                            <button onClick={() => handleSearch("\\d{4}[ -]?\\d{4}[ -]?\\d{4}[ -]?\\d{4}", true)} disabled={isSearching || !documentUrl} className="text-[10px] px-2 py-1 bg-background border rounded hover:bg-muted disabled:opacity-50 transition-colors">Cards</button>
                        </div>
                        {searchMatches.length > 0 && (
                            <div className="flex items-center justify-between text-xs mt-3 pt-3 border-t">
                                <span className="text-muted-foreground">Matches Found: <strong className="text-foreground">{searchMatches.length}</strong></span>
                                <div className="flex gap-3">
                                    <button onClick={() => setSearchMatches([])} className="text-muted-foreground hover:text-foreground transition-colors font-medium">Clear</button>
                                    <button onClick={() => toast.success(`${searchMatches.length} matches queued for redaction. Click 'Apply & Create Copy' to redact.`)} className="text-primary hover:underline font-medium">Redact All</button>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="min-h-0 flex-1 flex flex-col">
                        {isAnalyzed ? (
                            <div className="animate-in slide-in-from-right-8 duration-300 flex-1 min-h-0 flex flex-col h-full w-full">
                                <EntitySidebar
                                    redactionComplete={redactionComplete}
                                    entities={entities}
                                    manualBoxes={manualBoxes}
                                    onToggleEntity={handleToggleEntity}
                                    onDeleteManualEntity={handleDeleteManualEntity}
                                    onApplyRedaction={handleApplyRedaction}
                                    isApplying={isApplying}
                                    hoveredEntityId={hoveredEntityId}
                                    onHoverEntity={setHoveredEntityId}
                                />
                            </div>
                        ) : (
                            <div className="flex flex-col h-full bg-card">
                                <div className="p-4 border-b bg-muted/10">
                                    <h2 className="text-lg font-semibold">Redaction Workflow</h2>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        Scan for detected entities or draw manual redaction areas, then create a redacted copy.
                                    </p>
                                </div>

                                <div className="flex-1 p-4 space-y-4 text-sm">
                                    <div className="rounded-xl border border-border bg-muted/20 p-3">
                                        <p className="font-medium">1. Detect sensitive data</p>
                                        <p className="mt-1 text-xs text-muted-foreground">
                                            Use <span className="font-medium text-foreground">Scan for Sensitive Data</span> to find names, emails, IDs, and other detected entities.
                                        </p>
                                    </div>

                                    <div className="rounded-xl border border-border bg-muted/20 p-3">
                                        <p className="font-medium">2. Add manual redactions</p>
                                        <p className="mt-1 text-xs text-muted-foreground">
                                            Use the <span className="font-medium text-foreground">Area</span> tool in the toolbar to draw redaction boxes anywhere on the page.
                                        </p>
                                    </div>

                                    <div className="rounded-xl border border-border bg-muted/20 p-3 space-y-2">
                                        <div className="flex items-center justify-between">
                                            <span className="text-muted-foreground">Detected entities</span>
                                            <span className="font-semibold">{approvedEntityCount}</span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-muted-foreground">Manual areas</span>
                                            <span className="font-semibold">{manualBoxes.length}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="p-4 border-t bg-card mt-auto space-y-3">
                                    <button
                                        onClick={handleAnalyze}
                                        disabled={isAnalyzing || !confirmedPassphrase}
                                        className="w-full inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground shadow hover:bg-primary/90 h-9 px-4 py-2"
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
                                    <button
                                        onClick={handleApplyRedaction}
                                        disabled={isApplying || !hasPendingRedactions}
                                        className={`w-full inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors h-9 px-4 py-2 ${isApplying || !hasPendingRedactions
                                            ? "bg-muted text-muted-foreground cursor-not-allowed"
                                            : "bg-slate-900 text-slate-100 hover:bg-black"
                                            }`}
                                    >
                                        {isApplying ? "Applying Redactions..." : "Apply & Create Copy"}
                                    </button>
                                    <p className="text-[10px] text-center text-muted-foreground leading-tight">
                                        You can apply redaction after you approve detected entities or draw at least one manual redaction box.
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                    {resultPanel}
                </div>
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
                    className="border-white/14 bg-[rgba(3,7,18,0.72)] shadow-[0_28px_90px_rgba(2,6,23,0.72)] ring-1 ring-white/8"
                    contentClassName="space-y-6"
                    overlayClassName="bg-black/78 backdrop-blur-[2px]"
                    footer={(
                        <div className="flex justify-end gap-3">
                            <button
                                className="px-4 py-2 text-sm rounded-lg border border-slate-700 text-slate-200 hover:bg-slate-800"
                                disabled={isUnlockingDocument}
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
                                className={`px-4 py-2 text-sm rounded-lg font-medium transition-colors ${canContinuePassphrase
                                    ? "bg-blue-600 text-white border border-blue-500 hover:bg-blue-500"
                                    : "bg-slate-700 text-slate-400 border border-slate-600 cursor-not-allowed"
                                    }`}
                                onClick={handleConfirmPassphrase}
                                disabled={!canContinuePassphrase || isUnlockingDocument}
                            >
                                {isUnlockingDocument ? "Decrypting..." : "Continue"}
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
                                    if (e.key === 'Enter' && canContinuePassphrase && !isUnlockingDocument) {
                                        void handleConfirmPassphrase();
                                    }
                                }}
                                className="w-full rounded-xl border border-white/12 bg-white/[0.045] px-4 py-3 text-white placeholder:text-slate-500 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] focus:outline-none focus:ring-2 focus:ring-primary-500/60 focus:border-primary-400/30"
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
