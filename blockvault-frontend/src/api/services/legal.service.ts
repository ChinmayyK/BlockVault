import apiClient from '../client';
import { API_ENDPOINTS } from '@/config/constants';

export const legalService = {
  /**
   * Notarize document on blockchain
   */
  async notarizeDocument(data: {
    fileId: string;
    documentHash: string;
    metadata?: any;
  }) {
    const response = await apiClient.post(API_ENDPOINTS.LEGAL.NOTARIZE, data);
    return response.data;
  },

  /**
   * Redact sensitive information from document
   */
  async redactDocument(data: {
    fileId: string;
    patterns: string[];
    customPatterns?: string[];
  }) {
    const response = await apiClient.post(API_ENDPOINTS.LEGAL.REDACT, data);
    return response.data;
  },

  /**
   * Request signature for document
   */
  async requestSignature(data: {
    fileId: string;
    signers: string[];
    deadline?: string;
    message?: string;
  }) {
    const response = await apiClient.post('/legal/request-signature', data);
    return response.data;
  },

  /**
   * Sign document
   */
  async signDocument(data: {
    requestId: string;
    signature: string;
  }) {
    const response = await apiClient.post(API_ENDPOINTS.LEGAL.SIGN, data);
    return response.data;
  },

  /**
   * Get signature requests (incoming)
   */
  async getSignatureRequests() {
    const response = await apiClient.get('/legal/signature-requests');
    return response.data;
  },

  /**
   * Get sent signature requests (outgoing)
   */
  async getSentSignatureRequests() {
    const response = await apiClient.get('/legal/sent-signature-requests');
    return response.data;
  },

  /**
   * Analyze document with ZKML
   */
  async analyzeDocument(data: {
    fileId: string;
    analysisType: string;
  }) {
    const response = await apiClient.post(API_ENDPOINTS.LEGAL.ANALYZE, data);
    return response.data;
  },

  /**
   * Revoke document access
   */
  async revokeAccess(documentId: string, userAddress: string) {
    const response = await apiClient.post('/legal/revoke-access', {
      documentId,
      userAddress,
    });
    return response.data;
  },

  /**
   * Revoke document completely
   */
  async revokeDocument(documentId: string) {
    const response = await apiClient.post('/legal/revoke-document', {
      documentId,
    });
    return response.data;
  },

  /**
   * Cancel signature request
   */
  async cancelSignatureRequest(requestId: string) {
    const response = await apiClient.delete(`/legal/signature-requests/${requestId}`);
    return response.data;
  },
};







