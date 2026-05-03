import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { 
  FileText, 
  Shield, 
  PenTool, 
  Brain, 
  Search, 
  Plus, 
  Grid3x3,
  List,
  Trash2,
  Download,
  CheckCircle,
  MoreVertical,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GlowingSeparator } from "@/components/ui/glowing-separator";
import { GlowingDivider } from "@/components/ui/GlowingDivider";
import { ScrollingText } from "@/components/ui/ScrollingText";
import { NotarizeDocumentModal } from "@/components/legal/modals/NotarizeDocumentModal";
import { LegalDocumentUploadModal } from "@/components/legal/modals/LegalDocumentUploadModal";
import { RedactionModal } from "@/components/legal/modals/RedactionModal";
import { RequestSignatureModal } from "@/components/legal/modals/RequestSignatureModal";
import { ZKMLAnalysisModal } from "@/components/legal/modals/ZKMLAnalysisModal";
import { RevokeAccessModal } from "@/components/legal/modals/RevokeAccessModal";
import { RevokeDocumentModal } from "@/components/legal/modals/RevokeDocumentModal";
import { SignatureRequests } from "@/components/legal/modals/SignatureRequests";
import { SentSignatureRequests } from "@/components/legal/modals/SentSignatureRequests";
import { useRBACOptional } from "@/contexts/RBACContext";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import toast from 'react-hot-toast';
import { getLegalDocumentKey, removeLegalDocumentKey } from "@/utils/legalDocumentKeys";
import { cn } from "@/lib/utils";
import { getApiBase as resolveApiBase } from '@/lib/getApiBase';
import { readStoredUser } from '@/utils/authStorage';

export default function LegalPage() {
  const rbac = useRBACOptional();
  const API_BASE = resolveApiBase();

  const canPerformAction = (permission: string) => {
    if (!rbac?.canPerformAction) {
      return true;
    }
    return rbac.canPerformAction(permission as any);
  };
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTab, setSelectedTab] = useState<'documents' | 'signatures' | 'sent-signatures' | 'analysis'>('documents');
  const [showNotarizeModal, setShowNotarizeModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showRedactionModal, setShowRedactionModal] = useState(false);
  const [showZKMLModal, setShowZKMLModal] = useState(false);
  const [showRequestSignatureModal, setShowRequestSignatureModal] = useState(false);
  const [showRevokeAccessModal, setShowRevokeAccessModal] = useState(false);
  const [showRevokeDocumentModal, setShowRevokeDocumentModal] = useState(false);
  const [selectedDocuments, setSelectedDocuments] = useState<any[]>([]);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [downloadingDocId, setDownloadingDocId] = useState<string | null>(null);
  const [redactionQueue, setRedactionQueue] = useState<any[]>([]);
  const [currentRedactionDocument, setCurrentRedactionDocument] = useState<any | null>(null);
  const [redactionModalKey, setRedactionModalKey] = useState(0);
  const [signatureQueue, setSignatureQueue] = useState<any[]>([]);
  const [currentSignatureDocument, setCurrentSignatureDocument] = useState<any | null>(null);
  const [signatureModalKey, setSignatureModalKey] = useState(0);
  const [analysisDocument, setAnalysisDocument] = useState<any | null>(null);
  const [actionDoc, setActionDoc] = useState<any | null>(null);
  const [pendingDeleteDoc, setPendingDeleteDoc] = useState<any | null>(null);
  const hintTimeoutRef = useRef<number | null>(null);
  const touchTimerRef = useRef<number | null>(null);
  const touchStartPointRef = useRef<{ x: number; y: number } | null>(null);
  const longPressTriggeredRef = useRef(false);
  const [hasSeenActionHint, setHasSeenActionHint] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    return localStorage.getItem('bv_right_click_hint') === 'true';
  });
  const [showActionHint, setShowActionHint] = useState(false);
  const [hintTargetKey, setHintTargetKey] = useState<string | null>(null);
  const gridRef = useRef<HTMLDivElement | null>(null);
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const pointerOriginRef = useRef<{ x: number; y: number } | null>(null);
  const marqueeHasSelectionRef = useRef(false);
  const [isMarqueeSelecting, setIsMarqueeSelecting] = useState(false);
  const [marqueeRect, setMarqueeRect] = useState<{ left: number; top: number; width: number; height: number } | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Load legal documents from localStorage
  const [legalDocuments, setLegalDocuments] = useState<any[]>(() => {
    const storedDocs = JSON.parse(localStorage.getItem('legal_documents') || '[]');
    return storedDocs;
  });

  // Pre-compute document keys and optimize filtering
  const documentsWithKeys = useMemo(() => 
    legalDocuments.map(doc => ({
      ...doc,
      _key: doc?.file_id ?? doc?.id ?? doc?.name
    })),
    [legalDocuments]
  );
  
  const filteredDocuments = useMemo(() => {
    if (!searchQuery.trim()) return documentsWithKeys;
    const lowerQuery = searchQuery.toLowerCase();
    return documentsWithKeys.filter(doc =>
      doc.name?.toLowerCase().includes(lowerQuery)
    );
  }, [documentsWithKeys, searchQuery]);

  const refreshDocuments = () => {
    const storedDocs = JSON.parse(localStorage.getItem('legal_documents') || '[]');
    setLegalDocuments(storedDocs);
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setHasSeenActionHint(localStorage.getItem('bv_right_click_hint') === 'true');
    return () => {
      if (hintTimeoutRef.current) {
        window.clearTimeout(hintTimeoutRef.current);
      }
      if (touchTimerRef.current) {
        window.clearTimeout(touchTimerRef.current);
      }
    };
  }, []);

  const registerCardRef = useCallback(
    (key: string) => (node: HTMLDivElement | null) => {
      if (node) {
        cardRefs.current[key] = node;
      } else {
        delete cardRefs.current[key];
      }
    },
    []
  );

  // Optimize stats calculation with single-pass useMemo
  const stats = useMemo(() => {
    let notarized = 0, signaturesPending = 0, aiAnalyzed = 0;
    legalDocuments.forEach(doc => {
      if (doc.blockchainHash) notarized++;
      if (doc.status === 'awaiting_signatures') signaturesPending++;
      if (doc.aiAnalysis) aiAnalyzed++;
    });
    return [
      { label: "Total Documents", value: legalDocuments.length.toString(), icon: FileText },
      { label: "Notarized", value: notarized.toString(), icon: Shield },
      { label: "Signatures Pending", value: signaturesPending.toString(), icon: PenTool },
      { label: "AI Analyzed", value: aiAnalyzed.toString(), icon: Brain },
    ];
  }, [legalDocuments]);

  const getDocumentKey = useCallback((doc: any) => doc?._key ?? doc?.file_id ?? doc?.id ?? doc?.name, []);

  useEffect(() => {
    const existingKeys = new Set(documentsWithKeys.map(doc => doc._key));
    setSelectedDocuments((prev) =>
      prev.filter((doc) => existingKeys.has(getDocumentKey(doc))),
    );
  }, [documentsWithKeys, getDocumentKey]);

  const selectedCount = selectedDocuments.length;
  const selectedDocsWithFileId = useMemo(
    () => selectedDocuments.filter((doc) => !!doc?.file_id),
    [selectedDocuments],
  );

  const clearSelection = () => setSelectedDocuments([]);

  const toggleDocumentSelection = (doc: any) => {
    const key = getDocumentKey(doc);
    setSelectedDocuments((prev) => {
      const exists = prev.some((item) => getDocumentKey(item) === key);
      if (exists) {
        return prev.filter((item) => getDocumentKey(item) !== key);
      }
      return [...prev, doc];
    });
  };

  const ensureDocumentSelected = (doc: any) => {
    const key = getDocumentKey(doc);
    setSelectedDocuments((prev) => {
      const exists = prev.some((item) => getDocumentKey(item) === key);
      if (exists) {
        return prev;
      }
      return [...prev, doc];
    });
  };

  const triggerActionHint = (docKey: string) => {
    if (hasSeenActionHint || showActionHint) {
      return;
    }
    setHintTargetKey(docKey);
    setShowActionHint(true);
    setHasSeenActionHint(true);
    if (typeof window !== 'undefined') {
      localStorage.setItem('bv_right_click_hint', 'true');
      if (hintTimeoutRef.current) {
        window.clearTimeout(hintTimeoutRef.current);
      }
      hintTimeoutRef.current = window.setTimeout(() => {
        setShowActionHint(false);
        hintTimeoutRef.current = null;
      }, 2500);
    }
  };

  const clearLongPressTimer = () => {
    if (touchTimerRef.current) {
      window.clearTimeout(touchTimerRef.current);
      touchTimerRef.current = null;
    }
    touchStartPointRef.current = null;
  };

  const handleGridMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest('[data-no-marquee="true"]')) {
      return;
    }
    if (!gridRef.current) return;

    pointerOriginRef.current = { x: e.clientX, y: e.clientY };
    marqueeHasSelectionRef.current = false;
    setIsMarqueeSelecting(true);
    setMarqueeRect(null);
    setShowActionHint(false);

    const origin = { x: e.clientX, y: e.clientY };
    const containerRect = gridRef.current.getBoundingClientRect();

    const handlePointerMove = (ev: MouseEvent) => {
      if (!pointerOriginRef.current || !gridRef.current) return;
      const current = { x: ev.clientX, y: ev.clientY };
      const width = Math.abs(current.x - origin.x);
      const height = Math.abs(current.y - origin.y);

      if (width < 2 && height < 2) {
        setMarqueeRect(null);
        marqueeHasSelectionRef.current = false;
        return;
      }

      marqueeHasSelectionRef.current = true;

      const selectionRect = {
        left: Math.min(origin.x, current.x),
        top: Math.min(origin.y, current.y),
        right: Math.max(origin.x, current.x),
        bottom: Math.max(origin.y, current.y),
      };

      const containerScrollLeft = gridRef.current.scrollLeft ?? 0;
      const containerScrollTop = gridRef.current.scrollTop ?? 0;

      setMarqueeRect({
        left: selectionRect.left - containerRect.left + containerScrollLeft,
        top: selectionRect.top - containerRect.top + containerScrollTop,
        width,
        height,
      });

      const newlySelected: any[] = [];
      const seenKeys = new Set<string>();

      filteredDocuments.forEach((doc) => {
        const docKey = getDocumentKey(doc);
        const node = cardRefs.current[docKey];
        if (!node) return;
        const cardRect = node.getBoundingClientRect();
        if (
          selectionRect.right >= cardRect.left &&
          selectionRect.left <= cardRect.right &&
          selectionRect.bottom >= cardRect.top &&
          selectionRect.top <= cardRect.bottom
        ) {
          if (!seenKeys.has(docKey)) {
            newlySelected.push(doc);
            seenKeys.add(docKey);
          }
        }
      });

      setSelectedDocuments(newlySelected);
    };

    const handlePointerUp = () => {
      window.removeEventListener('mousemove', handlePointerMove);
      window.removeEventListener('mouseup', handlePointerUp);
      clearLongPressTimer();
      pointerOriginRef.current = null;
      setIsMarqueeSelecting(false);
      setMarqueeRect(null);
      setTimeout(() => {
        marqueeHasSelectionRef.current = false;
      }, 0);
    };

    window.addEventListener('mousemove', handlePointerMove);
    window.addEventListener('mouseup', handlePointerUp);
    e.preventDefault();
  };

  const startRedactionBatch = (docs: any[]) => {
    const sanitizedDocs = docs.filter((doc) => !!doc?.file_id);
    if (!sanitizedDocs.length) {
      toast.error('Select at least one document with a valid file ID for redaction.');
      return;
    }
    setRedactionQueue(sanitizedDocs);
    setCurrentRedactionDocument(sanitizedDocs[0]);
    setRedactionModalKey((key) => key + 1);
    setShowRedactionModal(true);
  };

  const startSignatureBatch = (docs: any[]) => {
    const sanitizedDocs = docs.filter((doc) => !!doc?.file_id);
    if (!sanitizedDocs.length) {
      toast.error('Select at least one document with a valid file ID for signature requests.');
      return;
    }
    setSignatureQueue(sanitizedDocs);
    setCurrentSignatureDocument(sanitizedDocs[0]);
    setSignatureModalKey((key) => key + 1);
    setShowRequestSignatureModal(true);
  };

  const openActionPanelForDoc = (doc: any) => {
    ensureDocumentSelected(doc);
    if (!doc?.file_id) {
      toast.error('This document does not have a valid file ID yet.');
      return;
    }
    setActionDoc(doc);
  };
  const confirmDeleteDocument = (doc: any) => {
    setPendingDeleteDoc(doc);
  };

  const handleRedactionClose = () => {
    setShowRedactionModal(false);
    setRedactionQueue([]);
    setCurrentRedactionDocument(null);
  };

  const handleRedactionSuccess = () => {
    const processedDoc = currentRedactionDocument;
    if (processedDoc) {
      const processedKey = getDocumentKey(processedDoc);
      setSelectedDocuments((prev) =>
        prev.filter((item) => getDocumentKey(item) !== processedKey),
      );
    }
    refreshDocuments();
    setRedactionQueue((prev) => {
      const [, ...rest] = prev;
      if (rest.length === 0) {
        handleRedactionClose();
        toast.success('Redaction completed.');
      } else {
        setCurrentRedactionDocument(rest[0]);
        setRedactionModalKey((key) => key + 1);
      }
      return rest;
    });
  };

  const handleSignatureClose = () => {
    setShowRequestSignatureModal(false);
    setSignatureQueue([]);
    setCurrentSignatureDocument(null);
  };

  const handleSignatureSuccess = () => {
    const processedDoc = currentSignatureDocument;
    if (processedDoc) {
      const processedKey = getDocumentKey(processedDoc);
      setSelectedDocuments((prev) =>
        prev.filter((item) => getDocumentKey(item) !== processedKey),
      );
    }
    refreshDocuments();
    setSignatureQueue((prev) => {
      const [, ...rest] = prev;
      if (rest.length === 0) {
        handleSignatureClose();
        toast.success('Signature requests sent.');
      } else {
        setCurrentSignatureDocument(rest[0]);
        setSignatureModalKey((key) => key + 1);
      }
      return rest;
    });
  };

  const getAuthHeaders = () => {
    const user = readStoredUser() || {};
    if (!user.jwt) {
      throw new Error('Authentication required. Please log in again.');
    }
    return {
      Authorization: `Bearer ${user.jwt}`,
    };
  };

  const downloadLegalDocument = async (doc: any) => {
    if (!doc?.file_id) {
      toast.error('This document is missing a file identifier.');
      return;
    }

    const passphrase = getLegalDocumentKey(doc.file_id);
    if (!passphrase) {
      toast.error('Encryption key not found for this document.');
      return;
    }

    try {
      setDownloadingDocId(doc.file_id);
      const headers = getAuthHeaders();
      const response = await fetch(`${API_BASE}/files/${doc.file_id}?key=${encodeURIComponent(passphrase)}`, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        throw new Error(`Download failed (${response.status})`);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      const fileName = doc.name || `document_${doc.file_id}`;
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast.success('Document download started.');
    } catch (error) {
      console.error('Failed to download legal document:', error);
      toast.error(error instanceof Error ? error.message : 'Unable to download document.');
    } finally {
      setDownloadingDocId(null);
    }
  };

  const handleOpenRedactionModal = () => {
    if (!selectedDocsWithFileId.length) {
      toast.error('Select at least one document to redact.');
      return;
    }
    startRedactionBatch(selectedDocsWithFileId);
  };

  const handleOpenSignatureModal = () => {
    if (!selectedDocsWithFileId.length) {
      toast.error('Select at least one document to request signatures for.');
      return;
    }
    startSignatureBatch(selectedDocsWithFileId);
  };

  const handleOpenZKMLModal = () => {
    if (!selectedDocsWithFileId.length) {
      toast.error('Select a document to analyze.');
      return;
    }
    if (selectedDocsWithFileId.length > 1) {
      toast.error('Please select only one document for AI analysis.');
      return;
    }
    setAnalysisDocument(selectedDocsWithFileId[0]);
    setShowZKMLModal(true);
  };

  const handleNotarizeSuccess = () => {
    setShowNotarizeModal(false);
    refreshDocuments();
  };

  const handleUploadSuccess = () => {
    setShowUploadModal(false);
    refreshDocuments();
  };

  const handleDeleteDocument = (doc: any) => {
    if (!doc) return;

    try {
      if (doc.file_id) {
        removeLegalDocumentKey(doc.file_id);
      }

      const updatedDocs = legalDocuments.filter(existing => {
        if (doc.file_id && existing.file_id) {
          return existing.file_id !== doc.file_id;
        }
        return existing.id !== doc.id;
      });
      localStorage.setItem('legal_documents', JSON.stringify(updatedDocs));
      setLegalDocuments(updatedDocs);

      setSelectedDocuments((prev) =>
        prev.filter((item) => getDocumentKey(item) !== getDocumentKey(doc)),
      );

      toast.success('Document deleted successfully');
    } catch (error) {
      console.error('Failed to delete document:', error);
      toast.error('Failed to delete document. Please try again.');
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <section className="rounded-3xl border border-borderAccent/30 bg-card-muted/60 p-6 shadow-[0_35px_70px_-28px_rgba(15,23,42,0.65)] backdrop-blur">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center">
          <div className="flex-1 space-y-4">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground/80">
                  Legal Operations
                </p>
                <h1 className="text-3xl font-semibold">Legal Workflows</h1>
                <p className="text-sm text-muted-foreground mt-2">
                  Notarization, signatures, redaction, and AI analysis
                </p>
              </div>
              {selectedCount > 0 && (
                <span className="text-sm text-muted-foreground">
                  {selectedCount} selected
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {selectedCount > 0 && (
                <Button variant="ghost" size="sm" onClick={clearSelection}>
                  Clear Selection
                </Button>
              )}
              <Button variant="outline" size="sm" className="gap-2" onClick={() => setShowUploadModal(true)}>
                <Plus className="h-4 w-4" />
                Upload Document
              </Button>
              {canPerformAction('canNotarizeDocuments') && (
                <Button variant="outline" size="sm" className="gap-2" onClick={() => setShowNotarizeModal(true)}>
                  <Shield className="h-4 w-4" />
                  Notarize
                </Button>
              )}
              {canPerformAction('canCreateRedactions') && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={handleOpenRedactionModal}
                  disabled={!selectedDocsWithFileId.length}
                >
                  <FileText className="h-4 w-4" />
                  {selectedDocsWithFileId.length > 1
                    ? `Redact (${selectedDocsWithFileId.length})`
                    : 'Redact'}
                </Button>
              )}
              {canPerformAction('canRequestSignatures') && (
                <Button
                  className="gap-2"
                  onClick={handleOpenSignatureModal}
                  disabled={!selectedDocsWithFileId.length}
                >
                  <PenTool className="h-4 w-4" />
                  {selectedDocsWithFileId.length > 1
                    ? `Request Signatures (${selectedDocsWithFileId.length})`
                    : 'Request Signature'}
                </Button>
              )}
            </div>
          </div>

          <GlowingDivider className="hidden lg:block mx-10 self-stretch" />
          <GlowingDivider orientation="horizontal" className="lg:hidden my-4" />

          <div className="w-full max-w-sm rounded-2xl border border-borderAccent/30 bg-card/70 p-5 shadow-[0_25px_60px_-30px_rgba(59,130,246,0.45)]">
            <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Workflow Snapshot</p>
            <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
              {[
                { label: "Documents", value: stats[0]?.value || "0" },
                { label: "Notarized", value: stats[1]?.value || "0" },
                { label: "Signatures Pending", value: stats[2]?.value || "0" },
                { label: "AI Analyzed", value: stats[3]?.value || "0" },
              ].map((metric) => (
                <div key={metric.label}>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">{metric.label}</p>
                  <p className="text-lg font-semibold">{metric.value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <GlowingSeparator className="opacity-70" />

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <Card key={stat.label} className="p-5 hover:border-primary/50 transition-all hover:-translate-y-1 cursor-pointer">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{stat.label}</p>
                <p className="text-2xl font-semibold mt-2">{stat.value}</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <stat.icon className="h-6 w-6 text-primary" />
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            ref={searchInputRef}
            placeholder="Search legal documents..." 
            className="pl-10" 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-border p-1">
          <Button
            variant={viewMode === "grid" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setViewMode("grid")}
            className="h-8 px-3"
          >
            <Grid3x3 className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === "list" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setViewMode("list")}
            className="h-8 px-3"
          >
            <List className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={selectedTab} onValueChange={(value) => setSelectedTab(value as any)}>
        <TabsList>
          <TabsTrigger value="documents" className="gap-2">
            <FileText className="h-4 w-4" />
            Documents
          </TabsTrigger>
          <TabsTrigger value="signatures" className="gap-2">
            <PenTool className="h-4 w-4" />
            Signature Requests
          </TabsTrigger>
          <TabsTrigger value="sent-signatures" className="gap-2">
            <PenTool className="h-4 w-4" />
            Sent Requests
          </TabsTrigger>
          <TabsTrigger value="analysis" className="gap-2">
            <Brain className="h-4 w-4" />
            AI Analysis
          </TabsTrigger>
        </TabsList>

        <TabsContent value="documents" className="mt-4">
          {filteredDocuments.length === 0 ? (
            <Card className="p-12 text-center">
              <FileText className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">No Documents</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Upload your first document to get started
              </p>
              <div className="flex gap-3 justify-center">
                <Button onClick={() => setShowUploadModal(true)} variant="outline">
                  <Plus className="h-4 w-4 mr-2" />
                  Upload Document
                </Button>
                {canPerformAction('canNotarizeDocuments') && (
                  <Button onClick={() => setShowNotarizeModal(true)}>
                    <Shield className="h-4 w-4 mr-2" />
                    Notarize Document
                  </Button>
                )}
              </div>
            </Card>
          ) : (
            <div
              ref={gridRef}
              onMouseDown={handleGridMouseDown}
              className={`relative ${viewMode === "grid" ? "grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3" : "space-y-2"}`}
            >
              {filteredDocuments.map((doc) => {
                const key = getDocumentKey(doc);
                const isSelected = selectedDocuments.some(
                  (item) => getDocumentKey(item) === key,
                );

                return (
                  <Card
                    ref={registerCardRef(key)}
                    key={key}
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      if (marqueeHasSelectionRef.current) {
                        marqueeHasSelectionRef.current = false;
                        return;
                      }
                      if (longPressTriggeredRef.current) {
                        longPressTriggeredRef.current = false;
                        return;
                      }
                      if ((e.detail ?? 1) > 1) {
                        return;
                      }
                      toggleDocumentSelection(doc);
                    }}
                    onDoubleClick={(e) => {
                      e.preventDefault();
                      openActionPanelForDoc(doc);
                    }}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      openActionPanelForDoc(doc);
                    }}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        if (e.key === ' ') {
                          e.preventDefault();
                        }
                        toggleDocumentSelection(doc);
                      }
                      if (e.key === 'Enter') {
                        openActionPanelForDoc(doc);
                      }
                    }}
                    onMouseEnter={() => triggerActionHint(key)}
                    onFocus={() => triggerActionHint(key)}
                    onTouchStart={(e) => {
                      clearLongPressTimer();
                      longPressTriggeredRef.current = false;
                      if (e.touches.length === 1) {
                        const touch = e.touches[0];
                        touchStartPointRef.current = { x: touch.clientX, y: touch.clientY };
                        touchTimerRef.current = window.setTimeout(() => {
                          longPressTriggeredRef.current = true;
                          openActionPanelForDoc(doc);
                          clearLongPressTimer();
                        }, 350);
                      }
                    }}
                    onTouchMove={(e) => {
                      if (!touchStartPointRef.current || e.touches.length !== 1) return;
                      const touch = e.touches[0];
                      const dx = Math.abs(touch.clientX - touchStartPointRef.current.x);
                      const dy = Math.abs(touch.clientY - touchStartPointRef.current.y);
                      if (dx > 10 || dy > 10) {
                        clearLongPressTimer();
                      }
                    }}
                    onTouchEnd={() => clearLongPressTimer()}
                    onTouchCancel={() => clearLongPressTimer()}
                    className={cn(
                      'relative group cursor-context-menu p-4 transition-colors border bg-card shadow-sm',
                      isSelected
                        ? 'border-primary/60 bg-primary/5 shadow-[0_0_20px_rgba(59,130,246,0.25)]'
                        : 'hover:border-primary/40 hover:bg-primary/10 dark:hover:bg-slate-900/40',
                    )}
                  >
                  {isSelected && (
                    <div className="pointer-events-none absolute -top-3 left-3 flex items-center gap-1 rounded-full border border-primary/40 bg-background/95 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary shadow-[0_15px_40px_-25px_rgba(59,130,246,0.45)] dark:bg-slate-950/95">
                      <CheckCircle className="h-3 w-3" />
                      <span>Selected</span>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      openActionPanelForDoc(doc);
                    }}
                    data-no-marquee="true"
                    aria-label="Open document actions"
                    className="absolute right-3 top-3 flex h-8 w-8 -translate-y-1 items-center justify-center rounded-lg bg-slate-900/40 text-slate-300 opacity-0 transition-all duration-150 group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:opacity-100 hover:bg-slate-900/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                  >
                    <MoreVertical className="h-4 w-4" />
                  </button>
                  {showActionHint && hintTargetKey === key && (
                    <div className="pointer-events-none absolute -top-2 right-16 flex items-center gap-2 rounded-lg border border-primary/30 bg-background/95 px-3 py-2 text-xs text-muted-foreground shadow-[0_25px_60px_-20px_rgba(59,130,246,0.3)] dark:bg-slate-950/95 dark:text-slate-200">
                      <span>Right-click or use ⋮ for document actions</span>
                      <div className="absolute -right-1 top-1/2 h-3 w-3 -translate-y-1/2 rotate-45 border border-primary/30 border-l-transparent border-t-transparent bg-background/95 dark:bg-slate-950/95" />
                    </div>
                  )}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <FileText className="h-8 w-8 text-primary" />
                      <div>
                        <ScrollingText
                          text={doc.name}
                          className="font-medium text-sm text-white max-w-[220px]"
                        />
                        <p className="text-xs text-muted-foreground">{doc.status}</p>
                        {!doc.file_id && (
                          <p className="text-xs text-amber-400 mt-1">
                            File ID unavailable – complete notarization to enable actions.
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                  {doc.blockchainHash && (
                    <div className="flex items-center gap-1 text-xs text-green-500">
                      <Shield className="h-3 w-3" />
                      <span>Blockchain Verified</span>
                    </div>
                  )}
                  <div className="mt-4 flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2"
                      disabled={downloadingDocId === doc.file_id}
                      onClick={(e) => {
                        e.stopPropagation();
                        downloadLegalDocument(doc);
                      }}
                      data-no-marquee="true"
                    >
                      <Download className="h-4 w-4" />
                      {downloadingDocId === doc.file_id ? 'Preparing…' : 'Download'}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2 border-red-500/50 text-red-400 hover:bg-red-500/10 hover:text-red-300"
                      onClick={(e) => {
                        e.stopPropagation();
                        confirmDeleteDocument(doc);
                      }}
                      data-no-marquee="true"
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete
                    </Button>
                    {downloadingDocId === doc.file_id && (
                      <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                        decrypting…
                      </span>
                    )}
                  </div>
                </Card>
              );
              })}
              {isMarqueeSelecting && marqueeRect && (
                <div
                  className="pointer-events-none absolute z-30 rounded-lg border border-primary/70 bg-primary/10 shadow-[0_0_0_1px_rgba(59,130,246,0.35),0_0_30px_rgba(59,130,246,0.45)]"
                  style={{
                    left: marqueeRect.left,
                    top: marqueeRect.top,
                    width: marqueeRect.width,
                    height: marqueeRect.height,
                  }}
                />
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="signatures" className="mt-4">
          <SignatureRequests />
        </TabsContent>

        <TabsContent value="sent-signatures" className="mt-4">
          <SentSignatureRequests />
        </TabsContent>

        <TabsContent value="analysis" className="mt-4">
          <Card className="p-12 text-center">
            <Brain className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">AI Document Analysis</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Analyze documents with ZKML for classification and insights
            </p>
            {canPerformAction('canRunZKMLAnalysis') && (
              <Button onClick={handleOpenZKMLModal}>
                <Brain className="h-4 w-4 mr-2" />
                Analyze Document
              </Button>
            )}
          </Card>
        </TabsContent>
      </Tabs>

      {/* Modals */}
      {showUploadModal && (
        <LegalDocumentUploadModal 
          onClose={() => {
            setShowUploadModal(false);
            refreshDocuments();
          }} 
          onSuccess={handleUploadSuccess}
        />
      )}

      {showNotarizeModal && (
        <NotarizeDocumentModal 
          onClose={() => {
            setShowNotarizeModal(false);
            refreshDocuments();
          }} 
          onSuccess={handleNotarizeSuccess}
        />
      )}

      {showRedactionModal && currentRedactionDocument?.file_id && (
        <RedactionModal
          key={redactionModalKey}
          onClose={handleRedactionClose}
          onSuccess={handleRedactionSuccess}
          document={currentRedactionDocument}
        />
      )}

      {showRequestSignatureModal && currentSignatureDocument?.file_id && (
        <RequestSignatureModal
          key={signatureModalKey}
          onClose={handleSignatureClose}
          onSuccess={handleSignatureSuccess}
          document={currentSignatureDocument}
        />
      )}

      {showZKMLModal && analysisDocument?.file_id && (
        <ZKMLAnalysisModal
          onClose={() => {
            setShowZKMLModal(false);
            setAnalysisDocument(null);
            refreshDocuments();
          }}
          document={analysisDocument}
        />
      )}

      {showRevokeAccessModal && selectedDocsWithFileId[0] && (
        <RevokeAccessModal
          isOpen={showRevokeAccessModal}
          onClose={() => setShowRevokeAccessModal(false)}
          document={selectedDocsWithFileId[0]}
        />
      )}

      {showRevokeDocumentModal && selectedDocsWithFileId[0] && (
        <RevokeDocumentModal
          isOpen={showRevokeDocumentModal}
          onClose={() => {
            setShowRevokeDocumentModal(false);
            refreshDocuments();
          }}
          document={selectedDocsWithFileId[0]}
        />
      )}

      <Dialog
        open={!!actionDoc}
        onOpenChange={(open) => {
          if (!open) {
            setActionDoc(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Manage Document</DialogTitle>
            <DialogDescription className="truncate">{actionDoc?.name}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Button
              className="w-full justify-start gap-2"
              onClick={() => {
                if (!actionDoc) return;
                startRedactionBatch([actionDoc]);
                setActionDoc(null);
              }}
              disabled={
                !actionDoc?.file_id || !canPerformAction('canCreateRedactions')
              }
            >
              <FileText className="h-4 w-4" />
              Redact Document
            </Button>
            <Button
              className="w-full justify-start gap-2"
              onClick={() => {
                if (!actionDoc) return;
                startSignatureBatch([actionDoc]);
                setActionDoc(null);
              }}
              disabled={
                !actionDoc?.file_id || !canPerformAction('canRequestSignatures')
              }
            >
              <PenTool className="h-4 w-4" />
              Request Signatures
            </Button>
            <Button
              className="w-full justify-start gap-2"
              onClick={() => {
                if (!actionDoc) return;
                setAnalysisDocument(actionDoc);
                setShowZKMLModal(true);
                setActionDoc(null);
              }}
              disabled={
                !actionDoc?.file_id || !canPerformAction('canRunZKMLAnalysis')
              }
            >
              <Brain className="h-4 w-4" />
              Analyze with ZKML
            </Button>
            <Button
              variant="destructive"
              className="w-full justify-start gap-2"
              onClick={() => {
                if (!actionDoc) return;
                setPendingDeleteDoc(actionDoc);
                setActionDoc(null);
              }}
            >
              <Trash2 className="h-4 w-4" />
              Delete Document
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!pendingDeleteDoc}
        onOpenChange={(open) => {
          if (!open) {
            setPendingDeleteDoc(null);
          }
        }}
      >
        <AlertDialogContent className="border border-red-500/30 bg-slate-950/90 text-slate-100 shadow-[0_40px_90px_-30px_rgba(239,68,68,0.5)]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-lg font-semibold text-red-400">
              Delete “{pendingDeleteDoc?.name}” permanently?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-slate-300">
              This action cannot be undone. The document and associated keys will be permanently removed from BlockVault.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border border-slate-700/60 bg-transparent text-slate-300 hover:bg-slate-800/80">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-500 focus:ring-red-500"
              onClick={() => {
                if (pendingDeleteDoc) {
                  handleDeleteDocument(pendingDeleteDoc);
                  setPendingDeleteDoc(null);
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
