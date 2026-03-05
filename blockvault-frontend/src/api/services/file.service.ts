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

};

