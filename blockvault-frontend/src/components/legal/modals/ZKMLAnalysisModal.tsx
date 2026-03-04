import React, { useState, useEffect } from 'react';
import { Brain, BarChart3, Shield, CheckCircle, Zap, FileText, Clock, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getLegalDocumentKey } from '@/utils/legalDocumentKeys';
import toast from 'react-hot-toast';
import { logger } from '@/utils/logger';
import { fetchWithTimeout } from '@/utils/fetchWithTimeout';
import { ScrollingText } from '@/components/ui/ScrollingText';
import { LegalModalFrame } from './LegalModalFrame';
import { getApiBase as resolveApiBase } from '@/lib/getApiBase';
import { readStoredUser } from '@/utils/authStorage';

interface ZKMLAnalysisModalProps {
  document: {
    id?: string;
    file_id: string;
    name: string;
    docHash: string;
  };
  onClose: () => void;
  onSuccess: () => void;
}

interface ZKMLResult {
  summary: string;
  verified: boolean;
  proofHash: string;
  input_hash: string;
  model_hash: string;
  metadata: any;
  proof: any;
}

export const ZKMLAnalysisModal: React.FC<ZKMLAnalysisModalProps> = ({ document, onClose, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'configure' | 'processing' | 'verifying' | 'complete'>('configure');
  const [analysisConfig, setAnalysisConfig] = useState({
    maxLength: 150,
    minLength: 30,
    modelType: 'bart-large-cnn',
    includeProof: true,
    includeConfidence: true,
  });
  const [analysisResult, setAnalysisResult] = useState<ZKMLResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const API_BASE = resolveApiBase();

  const getAuthHeaders = () => {
    const user = readStoredUser() || {};
    if (!user.jwt) {
      throw new Error('No authentication token found. Please login again.');
    }
    return {
      'Authorization': `Bearer ${user.jwt}`,
      'Content-Type': 'application/json',
    };
  };

  const handleDocumentSummarization = async () => {
    if (!document.file_id) {
      toast.error('No file ID found for this document');
      return;
    }

    setLoading(true);
    setError(null);
    setStep('processing');

    try {
      // Step 1: Get encryption key
      const passphrase = await getLegalDocumentKey(document.file_id);
      if (!passphrase) {
        toast.error('Document encryption key not found. Please re-upload the document.');
        setLoading(false);
        return;
      }

      logger.debug('🔐 Retrieved passphrase for document:', document.file_id);

      // Step 2: Call backend ZKML API
      const response = await fetchWithTimeout(`${API_BASE}/files/${document.file_id}/zkml-summary`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          key: passphrase,
          max_length: analysisConfig.maxLength,
          min_length: analysisConfig.minLength
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`ZKML API error: ${errorText}`);
      }

      const data = await response.json();
      logger.debug('✅ ZKML Summary generated:', data);

      setStep('verifying');

      // Step 3: Save analysis to localStorage
      const enhancedMetadata = {
        ...(data.metadata || {}),
        timestamp: (data.metadata && data.metadata.timestamp) || Date.now(),
      };

      const analysisData = {
        model: analysisConfig.modelType,
        summary: data.summary,
        result: data.summary,
        verified: data.verified,
        proof: data.proof,
        metadata: enhancedMetadata,
        timestamp: enhancedMetadata.timestamp,
      };

      // Update document
      const existingDocs = JSON.parse(localStorage.getItem('legal_documents') || '[]');
      const updatedDocs = existingDocs.map((doc: any) =>
        doc.id === document.id || doc.file_id === document.file_id
          ? { ...doc, aiAnalysis: analysisData }
          : doc
      );
      localStorage.setItem('legal_documents', JSON.stringify(updatedDocs));

      setStep('complete');
      setAnalysisResult({
        summary: data.summary,
        verified: data.verified,
        proofHash: enhancedMetadata.output_hash || data.proof?.proof_hash || '',
        input_hash: enhancedMetadata.input_hash || '',
        model_hash: enhancedMetadata.model_hash || '',
        metadata: enhancedMetadata,
        proof: data.proof
      });

      toast.success('✅ ZKML Summary generated and verified!');
      // Don't call onSuccess() here - let user see the summary first

    } catch (error) {
      logger.error('ZKML summarization error:', error);
      const errorMessage = (error as Error).message;
      setError(errorMessage);
      toast.error(`Failed to generate summary: ${errorMessage}`);
      setStep('configure');
    } finally {
      setLoading(false);
    }
  };

  const getStepIcon = (stepName: string) => {
    if (step === stepName) {
      return <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
        <div className="w-3 h-3 bg-white rounded-full animate-pulse" />
      </div>;
    }
    if (step === 'complete' && stepName === 'verifying') {
      return <CheckCircle className="w-6 h-6 text-green-500" />;
    }
    return <div className="w-6 h-6 bg-gray-300 rounded-full" />;
  };

  const footerContent = (
    <>
          <Button
        onClick={() => {
          if (step === 'complete') {
            onSuccess();
          }
          onClose();
        }}
            variant="ghost"
        className="border border-transparent text-slate-300 hover:border-slate-700 hover:bg-slate-900/70 hover:text-white"
          >
        {step === 'complete' ? 'Close' : 'Cancel'}
          </Button>
        {step === 'configure' && (
        <Button
          onClick={handleDocumentSummarization}
          loading={loading}
          disabled={loading}
          className="bg-gradient-to-r from-violet-500 via-indigo-500 to-blue-500 text-white shadow-[0_16px_40px_-20px_rgba(129,140,248,0.85)] hover:shadow-[0_18px_46px_-18px_rgba(99,102,241,0.85)]"
        >
          <Brain className="mr-2 h-4 w-4" />
          Generate ZKML Summary
        </Button>
      )}
    </>
  );

  return (
    <LegalModalFrame
      widthClassName="max-w-2xl"
      title="ZKML Document Analysis"
      subtitle="Privacy-preserving AI summary and verification"
      icon={<BarChart3 className="h-5 w-5 text-blue-200" />}
      onClose={onClose}
      footer={footerContent}
      headerAccent="violet"
    >
            <div className="space-y-6">
        <section className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
          <ScrollingText text={document.name} className="block text-sm text-slate-300" />
          <p className="text-xs font-mono text-slate-500">{document.docHash}</p>
        </section>
              
        <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
            <label className="text-sm font-medium text-slate-200">Maximum Summary Length</label>
                  <Input
                  type="number"
                  value={analysisConfig.maxLength}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setAnalysisConfig((prev) => ({ ...prev, maxLength: parseInt(e.target.value) || 150 }))
              }
                    placeholder="150"
                  />
            <p className="text-xs text-slate-500">Maximum characters in the generated summary.</p>
                </div>
                <div className="space-y-2">
            <label className="text-sm font-medium text-slate-200">Minimum Summary Length</label>
                  <Input
                  type="number"
                  value={analysisConfig.minLength}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setAnalysisConfig((prev) => ({ ...prev, minLength: parseInt(e.target.value) || 30 }))
              }
                    placeholder="30"
                  />
            <p className="text-xs text-slate-500">Minimum characters in the generated summary.</p>
                </div>
        </section>

        <section className="space-y-4 rounded-xl border border-slate-800 bg-slate-900/40 p-4">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-500/15">
              <Brain className="h-4 w-4 text-blue-300" />
            </div>
            ZKML Configuration
          </h3>
          <div className="space-y-3">
            <label className="flex items-center gap-2 text-sm text-slate-300">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-700 text-primary focus:ring-primary"
                checked={analysisConfig.includeProof}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setAnalysisConfig((prev) => ({ ...prev, includeProof: e.target.checked }))
                }
              />
              Include proof metadata in summary
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-300">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-700 text-primary focus:ring-primary"
                checked={analysisConfig.includeConfidence}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setAnalysisConfig((prev) => ({ ...prev, includeConfidence: e.target.checked }))
                }
              />
              Show model confidence metrics
            </label>
          </div>
        </section>

        {step === 'processing' && (
          <div className="space-y-4 rounded-xl border border-blue-500/30 bg-slate-900/50 p-6 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-blue-500/10">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
            </div>
            <h3 className="text-lg font-semibold text-white">Running Analysis</h3>
            <p className="text-sm text-slate-400">
              Generating summary and verifying cryptographic integrity with zero-knowledge ML…
            </p>
          </div>
        )}

        {step === 'verifying' && (
          <div className="space-y-4 rounded-xl border border-emerald-500/30 bg-slate-900/50 p-6 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
            </div>
            <h3 className="text-lg font-semibold text-white">Verifying Proof</h3>
            <p className="text-sm text-slate-400">
              Validating zk-proof and preparing analysis payload…
            </p>
          </div>
        )}

        {analysisResult && (
          <div className="space-y-4">
            <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-5 shadow-[0_0_25px_rgba(99,102,241,0.15)]">
              <div className="mb-3 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-500/10 text-blue-400">
                  <Zap className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">Analysis Summary</h3>
                  <p className="text-xs text-slate-400">Generated using privacy-preserving zero-knowledge ML</p>
                </div>
              </div>
              <p className="leading-relaxed text-slate-200">{analysisResult.summary}</p>
            </section>

            <details className="rounded-xl border border-slate-800 bg-slate-900/40 p-5 text-sm text-slate-300">
              <summary className="flex cursor-pointer items-center gap-2 font-semibold text-white">
                <FileText className="h-4 w-4 text-blue-400" />
                Proof Details
              </summary>
              <div className="mt-3 space-y-3 text-xs text-slate-400">
                <div className="flex items-center justify-between">
                  <span>Proof Hash:</span>
                  <span className="font-mono text-slate-200">{analysisResult.proofHash}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Input Hash:</span>
                  <span className="font-mono text-slate-200">{analysisResult.input_hash}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Model Hash:</span>
                  <span className="font-mono text-slate-200">{analysisResult.model_hash}</span>
                </div>
                <div className="pt-2 border-t border-slate-700">
                  <span className="text-slate-500">Public Signals:</span>
                  <span className="ml-2 text-white">{analysisResult.proof.public_signals.length}</span>
                </div>
              </div>
            </details>
          </div>
          )}
        </div>
    </LegalModalFrame>
  );
};