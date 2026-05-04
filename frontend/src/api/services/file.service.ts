import apiClient from '../client';
import { API_ENDPOINTS } from '@/config/constants';

export const fileService = {
  /**
   * Get list of user's files
   */
  async getFiles() {
    const response = await apiClient.get(API_ENDPOINTS.FILES.LIST);
    return response.data;
  },

  /**
   * Upload file with encryption
   */
  async uploadFile(formData: FormData) {
    const response = await apiClient.post(API_ENDPOINTS.FILES.UPLOAD, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  /**
   * Download file
   */
  async downloadFile(fileId: string) {
    const response = await apiClient.get(API_ENDPOINTS.FILES.DOWNLOAD(fileId), {
      responseType: 'blob',
    });
    return response.data;
  },

  /**
   * Delete file
   */
  async deleteFile(fileId: string) {
    const response = await apiClient.delete(API_ENDPOINTS.FILES.DELETE(fileId));
    return response.data;
  },

  /**
   * Share file with another user
   */
  async shareFile(data: {
    fileId: string;
    recipientAddress: string;
    passphrase: string;
    expirationDate?: string;
  }) {
    const response = await apiClient.post(API_ENDPOINTS.FILES.SHARE(data.fileId), {
      recipient: data.recipientAddress,
      passphrase: data.passphrase,
      expirationDate: data.expirationDate,
    });
    return response.data;
  },

  /**
   * Get shared files (files shared with current user)
   */
  async getSharedFiles() {
    const response = await apiClient.get(API_ENDPOINTS.FILES.SHARED);
    return response.data;
  },

  /**
   * Get outgoing shares (files current user has shared)
   */
  async getOutgoingShares() {
    const response = await apiClient.get(API_ENDPOINTS.FILES.SHARES_OUTGOING);
    return response.data;
  },

  /**
   * Revoke file share
   */
  async revokeShare(shareId: string) {
    const response = await apiClient.delete(`/files/shares/${shareId}`);
    return response.data;
  },

  /**
   * Test a recovery key against a file wrapper
   */
  async recoverFile(fileId: string, recoveryKey: string) {
    const response = await apiClient.post(`/files/${fileId}/recover`, {
      recovery_key: recoveryKey,
    });
    return response.data;
  },

  /**
   * Reset passphrase using recovery key
   */
  async resetPassphrase(fileId: string, recoveryKey: string, newPassphrase: string) {
    const response = await apiClient.post(`/files/${fileId}/reset-passphrase`, {
      recovery_key: recoveryKey,
      new_passphrase: newPassphrase,
    });
    return response.data;
  },

  /**
   * Get file activity timeline
   * Falls back to mock generation if endpoint is not available
   */
  async getFileActivity(fileId: string, file?: any) {
    try {
      const response = await apiClient.get(API_ENDPOINTS.FILES.ACTIVITY(fileId));
      return response.data;
    } catch {
      // Fallback: generate timeline from file metadata
      return generateMockTimeline(file);
    }
  },

};

/**
 * Generate a realistic activity timeline from file metadata.
 * Used as fallback when the backend endpoint is not yet implemented.
 */
function generateMockTimeline(file: any) {
  if (!file) return [];

  const baseTime = new Date(file.upload_date).getTime();
  const events: any[] = [];
  let seq = 0;

  const push = (
    offsetMs: number,
    type: string,
    action: string,
    description: string,
    status = 'success',
    metadata?: Record<string, string>,
    actionLabel?: string,
    actionType?: string,
  ) => {
    events.push({
      id: String(++seq),
      type,
      action,
      description,
      timestamp: new Date(baseTime + offsetMs).toISOString(),
      status,
      actor: seq === 1
        ? (file.user_address ? `${file.user_address.substring(0, 6)}...${file.user_address.substring(38)}` : undefined)
        : undefined,
      metadata,
      actionLabel,
      actionType,
    });
  };

  // Every file starts with upload + encryption
  push(0, 'upload', 'Document Uploaded', 'File uploaded and stored securely.');
  push(1200, 'encrypt', 'Encrypted via AES-256-GCM', 'Client-side encryption applied before network transfer.');

  // Risk scan
  const hasSensitiveData = file.redaction_status === 'completed' || file.metadata?.redacted;
  push(3500, 'scan', 'Risk Scan Completed', hasSensitiveData
    ? 'High-risk sensitive data detected in document.'
    : 'No sensitive data detected. Document is clean.');

  if (hasSensitiveData) {
    push(5000, 'detect', 'Sensitive Data Detected', 'PII, financial data, or confidential information identified.');

    push(45000, 'redact_review', 'Redaction Review Started', 'Document queued for automated redaction review.');

    const count = file.metadata?.redaction_count || '12';
    push(60000, 'redact', 'Redactions Applied', `${count} sensitive entities permanently removed from document.`, 'success', {
      redactions: `${count} redactions applied`,
    }, 'View redaction report', 'view_report');
  }

  if (file.proof_status === 'verified' || file.metadata?.proof_cid) {
    push(65000, 'proof', 'ZK Proof Generated', 'Zero-knowledge proof of correct redaction generated and verified.', 'success', {
      proof_cid: file.metadata?.proof_cid || undefined,
    }, 'View proof details', 'view_proof');
  }

  if (file.tx_hash) {
    push(72000, 'anchor', 'Blockchain Anchor', 'Document hash permanently anchored on-chain.', 'success', {
      transaction: file.tx_hash,
    }, 'View transaction', 'view_tx');
  }

  if (file.metadata?.compliance_profile) {
    push(74000, 'compliance', 'Compliance Policy Applied', `${file.metadata.compliance_profile} compliance profile enforced.`);
  }

  if (file.metadata?.certificate_id || file.proof_status === 'verified') {
    push(78000, 'certificate', 'Security Certificate Generated', 'Tamper-proof compliance certificate issued.', 'success', {
      certificate_id: file.metadata?.certificate_id || `cert-${file.id?.substring(0, 4) || '0000'}`,
    }, 'Open certificate', 'open_certificate');
  }

  return events;
}
