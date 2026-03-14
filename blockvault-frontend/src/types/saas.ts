/**
 * SaaS Platform Types
 */

export type PlanTier = 'free' | 'pro' | 'enterprise';

export interface PlanLimits {
  storageBytes: number;
  documentsPerMonth: number;
  features: string[];
}

export interface BillingPlan {
  id: PlanTier;
  name: string;
  priceMonthly: number;
  limits: PlanLimits;
  description: string;
  isPopular?: boolean;
}

export interface Organization {
  organization_id: string;
  organization_name: string;
  owner_address: string;
  created_at: string;
  active_plan: PlanTier;
  members_count: number;
  workspaces_count: number;
}

export interface StorageUsage {
  usedBytes: number;
  limitBytes: number;
  percentage: number;
  breakdown: {
    documents: number;
    proofs: number;
    other: number;
  };
}

export interface UsageMetric {
  organization_id: string;
  event_type: 'document_uploaded' | 'redactions_applied' | 'proof_generated' | 'blockchain_anchor' | 'certificate_issued';
  count: number;
  period: string; // ISO Date string for the start of the period (e.g., day, week)
}

export interface TeamActivity {
  id: string;
  organization_id: string;
  user_address: string;
  user_name?: string;
  action: string;
  target: string;
  timestamp: string; // ISO string
  iconType?: 'upload' | 'redact' | 'proof' | 'certificate' | 'settings';
}

export interface AnalyticsSummary {
  documentsProtected: number;
  redactionsApplied: number;
  proofsGenerated: number;
  blockchainAnchors: number;
  certificatesIssued: number;
  activeComplianceProfile: string;
  certificateRate: number; // percentage
}
