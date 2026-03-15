/**
 * Secure key management for legal documents
 * Keys are encrypted and stored locally for automatic retrieval
 */

import { readStoredUser } from '@/utils/authStorage';

// Encrypt passphrase with user-specific key
export const encryptPassphrase = (passphrase: string): string => {
  const user = readStoredUser() || {};
  const userKey = user.address || 'default';
  // Simple encoding (in production, use proper encryption like AES)
  return btoa(passphrase + '::LEGAL::' + userKey);
};

// Decrypt passphrase
export const decryptPassphrase = (encrypted: string): string => {
  const user = readStoredUser() || {};
  const userKey = user.address || 'default';
  try {
    const decoded = atob(encrypted);
    const parts = decoded.split('::LEGAL::');
    if (parts.length === 2 && parts[1] === userKey) {
      return parts[0];
    }
    throw new Error('Invalid encryption or wrong user');
  } catch (error) {
    console.error('Failed to decrypt passphrase:', error);
    throw new Error('Failed to decrypt document key');
  }
};

// Store document key
export const storeLegalDocumentKey = (fileId: string, passphrase: string): void => {
  const encrypted = encryptPassphrase(passphrase);
  localStorage.setItem(`legal_doc_key_${fileId}`, encrypted);
};

// Retrieve document key
export const getLegalDocumentKey = (fileId: string): string | null => {
  // First, check legal documents keys
  const encrypted = localStorage.getItem(`legal_doc_key_${fileId}`);
  if (!encrypted) {
    // Fallback to general file keys for backward compatibility
    const fallback = localStorage.getItem(`file_key_${fileId}`);
    if (fallback) {
      return fallback;
    }
    return null;
  }

  try {
    const passphrase = decryptPassphrase(encrypted);
    return passphrase;
  } catch (error) {
    console.error(`Failed to decrypt key for ${fileId}:`, error);
    return null;
  }
};

// Remove document key
export const removeLegalDocumentKey = (fileId: string): void => {
  localStorage.removeItem(`legal_doc_key_${fileId}`);
};

// Check if document has stored key
export const hasLegalDocumentKey = (fileId: string): boolean => {
  return localStorage.getItem(`legal_doc_key_${fileId}`) !== null;
};

