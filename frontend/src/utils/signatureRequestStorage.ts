/**
 * Client-side storage for signature requests
 * Since backend doesn't have signature request endpoints yet,
 * we store them in localStorage
 */

export interface StoredSignatureRequest {
  id: string;
  documentId: string; // This is the actual file_id from backend
  documentName: string;
  requestedBy: string;
  requestedTo: string;
  status: 'pending' | 'signed' | 'declined' | 'expired';
  message: string;
  createdAt: string;
  expiresAt: number;
}

const STORAGE_KEY = 'blockvault_signature_requests';

// Get all signature requests
export const getAllSignatureRequests = (): StoredSignatureRequest[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

// Get signature requests for a specific user
export const getSignatureRequestsForUser = (userAddress: string): StoredSignatureRequest[] => {
  const allRequests = getAllSignatureRequests();
  const normalized = userAddress.toLowerCase();
  return allRequests.filter(req => req.requestedTo.toLowerCase() === normalized);
};

// Get signature requests sent by a user
export const getSignatureRequestsSentBy = (userAddress: string): StoredSignatureRequest[] => {
  const allRequests = getAllSignatureRequests();
  const normalized = userAddress.toLowerCase();
  return allRequests.filter(req => req.requestedBy.toLowerCase() === normalized);
};

// Create signature request
export const createSignatureRequest = (
  documentId: string,
  documentName: string,
  requestedBy: string,
  requestedTo: string,
  message: string,
  expiresAt: number
): StoredSignatureRequest => {
  const request: StoredSignatureRequest = {
    id: `sig_req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    documentId,
    documentName,
    requestedBy: requestedBy.toLowerCase(),
    requestedTo: requestedTo.toLowerCase(),
    status: 'pending',
    message,
    createdAt: new Date().toISOString(),
    expiresAt,
  };

  const allRequests = getAllSignatureRequests();
  allRequests.push(request);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(allRequests));

  return request;
};

// Update signature request status
export const updateSignatureRequestStatus = (
  requestId: string,
  status: 'pending' | 'signed' | 'declined' | 'expired'
): void => {
  const allRequests = getAllSignatureRequests();

  const updated = allRequests.map(req => {
    if (req.id === requestId) {
      return { ...req, status };
    }
    return req;
  });

  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
};

// Delete signature request
export const deleteSignatureRequest = (requestId: string): void => {
  const allRequests = getAllSignatureRequests();
  const filtered = allRequests.filter(req => req.id !== requestId);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
};
