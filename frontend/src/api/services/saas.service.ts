import { BillingPlan, Organization, StorageUsage, TeamActivity, AnalyticsSummary } from '@/types/saas';

// --- MOCK DATA ---

const MOCK_PLANS: BillingPlan[] = [
  {
    id: 'free',
    name: 'Free',
    priceMonthly: 0,
    description: 'Essential security for individuals.',
    limits: {
      storageBytes: 5 * 1024 * 1024 * 1024, // 5 GB
      documentsPerMonth: 50,
      features: ['Basic redaction', 'Client-side encryption', 'Standard support'],
    },
  },
  {
    id: 'pro',
    name: 'Pro',
    priceMonthly: 49,
    description: 'Advanced features for professionals.',
    isPopular: true,
    limits: {
      storageBytes: 100 * 1024 * 1024 * 1024, // 100 GB
      documentsPerMonth: 1000,
      features: ['Everything in Free', 'ZK proof generation', 'Blockchain anchoring', 'Priority support'],
    },
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    priceMonthly: 299,
    description: 'Full compliance suite for organizations.',
    limits: {
      storageBytes: Infinity, // Unlimited
      documentsPerMonth: Infinity, // Unlimited
      features: ['Everything in Pro', 'Compliance profiles', 'Team analytics', 'Dedicated account manager'],
    },
  },
];

const MOCK_ORGANIZATION: Organization = {
  organization_id: 'org-1',
  organization_name: 'Acme Legal',
  owner_address: '0x123...abc',
  created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 45).toISOString(),
  active_plan: 'pro',
  members_count: 12,
  workspaces_count: 4,
};

const MOCK_STORAGE: StorageUsage = {
  usedBytes: 3.2 * 1024 * 1024 * 1024, // 3.2 GB
  limitBytes: 100 * 1024 * 1024 * 1024, // 100 GB (Pro limit)
  percentage: 3.2,
  breakdown: {
    documents: 2.8 * 1024 * 1024 * 1024,
    proofs: 0.3 * 1024 * 1024 * 1024,
    other: 0.1 * 1024 * 1024 * 1024,
  },
};

const MOCK_ANALYTICS: AnalyticsSummary = {
  documentsProtected: 842,
  redactionsApplied: 12450,
  proofsGenerated: 630,
  blockchainAnchors: 630,
  certificatesIssued: 412,
  activeComplianceProfile: 'GDPR + HIPAA',
  certificateRate: 98.5,
};

const MOCK_ACTIVITY: TeamActivity[] = [
  {
    id: 'evt-1',
    organization_id: 'org-1',
    user_address: '0xabc...123',
    user_name: 'Alice',
    action: 'uploaded contract.pdf',
    target: 'Workspace: Legal Docs',
    timestamp: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
    iconType: 'upload',
  },
  {
    id: 'evt-2',
    organization_id: 'org-1',
    user_address: '0xdef...456',
    user_name: 'Bob',
    action: 'applied 14 redactions',
    target: 'Document: NDA_Q3.pdf',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    iconType: 'redact',
  },
  {
    id: 'evt-3',
    organization_id: 'org-1',
    user_address: '0xghi...789',
    user_name: 'Compliance Bot',
    action: 'verified ZK proof',
    target: 'Document: NDA_Q3.pdf',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2 - 5000).toISOString(),
    iconType: 'proof',
  },
  {
    id: 'evt-4',
    organization_id: 'org-1',
    user_address: '0x123...abc',
    user_name: 'Legal Team',
    action: 'downloaded security certificate',
    target: 'Document: Merger_Agreement.pdf',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    iconType: 'certificate',
  },
];

const MOCK_CHART_DATA = Array.from({ length: 7 }).map((_, i) => ({
  date: new Date(Date.now() - 1000 * 60 * 60 * 24 * (6 - i)).toLocaleDateString('en-US', { weekday: 'short' }),
  documents: Math.floor(Math.random() * 50) + 10,
}));

// --- SERVICE IMPLEMENTATION ---

class SaasService {
  async getBillingPlans(): Promise<BillingPlan[]> {
    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 300));
    return MOCK_PLANS;
  }

  async getCurrentOrganization(): Promise<Organization> {
    await new Promise((resolve) => setTimeout(resolve, 300));
    return MOCK_ORGANIZATION;
  }

  async getCurrentPlan(): Promise<{ plan: BillingPlan; usage: { documentsThisMonth: number } }> {
    await new Promise((resolve) => setTimeout(resolve, 300));
    const plan = MOCK_PLANS.find((p) => p.id === MOCK_ORGANIZATION.active_plan) || MOCK_PLANS[0];
    return {
      plan,
      usage: {
        documentsThisMonth: 142, // Mock usage
      },
    };
  }

  async getStorageUsage(): Promise<StorageUsage> {
    await new Promise((resolve) => setTimeout(resolve, 400));
    return MOCK_STORAGE;
  }

  async getAnalyticsSummary(): Promise<AnalyticsSummary> {
    await new Promise((resolve) => setTimeout(resolve, 500));
    return MOCK_ANALYTICS;
  }

  async getTeamActivity(): Promise<TeamActivity[]> {
    await new Promise((resolve) => setTimeout(resolve, 400));
    return MOCK_ACTIVITY;
  }

  async getDailyChartData(): Promise<{ date: string; documents: number }[]> {
    await new Promise((resolve) => setTimeout(resolve, 350));
    return MOCK_CHART_DATA;
  }
}

export const saasService = new SaasService();
