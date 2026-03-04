import apiClient from '../client';
import { API_ENDPOINTS } from '@/config/constants';

export const caseService = {
  /**
   * Get all cases for current user
   */
  async getCases() {
    const response = await apiClient.get(API_ENDPOINTS.CASES.LIST);
    return response.data;
  },

  /**
   * Create new case
   */
  async createCase(caseData: {
    title: string;
    description?: string;
    clientName?: string;
    caseNumber?: string;
    teamMembers?: string[];
    documents?: string[];
  }) {
    const response = await apiClient.post(API_ENDPOINTS.CASES.CREATE, caseData);
    return response.data;
  },

  /**
   * Update case
   */
  async updateCase(caseId: string, updates: {
    title?: string;
    description?: string;
    status?: string;
    teamMembers?: string[];
  }) {
    const response = await apiClient.put(API_ENDPOINTS.CASES.UPDATE(caseId), updates);
    return response.data;
  },

  /**
   * Delete case
   */
  async deleteCase(caseId: string) {
    const response = await apiClient.delete(API_ENDPOINTS.CASES.DELETE(caseId));
    return response.data;
  },

  /**
   * Get case details
   */
  async getCaseDetails(caseId: string) {
    const response = await apiClient.get(`/cases/${caseId}`);
    return response.data;
  },

  /**
   * Add document to case
   */
  async addDocumentToCase(caseId: string, documentId: string) {
    const response = await apiClient.post(`/cases/${caseId}/documents`, {
      documentId,
    });
    return response.data;
  },

  /**
   * Remove document from case
   */
  async removeDocumentFromCase(caseId: string, documentId: string) {
    const response = await apiClient.delete(`/cases/${caseId}/documents/${documentId}`);
    return response.data;
  },
};







