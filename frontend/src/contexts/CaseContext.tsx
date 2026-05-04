import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react';
import {
  CaseFile,
  CaseDashboard,
  CaseTask,
  CaseDocument,
  CaseDeadline,
  CaseTeamMember,
  DocumentAnnotation,
  DiscoveryBundle,
  AuditTrail,
  CaseListResponse,
  TaskListResponse,
  DocumentListResponse,
  CaseFilter,
  DocumentFilter,
  TaskFilter,
  Permission
} from '@/types/caseManagement';
import toast from 'react-hot-toast';
import { getApiBase as resolveApiBase } from '@/lib/getApiBase';
import { fetchWithTimeout } from '@/utils/fetchWithTimeout';
import { logger } from '@/utils/logger';
import { readStoredUser } from '@/utils/authStorage';
import { useAuth } from '@/contexts/AuthContext';

interface CaseContextType {
  // State
  cases: CaseFile[];
  currentCase: CaseFile | null;
  dashboard: CaseDashboard | null;
  tasks: CaseTask[];
  documents: CaseDocument[];
  deadlines: CaseDeadline[];
  teamMembers: CaseTeamMember[];
  annotations: DocumentAnnotation[];
  bundles: DiscoveryBundle[];
  auditTrail: AuditTrail[];
  loading: boolean;
  error: string | null;

  // Case Management
  createCase: (caseData: Partial<CaseFile>) => Promise<CaseFile>;
  updateCase: (caseId: string, updates: Partial<CaseFile>) => Promise<CaseFile>;
  deleteCase: (caseId: string) => Promise<void>;
  getCase: (caseId: string) => Promise<CaseFile>;
  getCases: (filters?: CaseFilter) => Promise<CaseListResponse>;
  loadCurrentCase: (caseId: string) => Promise<void>;

  // Document Management
  addDocumentToCase: (caseId: string, document: Partial<CaseDocument>) => Promise<CaseDocument>;
  updateDocument: (documentId: string, updates: Partial<CaseDocument>) => Promise<CaseDocument>;
  getDocuments: (caseId: string, filters?: DocumentFilter) => Promise<DocumentListResponse>;
  deleteDocument: (documentId: string) => Promise<void>;

  // Task Management
  createTask: (caseId: string, task: Partial<CaseTask>) => Promise<CaseTask>;
  updateTask: (taskId: string, updates: Partial<CaseTask>) => Promise<CaseTask>;
  completeTask: (taskId: string) => Promise<CaseTask>;
  getTasks: (caseId: string, filters?: TaskFilter) => Promise<TaskListResponse>;
  deleteTask: (taskId: string) => Promise<void>;

  // Team Management
  addTeamMember: (caseId: string, member: Partial<CaseTeamMember>) => Promise<CaseTeamMember>;
  updateTeamMember: (memberId: string, updates: Partial<CaseTeamMember>) => Promise<CaseTeamMember>;
  removeTeamMember: (memberId: string) => Promise<void>;
  updatePermissions: (memberId: string, permissions: Permission[]) => Promise<void>;

  // Annotations
  addAnnotation: (documentId: string, annotation: Partial<DocumentAnnotation>) => Promise<DocumentAnnotation>;
  updateAnnotation: (annotationId: string, updates: Partial<DocumentAnnotation>) => Promise<DocumentAnnotation>;
  deleteAnnotation: (annotationId: string) => Promise<void>;
  getAnnotations: (documentId: string) => Promise<DocumentAnnotation[]>;

  // Discovery Bundles
  createBundle: (caseId: string, bundle: Partial<DiscoveryBundle>) => Promise<DiscoveryBundle>;
  shareBundle: (bundleId: string, recipients: string[]) => Promise<void>;
  verifyBundle: (bundleId: string) => Promise<boolean>;

  // Audit & Reports
  getAuditTrail: (caseId: string, documentId?: string) => Promise<AuditTrail[]>;
  generateAuditReport: (caseId: string, documentId?: string) => Promise<string>; // Returns PDF URL
  getDashboard: (caseId: string) => Promise<CaseDashboard>;

  // Utility
  refreshData: () => Promise<void>;
  clearError: () => void;
}

const CaseContext = createContext<CaseContextType | undefined>(undefined);

export const useCase = () => {
  const context = useContext(CaseContext);
  if (!context) {
    throw new Error('useCase must be used within a CaseProvider');
  }
  return context;
};

// Alias for compatibility
export const useCases = useCase;

interface CaseProviderProps {
  children: ReactNode;
}

export const CaseProvider: React.FC<CaseProviderProps> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const [cases, setCases] = useState<CaseFile[]>([]);
  const [currentCase, setCurrentCase] = useState<CaseFile | null>(null);
  const [dashboard, setDashboard] = useState<CaseDashboard | null>(null);
  const [tasks, setTasks] = useState<CaseTask[]>([]);
  const [documents, setDocuments] = useState<CaseDocument[]>([]);
  const [deadlines] = useState<CaseDeadline[]>([]);
  const [teamMembers, setTeamMembers] = useState<CaseTeamMember[]>([]);
  const [annotations, setAnnotations] = useState<DocumentAnnotation[]>([]);
  const [bundles, setBundles] = useState<DiscoveryBundle[]>([]);
  const [auditTrail, setAuditTrail] = useState<AuditTrail[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // API Base URL
  const API_BASE = resolveApiBase();
  const getApiBase = () => API_BASE;

  // Auth Headers
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

  // Error Handler
  const handleApiError = (response: Response, operation: string) => {
    if (response.status === 401) {
      const message = 'Session expired. Please login again.';
      if (error !== message) {
        toast.error(message);
      }
      setError(message);
      throw new Error('authentication required');
    }
    throw new Error(`${operation} failed: ${response.status} ${response.statusText}`);
  };

  // Case Management
  const createCase = async (caseData: Partial<CaseFile>): Promise<CaseFile> => {
    // Clear any stale error before starting a new create flow
    setError(null);
    setLoading(true);
    try {
      const response = await fetchWithTimeout(`${getApiBase()}/cases`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(caseData),
      });

      if (!response.ok) {
        handleApiError(response, 'Create case');
      }

      const data = await response.json();
      // Extract case from response (API returns {case: {...}, message: '...'})
      let newCase = data.case || data;

      // Ensure the case has all required fields with defaults
      if (!newCase.id && newCase._id) {
        newCase.id = String(newCase._id);
      }

      // Normalize date fields
      if (newCase.createdAt && typeof newCase.createdAt === 'string') {
        newCase.createdAt = new Date(newCase.createdAt);
      }
      if (newCase.updatedAt && typeof newCase.updatedAt === 'string') {
        newCase.updatedAt = new Date(newCase.updatedAt);
      }

      // Ensure arrays exist
      newCase.team = newCase.team || newCase.teamMembers || [];
      newCase.teamMembers = newCase.teamMembers || newCase.team || [];
      newCase.documents = newCase.documents || [];
      newCase.tasks = newCase.tasks || [];
      newCase.deadlines = newCase.deadlines || [];
      newCase.annotations = newCase.annotations || [];

      logger.info('Case created successfully:', {
        caseId: newCase.id,
        title: newCase.title,
        hasId: !!newCase.id,
        hasTitle: !!newCase.title
      });

      // Add case optimistically first so it appears immediately
      setCases(prev => {
        // Check if case already exists to avoid duplicates
        const exists = prev.some(c => c.id === newCase.id);
        if (exists) {
          logger.debug('Case already in list, skipping optimistic add');
          return prev;
        }
        logger.debug('Adding case optimistically, current count:', prev.length, 'new case:', newCase);
        const updated = [...prev, newCase];
        logger.debug('After adding, new count:', updated.length);
        return updated;
      });

      // Then refetch cases list to ensure we have the latest data from server
      // This ensures consistency and handles any field transformations
      try {
        const queryParams = new URLSearchParams();
        const refetchResponse = await fetchWithTimeout(`${getApiBase()}/cases?${queryParams}`, {
          headers: getAuthHeaders(),
        });

        if (refetchResponse.ok) {
          const refetchData = await refetchResponse.json();
          const fetchedCases = refetchData.cases || [];
          logger.info('Refetched cases successfully, count:', fetchedCases.length);

          // Only update if we actually got cases back
          // This prevents overwriting the optimistic update with an empty array due to timing issues
          if (fetchedCases.length > 0) {
            setCases(fetchedCases);
          } else {
            logger.warn('Refetch returned 0 cases, keeping optimistic update. This might be a timing issue.');
            // Don't overwrite - the optimistic update should remain
          }
        } else {
          logger.warn('Failed to refetch cases after creation, status:', refetchResponse.status);
          // Case already added optimistically, so UI should still show it
        }
      } catch (refetchError) {
        logger.warn('Error refetching cases after creation:', refetchError);
        // Case already added optimistically, so UI should still show it
      }

      toast.success('Case created successfully');
      return newCase;
    } catch (error) {
      logger.error('Error creating case:', error);
      setError('Failed to create case');
      // Surface a single failure toast from the context
      toast.error('Failed to create case');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const updateCase = async (caseId: string, updates: Partial<CaseFile>): Promise<CaseFile> => {
    setLoading(true);
    try {
      const response = await fetchWithTimeout(`${getApiBase()}/cases/${caseId}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        handleApiError(response, 'Update case');
      }

      const updatedCase = await response.json();
      setCases(prev => prev.map(c => c.id === caseId ? updatedCase : c));
      if (currentCase?.id === caseId) {
        setCurrentCase(updatedCase);
      }
      toast.success('Case updated successfully');
      return updatedCase;
    } catch (error) {
      logger.error('Error updating case:', error);
      setError('Failed to update case');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const deleteCase = async (caseId: string): Promise<void> => {
    setLoading(true);
    try {
      const response = await fetchWithTimeout(`${getApiBase()}/cases/${caseId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        handleApiError(response, 'Delete case');
      }

      setCases(prev => prev.filter(c => c.id !== caseId));
      if (currentCase?.id === caseId) {
        setCurrentCase(null);
      }
      toast.success('Case deleted successfully');
    } catch (error) {
      logger.error('Error deleting case:', error);
      setError('Failed to delete case');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const getCase = async (caseId: string): Promise<CaseFile> => {
    setLoading(true);
    try {
      const response = await fetchWithTimeout(`${getApiBase()}/cases/${caseId}`, {
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        handleApiError(response, 'Get case');
      }

      const caseData = await response.json();
      return caseData;
    } catch (error) {
      logger.error('Error getting case:', error);
      setError('Failed to get case');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const getCases = useCallback(async (filters?: CaseFilter): Promise<CaseListResponse> => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams();
      if (filters) {
        Object.entries(filters).forEach(([key, value]) => {
          if (value !== undefined) {
            queryParams.append(key, Array.isArray(value) ? value.join(',') : value.toString());
          }
        });
      }

      const response = await fetchWithTimeout(`${getApiBase()}/cases?${queryParams}`, {
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        handleApiError(response, 'Get cases');
      }

      const data = await response.json();
      setCases(data.cases);
      return data;
    } catch (error) {
      logger.error('Error getting cases:', error);
      setError('Failed to get cases');
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  const loadCurrentCase = async (caseId: string): Promise<void> => {
    try {
      const caseData = await getCase(caseId);
      setCurrentCase(caseData);

      // Load related data
      await Promise.all([
        getDashboard(caseId),
        getTasks(caseId),
        getDocuments(caseId),
        getAuditTrail(caseId)
      ]);
    } catch (error) {
      logger.error('Error setting current case:', error);
      setError('Failed to load case');
    }
  };

  // Document Management
  const addDocumentToCase = async (caseId: string, document: Partial<CaseDocument>): Promise<CaseDocument> => {
    setLoading(true);
    try {
      const response = await fetchWithTimeout(`${getApiBase()}/cases/${caseId}/documents`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(document),
      });

      if (!response.ok) {
        handleApiError(response, 'Add document');
      }

      const newDocument = await response.json();
      setDocuments(prev => [...prev, newDocument]);
      toast.success('Document added to case');
      return newDocument;
    } catch (error) {
      logger.error('Error adding document:', error);
      setError('Failed to add document');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const updateDocument = async (documentId: string, updates: Partial<CaseDocument>): Promise<CaseDocument> => {
    setLoading(true);
    try {
      const response = await fetchWithTimeout(`${getApiBase()}/documents/${documentId}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        handleApiError(response, 'Update document');
      }

      const updatedDocument = await response.json();
      setDocuments(prev => prev.map(d => d.id === documentId ? updatedDocument : d));
      toast.success('Document updated successfully');
      return updatedDocument;
    } catch (error) {
      logger.error('Error updating document:', error);
      setError('Failed to update document');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const getDocuments = async (caseId: string, filters?: DocumentFilter): Promise<DocumentListResponse> => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams();
      if (filters) {
        Object.entries(filters).forEach(([key, value]) => {
          if (value !== undefined) {
            queryParams.append(key, Array.isArray(value) ? value.join(',') : value.toString());
          }
        });
      }

      const response = await fetchWithTimeout(`${getApiBase()}/cases/${caseId}/documents?${queryParams}`, {
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        handleApiError(response, 'Get documents');
      }

      const data = await response.json();
      setDocuments(data.documents);
      return data;
    } catch (error) {
      logger.error('Error getting documents:', error);
      setError('Failed to get documents');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const deleteDocument = async (documentId: string): Promise<void> => {
    setLoading(true);
    try {
      const response = await fetchWithTimeout(`${getApiBase()}/documents/${documentId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        handleApiError(response, 'Delete document');
      }

      setDocuments(prev => prev.filter(d => d.id !== documentId));
      toast.success('Document deleted successfully');
    } catch (error) {
      logger.error('Error deleting document:', error);
      setError('Failed to delete document');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Task Management
  const createTask = async (caseId: string, task: Partial<CaseTask>): Promise<CaseTask> => {
    setLoading(true);
    try {
      const response = await fetchWithTimeout(`${getApiBase()}/cases/${caseId}/tasks`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(task),
      });

      if (!response.ok) {
        handleApiError(response, 'Create task');
      }

      const newTask = await response.json();
      setTasks(prev => [...prev, newTask]);
      toast.success('Task created successfully');
      return newTask;
    } catch (error) {
      logger.error('Error creating task:', error);
      setError('Failed to create task');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const updateTask = async (taskId: string, updates: Partial<CaseTask>): Promise<CaseTask> => {
    setLoading(true);
    try {
      const response = await fetchWithTimeout(`${getApiBase()}/tasks/${taskId}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        handleApiError(response, 'Update task');
      }

      const updatedTask = await response.json();
      setTasks(prev => prev.map(t => t.id === taskId ? updatedTask : t));
      toast.success('Task updated successfully');
      return updatedTask;
    } catch (error) {
      logger.error('Error updating task:', error);
      setError('Failed to update task');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const completeTask = async (taskId: string): Promise<CaseTask> => {
    return updateTask(taskId, {
      status: 'completed',
      completedAt: new Date()
    });
  };

  const getTasks = async (caseId: string, filters?: TaskFilter): Promise<TaskListResponse> => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams();
      if (filters) {
        Object.entries(filters).forEach(([key, value]) => {
          if (value !== undefined) {
            queryParams.append(key, Array.isArray(value) ? value.join(',') : value.toString());
          }
        });
      }

      const response = await fetchWithTimeout(`${getApiBase()}/cases/${caseId}/tasks?${queryParams}`, {
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        handleApiError(response, 'Get tasks');
      }

      const data = await response.json();
      setTasks(data.tasks);
      return data;
    } catch (error) {
      logger.error('Error getting tasks:', error);
      setError('Failed to get tasks');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const deleteTask = async (taskId: string): Promise<void> => {
    setLoading(true);
    try {
      const response = await fetchWithTimeout(`${getApiBase()}/tasks/${taskId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        handleApiError(response, 'Delete task');
      }

      setTasks(prev => prev.filter(t => t.id !== taskId));
      toast.success('Task deleted successfully');
    } catch (error) {
      logger.error('Error deleting task:', error);
      setError('Failed to delete task');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Team Management
  const addTeamMember = async (caseId: string, member: Partial<CaseTeamMember>): Promise<CaseTeamMember> => {
    setLoading(true);
    try {
      const response = await fetchWithTimeout(`${getApiBase()}/cases/${caseId}/team`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(member),
      });

      if (!response.ok) {
        handleApiError(response, 'Add team member');
      }

      const newMember = await response.json();
      setTeamMembers(prev => [...prev, newMember]);
      toast.success('Team member added successfully');
      return newMember;
    } catch (error) {
      logger.error('Error adding team member:', error);
      setError('Failed to add team member');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const updateTeamMember = async (memberId: string, updates: Partial<CaseTeamMember>): Promise<CaseTeamMember> => {
    setLoading(true);
    try {
      const response = await fetchWithTimeout(`${getApiBase()}/team/${memberId}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        handleApiError(response, 'Update team member');
      }

      const updatedMember = await response.json();
      setTeamMembers(prev => prev.map(m => m.walletAddress === memberId ? updatedMember : m));
      toast.success('Team member updated successfully');
      return updatedMember;
    } catch (error) {
      logger.error('Error updating team member:', error);
      setError('Failed to update team member');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const removeTeamMember = async (memberId: string): Promise<void> => {
    setLoading(true);
    try {
      const response = await fetchWithTimeout(`${getApiBase()}/team/${memberId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        handleApiError(response, 'Remove team member');
      }

      setTeamMembers(prev => prev.filter(m => m.walletAddress !== memberId));
      toast.success('Team member removed successfully');
    } catch (error) {
      logger.error('Error removing team member:', error);
      setError('Failed to remove team member');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const updatePermissions = async (memberId: string, permissions: Permission[]): Promise<void> => {
    await updateTeamMember(memberId, { permissions });
  };

  // Annotations
  const addAnnotation = async (documentId: string, annotation: Partial<DocumentAnnotation>): Promise<DocumentAnnotation> => {
    setLoading(true);
    try {
      const response = await fetchWithTimeout(`${getApiBase()}/documents/${documentId}/annotations`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(annotation),
      });

      if (!response.ok) {
        handleApiError(response, 'Add annotation');
      }

      const newAnnotation = await response.json();
      setAnnotations(prev => [...prev, newAnnotation]);
      toast.success('Annotation added successfully');
      return newAnnotation;
    } catch (error) {
      logger.error('Error adding annotation:', error);
      setError('Failed to add annotation');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const updateAnnotation = async (annotationId: string, updates: Partial<DocumentAnnotation>): Promise<DocumentAnnotation> => {
    setLoading(true);
    try {
      const response = await fetchWithTimeout(`${getApiBase()}/annotations/${annotationId}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        handleApiError(response, 'Update annotation');
      }

      const updatedAnnotation = await response.json();
      setAnnotations(prev => prev.map(a => a.id === annotationId ? updatedAnnotation : a));
      toast.success('Annotation updated successfully');
      return updatedAnnotation;
    } catch (error) {
      logger.error('Error updating annotation:', error);
      setError('Failed to update annotation');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const deleteAnnotation = async (annotationId: string): Promise<void> => {
    setLoading(true);
    try {
      const response = await fetchWithTimeout(`${getApiBase()}/annotations/${annotationId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        handleApiError(response, 'Delete annotation');
      }

      setAnnotations(prev => prev.filter(a => a.id !== annotationId));
      toast.success('Annotation deleted successfully');
    } catch (error) {
      logger.error('Error deleting annotation:', error);
      setError('Failed to delete annotation');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const getAnnotations = async (documentId: string): Promise<DocumentAnnotation[]> => {
    setLoading(true);
    try {
      const response = await fetchWithTimeout(`${getApiBase()}/documents/${documentId}/annotations`, {
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        handleApiError(response, 'Get annotations');
      }

      const annotations = await response.json();
      setAnnotations(annotations);
      return annotations;
    } catch (error) {
      logger.error('Error getting annotations:', error);
      setError('Failed to get annotations');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Discovery Bundles
  const createBundle = async (caseId: string, bundle: Partial<DiscoveryBundle>): Promise<DiscoveryBundle> => {
    setLoading(true);
    try {
      const response = await fetchWithTimeout(`${getApiBase()}/cases/${caseId}/bundles`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(bundle),
      });

      if (!response.ok) {
        handleApiError(response, 'Create bundle');
      }

      const newBundle = await response.json();
      setBundles(prev => [...prev, newBundle]);
      toast.success('Discovery bundle created successfully');
      return newBundle;
    } catch (error) {
      logger.error('Error creating bundle:', error);
      setError('Failed to create bundle');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const shareBundle = async (bundleId: string, recipients: string[]): Promise<void> => {
    setLoading(true);
    try {
      const response = await fetchWithTimeout(`${getApiBase()}/bundles/${bundleId}/share`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ recipients }),
      });

      if (!response.ok) {
        handleApiError(response, 'Share bundle');
      }

      toast.success('Bundle shared successfully');
    } catch (error) {
      logger.error('Error sharing bundle:', error);
      setError('Failed to share bundle');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const verifyBundle = async (bundleId: string): Promise<boolean> => {
    setLoading(true);
    try {
      const response = await fetchWithTimeout(`${getApiBase()}/bundles/${bundleId}/verify`, {
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        handleApiError(response, 'Verify bundle');
      }

      const result = await response.json();
      return result.verified;
    } catch (error) {
      logger.error('Error verifying bundle:', error);
      setError('Failed to verify bundle');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Audit & Reports
  const getAuditTrail = async (caseId: string, documentId?: string): Promise<AuditTrail[]> => {
    setLoading(true);
    try {
      const url = documentId
        ? `${getApiBase()}/cases/${caseId}/documents/${documentId}/audit`
        : `${getApiBase()}/cases/${caseId}/audit`;

      const response = await fetchWithTimeout(url, {
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        handleApiError(response, 'Get audit trail');
      }

      const auditTrail = await response.json();
      setAuditTrail(auditTrail);
      return auditTrail;
    } catch (error) {
      logger.error('Error getting audit trail:', error);
      setError('Failed to get audit trail');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const generateAuditReport = async (caseId: string, documentId?: string): Promise<string> => {
    setLoading(true);
    try {
      const url = documentId
        ? `${getApiBase()}/cases/${caseId}/documents/${documentId}/audit/report`
        : `${getApiBase()}/cases/${caseId}/audit/report`;

      const response = await fetchWithTimeout(url, {
        method: 'POST',
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        handleApiError(response, 'Generate audit report');
      }

      const result = await response.json();
      toast.success('Audit report generated successfully');
      return result.reportUrl;
    } catch (error) {
      logger.error('Error generating audit report:', error);
      setError('Failed to generate audit report');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const getDashboard = async (caseId: string): Promise<CaseDashboard> => {
    setLoading(true);
    try {
      const response = await fetchWithTimeout(`${getApiBase()}/cases/${caseId}/dashboard`, {
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        handleApiError(response, 'Get dashboard');
      }

      const dashboard = await response.json();
      setDashboard(dashboard);
      return dashboard;
    } catch (error) {
      logger.error('Error getting dashboard:', error);
      setError('Failed to get dashboard');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Utility
  const refreshData = async (): Promise<void> => {
    if (currentCase) {
      await loadCurrentCase(currentCase.id);
    }
  };

  const clearError = (): void => {
    setError(null);
  };

  // Load initial data only when authenticated
  useEffect(() => {
    // Don't attempt to load cases if not authenticated
    if (!isAuthenticated) {
      logger.debug('Skipping case load - not authenticated');
      return;
    }

    try {
      getCases().catch((err) => {
        // Silently fail if not authenticated - user will see empty state
        if (err?.message?.includes('authentication')) {
          logger.debug('Skipping case load - not authenticated');
        } else {
          logger.error('Error loading cases:', err);
        }
      });
    } catch (err) {
      logger.debug('Cases load error (expected when not authenticated):', err);
    }
  }, [getCases, isAuthenticated]);

  const value: CaseContextType = useMemo(() => ({
    // State
    cases,
    currentCase,
    dashboard,
    tasks,
    documents,
    deadlines,
    teamMembers,
    annotations,
    bundles,
    auditTrail,
    loading,
    error,

    // Case Management
    createCase,
    updateCase,
    deleteCase,
    getCase,
    getCases,
    loadCurrentCase,

    // Document Management
    addDocumentToCase,
    updateDocument,
    getDocuments,
    deleteDocument,

    // Task Management
    createTask,
    updateTask,
    completeTask,
    getTasks,
    deleteTask,

    // Team Management
    addTeamMember,
    updateTeamMember,
    removeTeamMember,
    updatePermissions,

    // Annotations
    addAnnotation,
    updateAnnotation,
    deleteAnnotation,
    getAnnotations,

    // Discovery Bundles
    createBundle,
    shareBundle,
    verifyBundle,

    // Audit & Reports
    getAuditTrail,
    generateAuditReport,
    getDashboard,

    // Utility
    refreshData,
    clearError,
  }), [cases, currentCase, dashboard, tasks, documents, deadlines, teamMembers, annotations, bundles, auditTrail, loading, error]);

  return (
    <CaseContext.Provider value={value}>
      {children}
    </CaseContext.Provider>
  );
};
