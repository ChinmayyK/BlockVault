import React, { useEffect, useMemo, useState } from 'react';
import { Shield, AlertTriangle, CheckCircle, Search, Plus, Trash2, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { DocumentPreview } from './DocumentPreview';
import { REDACTION_PATTERNS, RedactionMatch, findAllRedactions } from '@/utils/redactionPatterns';
import { buildRedactionSummary } from '@/utils/redactionProcessor';
import { fetchAndExtractDocument, DocumentContent, AuthRequiredError } from '@/utils/documentExtractor';
import { getLegalDocumentKey, storeLegalDocumentKey } from '@/utils/legalDocumentKeys';
import { ScrollingText } from '@/components/ui/ScrollingText';
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';
import { fileService } from '@/api/services/file.service';
import { RedactionPayload, RedactionResponse } from '@/types/redaction';
import { LegalModalFrame } from './LegalModalFrame';
import toast from 'react-hot-toast';
import { fetchWithTimeout } from '@/utils/fetchWithTimeout';
import { getApiBase as resolveApiBase } from '@/lib/getApiBase';
import { readStoredUser } from '@/utils/authStorage';

interface RedactionModalProps {
  document: {
    file_id: string;
    name: string;
    cid: string;
    docHash: string;
  };
  onClose: () => void;
  onSuccess: () => void;
}

type Step = 'configure' | 'processing' | 'complete';

export const RedactionModal: React.FC<RedactionModalProps> = ({ document, onClose, onSuccess }) => {
  useBodyScrollLock(true);
  
  const [documentContent, setDocumentContent] = useState<DocumentContent | null>(null);
  const [matches, setMatches] = useState<RedactionMatch[]>([]);
  const [enabledPatterns, setEnabledPatterns] = useState<string[]>([]);
  const [searchTerms, setSearchTerms] = useState<Array<{ term: string; caseSensitive: boolean }>>([]);
  const [currentSearchTerm, setCurrentSearchTerm] = useState('');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [loadingDocument, setLoadingDocument] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState<Step>('configure');
  const [apiResult, setApiResult] = useState<RedactionResponse | null>(null);
  const [downloading, setDownloading] = useState(false);

  const API_BASE = resolveApiBase();

  const getAuthHeaders = () => {
    const user = readStoredUser() || {};
    if (!user.jwt) {
      throw new Error('Authentication token missing. Please login again.');
    }
    return {
      Authorization: `Bearer ${user.jwt}`,
    };
  };

  useEffect(() => {
    const load = async () => {
      try {
        setLoadingDocument(true);
      const passphrase = getLegalDocumentKey(document.file_id);
      if (!passphrase) {
          toast.error('Document encryption key not found for this file.');
        return;
      }
      const content = await fetchAndExtractDocument(document.file_id, passphrase, API_BASE);
      setDocumentContent(content);
    } catch (error) {
        if (error instanceof AuthRequiredError) {
          toast.error('Please log in again to load this document.');
          return;
        }
        console.error('Failed to load document for redaction', error);
        toast.error('Unable to load document content.');
    } finally {
        setLoadingDocument(false);
      }
    };

    load();
  }, [document.file_id]);

  useEffect(() => {
    if (!documentContent) return;
    const results = findAllRedactions(documentContent.text, enabledPatterns, searchTerms);
    setMatches(results);
  }, [documentContent, enabledPatterns, searchTerms]);

  const summary = useMemo(() => {
    if (!documentContent) {
      return {
        totalMatches: 0,
        uniqueMatches: 0,
        uniqueTypes: 0,
        previews: [],
        matchedTexts: [],
      };
    }
    return buildRedactionSummary(documentContent.text, matches);
  }, [documentContent, matches]);

  const handlePatternToggle = (patternId: string) => {
    setEnabledPatterns((prev) =>
      prev.includes(patternId) ? prev.filter((id) => id !== patternId) : [...prev, patternId],
    );
  };

  const handleAddSearchTerm = () => {
    if (!currentSearchTerm.trim()) return;
    setSearchTerms((prev) => [...prev, { term: currentSearchTerm.trim(), caseSensitive }]);
    setCurrentSearchTerm('');
  };

  const handleRemoveSearchTerm = (index: number) => {
    setSearchTerms((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!documentContent) {
      toast.error('Document not loaded yet.');
      return;
    }
    if (summary.totalMatches === 0) {
      toast.error('No matches selected for redaction.');
        return;
      }

      try {
      setSubmitting(true);
      setStep('processing');
        
        const passphrase = getLegalDocumentKey(document.file_id);
        if (!passphrase) {
        throw new Error('Encryption key missing');
      }

      const payload: RedactionPayload = {
        file_id: document.file_id,
        passphrase,
        patterns_applied: enabledPatterns,
        custom_terms: searchTerms.map((term) => term.term),
        redaction_regions: [],
        matched_texts: summary.matchedTexts,
      };

      const response: RedactionResponse = await fileService.submitRedaction(payload);
      setApiResult(response);
      if (response?.file_id) {
        storeLegalDocumentKey(response.file_id, passphrase);
      }
      toast.success('Redaction completed securely.');
      setStep('complete');
      onSuccess();
    } catch (error) {
      console.error('Failed to submit redaction', error);
      toast.error('Redaction failed. Please try again.');
      setStep('configure');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDownloadRedacted = async () => {
    if (!apiResult?.file_id) {
      toast.error('No redacted file available to download yet.');
      return;
    }

    try {
      setDownloading(true);

      let passphrase = getLegalDocumentKey(apiResult.file_id);
      if (!passphrase) {
        passphrase = getLegalDocumentKey(document.file_id);
        if (passphrase) {
          storeLegalDocumentKey(apiResult.file_id, passphrase);
        }
      }

      if (!passphrase) {
        throw new Error('Encryption key not found for redacted file.');
      }

      let headers: Record<string, string>;
      try {
        headers = getAuthHeaders();
      } catch (authError) {
        throw new Error('Authentication required. Please sign in again.');
      }

      const response = await fetchWithTimeout(
        `${API_BASE}/files/${apiResult.file_id}?key=${encodeURIComponent(passphrase)}`,
        {
          method: 'GET',
          headers,
        },
      );

      if (!response.ok) {
        throw new Error('Download failed. Please try again.');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = window.document.createElement('a');
      const originalName = document.name || 'document.pdf';
      const lastDot = originalName.lastIndexOf('.');
      const baseName = lastDot > -1 ? originalName.substring(0, lastDot) : originalName;
      const extension = lastDot > -1 ? originalName.substring(lastDot + 1) : 'pdf';

      link.href = url;
      link.download = `${baseName || 'document'}_redacted.${extension || 'pdf'}`;
      window.document.body.appendChild(link);
      link.click();
      window.document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast.success('Redacted file downloaded.');
    } catch (error) {
      console.error('Failed to download redacted file', error);
      toast.error(error instanceof Error ? error.message : 'Unable to download redacted file.');
    } finally {
      setDownloading(false);
    }
  };

  const isConfigureState = step === 'configure' || step === 'upload';

  let bodyContent: React.ReactNode = null;

  if (isConfigureState) {
    bodyContent = (
      <div className="space-y-6">
            <section className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
          <ScrollingText text={document.name} className="block text-sm text-slate-300" />
              <p className="text-xs font-mono text-slate-500">{document.docHash}</p>
            </section>

            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-white">Sensitive data presets</h3>
              <p className="text-xs text-slate-400">Select categories to detect automatically</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {Object.values(REDACTION_PATTERNS).map((pattern) => (
                  <button
                        key={pattern.id}
                    type="button"
                    onClick={() => handlePatternToggle(pattern.id)}
                className={cn(
                  "rounded-lg border p-3 text-left transition",
                          enabledPatterns.includes(pattern.id)
                    ? "border-primary/60 bg-primary/10 text-white shadow-[0_0_18px_rgba(59,130,246,0.35)]"
                    : "border-slate-800 bg-slate-900/40 text-slate-300 hover:border-primary/40",
                )}
                  >
                    <p className="text-sm font-medium">{pattern.name}</p>
                    <p className="text-xs text-slate-400">{pattern.description}</p>
                  </button>
                    ))}
                  </div>
            </section>

            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-white">Custom terms</h3>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                      <Input
                      value={currentSearchTerm}
                    onChange={(e) => setCurrentSearchTerm(e.target.value)}
                    placeholder="Add specific words or phrases"
                    className="pl-9"
                    onKeyDown={(e) => e.key === 'Enter' && handleAddSearchTerm()}
                      />
                    </div>
                <label className="flex items-center space-x-2 rounded-lg border border-slate-800 bg-slate-900/40 px-3 py-2 text-xs text-slate-300">
                      <input
                        type="checkbox"
                        checked={caseSensitive}
                        onChange={(e) => setCaseSensitive(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-700 text-primary focus:ring-primary"
                      />
                  <span>Case sensitive</span>
                    </label>
                <Button variant="secondary" size="icon" disabled={!currentSearchTerm.trim()} onClick={handleAddSearchTerm}>
                  <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  {searchTerms.length > 0 && (
                    <div className="space-y-2">
                      {searchTerms.map((term, index) => (
                <div
                  key={`${term.term}-${index}`}
                  className="flex items-center justify-between rounded border border-slate-800 bg-slate-900/40 px-3 py-2"
                >
                      <span className="text-xs font-mono text-slate-300">
                        {term.term}
                        {term.caseSensitive && <span className="ml-2 text-amber-400">(case-sensitive)</span>}
                      </span>
                      <button className="rounded p-1 text-slate-500 hover:text-red-400" onClick={() => handleRemoveSearchTerm(index)}>
                        <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
            </section>

            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-white">Preview & review</h3>
                <span className="text-xs text-slate-400">{summary.totalMatches} match(es) detected</span>
                        </div>
              <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
                {loadingDocument && <p className="text-sm text-slate-400">Loading document…</p>}
                {!loadingDocument && documentContent && (
                  <DocumentPreview content={documentContent} matches={matches} showRedactions title="Detected matches" />
                )}
                {!loadingDocument && !documentContent && (
                  <p className="text-sm text-amber-300">Document content unavailable.</p>
                )}
              </div>
              {summary.previews.length > 0 && (
                <div className="space-y-2 rounded-lg border border-slate-800 bg-slate-900/40 p-4 text-xs text-slate-300">
                  <p className="mb-2 font-semibold text-slate-200">Matched snippets</p>
                  {summary.previews.map((preview, index) => (
                    <div key={`${preview.text}-${index}`} className="rounded bg-slate-950/40 p-2">
                      <p className="font-mono text-slate-200">{preview.text}</p>
                      <p className="mt-1 text-[10px] uppercase text-slate-500">{preview.type}</p>
                      <p className="mt-1 text-slate-400">{preview.context}</p>
                    </div>
                  ))}
                </div>
              )}
              {summary.totalMatches === 0 && (enabledPatterns.length > 0 || searchTerms.length > 0) && (
                <div className="flex items-start space-x-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-100">
                  <AlertTriangle className="h-5 w-5 text-amber-300" />
                  <span>No matches found for the selected patterns or search terms.</span>
            </div>
          )}
            </section>
      </div>
    );
  } else if (step === 'processing') {
    bodyContent = (
      <div className="py-8 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-500/10">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
              </div>
        <h3 className="mb-2 text-lg font-medium text-white">Processing Document</h3>
        <p className="mb-4 text-slate-400">Calculating cryptographic hash and applying secure redactions…</p>
        <div className="mx-auto max-w-md rounded-lg border border-slate-800 bg-slate-900/50 p-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-400">Status</span>
            <span className="font-mono text-blue-400">Redacting…</span>
          </div>
        </div>
          </div>
    );
  } else if (step === 'complete' && apiResult) {
    bodyContent = (
      <div className="space-y-6">
        <div className="rounded-xl border border-green-500/40 bg-green-500/10 p-4">
          <div className="flex items-start space-x-3">
            <CheckCircle className="mt-1 h-5 w-5 text-green-400" />
            <div className="space-y-1 text-sm text-green-100">
              <p className="font-semibold text-green-200">Redaction stored securely</p>
              <p className="text-xs text-green-200/80">Redacted File ID: {apiResult.file_id}</p>
                  <p className="text-xs text-green-200/80">New CID: {apiResult.new_cid || 'N/A'}</p>
                  <p className="text-xs text-green-200/80">Hash: {apiResult.hash}</p>
              {apiResult.anchor_tx && (
                <p className="text-xs text-green-200/80">Anchor TX: {apiResult.anchor_tx}</p>
              )}
              <p className="pt-1 text-xs text-green-200/70">
                Use the download button below to retrieve the redacted document or find it in your files list.
              </p>
            </div>
          </div>
              </div>
          </div>
    );
  }

  const footerContent = (
    <>
      <Button variant="outline" onClick={onClose} disabled={submitting || downloading}>
        {step === 'complete' ? 'Close' : 'Cancel'}
      </Button>
      {step === 'complete' ? (
        <Button
          onClick={handleDownloadRedacted}
          disabled={downloading}
          className="flex items-center gap-2"
        >
          <Download className="h-4 w-4" />
          {downloading ? 'Preparing…' : 'Download Redacted File'}
        </Button>
      ) : (
        <Button onClick={handleSubmit} disabled={submitting || summary.totalMatches === 0}>
          {submitting ? 'Submitting…' : 'Confirm Redaction'}
        </Button>
      )}
    </>
  );

  return (
    <LegalModalFrame
      widthClassName="max-w-3xl"
      title="Secure Redaction"
      subtitle="Define patterns and confirm permanent redaction"
      icon={<Shield className="h-5 w-5 text-blue-200" />}
      onClose={onClose}
      footer={footerContent}
    >
      {bodyContent}
    </LegalModalFrame>
  );
};

