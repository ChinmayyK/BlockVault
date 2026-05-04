import React, { useReducer, useMemo, useCallback } from 'react';
import { Users, Building2, User, Shield } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { UserRole } from '@/types/rbac';
import toast from 'react-hot-toast';

type Step = 'role' | 'firm' | 'complete';

interface OnboardingState {
  step: Step;
  selectedRole: UserRole | null;
  firmName: string;
  loading: boolean;
}

type OnboardingAction =
  | { type: 'SET_ROLE'; role: UserRole }
  | { type: 'SET_STEP'; step: Step }
  | { type: 'SET_FIRM_NAME'; value: string }
  | { type: 'SET_LOADING'; loading: boolean }
  | { type: 'RESET' };

const initialState: OnboardingState = {
  step: 'role',
  selectedRole: null,
  firmName: '',
  loading: false,
};

const ROLE_METADATA: Record<
  UserRole,
  {
    label: string;
    description: string;
    badge: string;
    badgeClass: string;
    borderClass: string;
    Icon: LucideIcon;
    iconClass: string;
  }
> = {
  'lead-attorney': {
    label: 'Lead Attorney',
    description: 'Full access to case management, document operations, and team coordination',
    badge: 'Full administrative access',
    badgeClass: 'text-blue-400',
    borderClass: 'hover:border-blue-500/50',
    Icon: Shield,
    iconClass: 'text-blue-500',
  },
  associate: {
    label: 'Associate Attorney',
    description: 'Broad access to document operations and sharing, limited administrative access',
    badge: 'Document operations access',
    badgeClass: 'text-green-400',
    borderClass: 'hover:border-green-500/50',
    Icon: Users,
    iconClass: 'text-green-500',
  },
  paralegal: {
    label: 'Paralegal',
    description: 'Document management and organization, limited operational access',
    badge: 'Document management access',
    badgeClass: 'text-purple-400',
    borderClass: 'hover:border-purple-500/50',
    Icon: User,
    iconClass: 'text-purple-500',
  },
  client: {
    label: 'Client',
    description: 'View-only access to documents shared with you, can sign required documents',
    badge: 'View and sign documents',
    badgeClass: 'text-orange-400',
    borderClass: 'hover:border-orange-500/50',
    Icon: User,
    iconClass: 'text-orange-500',
  },
  'external-counsel': {
    label: 'External Counsel',
    description: 'View-only access to documents shared with you, can sign required documents',
    badge: 'View and collaborate securely',
    badgeClass: 'text-indigo-400',
    borderClass: 'hover:border-indigo-500/50',
    Icon: Building2,
    iconClass: 'text-indigo-500',
  },
};

const FIRM_REQUIRED_ROLES = new Set<UserRole>(['lead-attorney', 'associate', 'paralegal']);

function onboardingReducer(state: OnboardingState, action: OnboardingAction): OnboardingState {
  switch (action.type) {
    case 'SET_ROLE':
      return { ...state, selectedRole: action.role };
    case 'SET_STEP':
      return { ...state, step: action.step };
    case 'SET_FIRM_NAME':
      return { ...state, firmName: action.value };
    case 'SET_LOADING':
      return { ...state, loading: action.loading };
    case 'RESET':
      return initialState;
    default:
      return state;
  }
}

interface UserOnboardingProps {
  onComplete: (role: UserRole, firmName?: string) => void;
  userAddress: string;
}

type RoleMeta = (typeof ROLE_METADATA)[UserRole];

interface RoleOptionCardProps {
  role: UserRole;
  meta: RoleMeta;
  onSelect: (role: UserRole) => void;
}

const RoleOptionCard: React.FC<RoleOptionCardProps> = React.memo(({ role, meta, onSelect }) => {
  const handleClick = useCallback(() => onSelect(role), [onSelect, role]);
  const { Icon } = meta;

  return (
    <Card
      className={`p-6 cursor-pointer transition-colors border-2 border-transparent hover:bg-slate-800/50 ${meta.borderClass}`}
      onClick={handleClick}
    >
      <div className="text-center">
        <div className="flex justify-center mb-4">
          <Icon className={`w-8 h-8 ${meta.iconClass}`} />
        </div>
        <h3 className="text-lg font-semibold text-white mb-2">{meta.label}</h3>
        <p className="text-sm text-slate-400 mb-4">{meta.description}</p>
        <div className={`text-xs ${meta.badgeClass}`}>{meta.badge}</div>
      </div>
    </Card>
  );
});
RoleOptionCard.displayName = 'RoleOptionCard';

export const UserOnboarding: React.FC<UserOnboardingProps> = ({ onComplete, userAddress }) => {
  const [state, dispatch] = useReducer(onboardingReducer, initialState);
  const { step, selectedRole, firmName, loading } = state;
  const roleEntries = useMemo(() => Object.entries(ROLE_METADATA) as [UserRole, RoleMeta][], []);
  const SelectedIcon = selectedRole ? ROLE_METADATA[selectedRole].Icon : null;
  const selectedRoleLabel = selectedRole ? ROLE_METADATA[selectedRole].label : null;
  const selectedIconClass = selectedRole ? ROLE_METADATA[selectedRole].iconClass : '';

  const handleComplete = useCallback(async (roleOverride?: UserRole) => {
    const finalRole = roleOverride || selectedRole;
    if (!finalRole) return;

    dispatch({ type: 'SET_LOADING', loading: true });
    try {
      const normalizedFirm = firmName.trim() || null;
      const userProfile = {
        walletAddress: userAddress,
        role: finalRole,
        firmName: normalizedFirm,
        onboardedAt: new Date().toISOString(),
        isOnboarded: true,
      };

      localStorage.setItem('user_profile', JSON.stringify(userProfile));

      window.dispatchEvent(
        new CustomEvent('userOnboarded', {
          detail: { role: finalRole, firmName: normalizedFirm },
        })
      );

      toast.success(`Welcome! You've been registered as a ${ROLE_METADATA[finalRole].label}`);
      onComplete(finalRole, normalizedFirm || undefined);
    } catch (error) {
      console.error('Error completing onboarding:', error);
      toast.error('Failed to complete onboarding');
    } finally {
      dispatch({ type: 'SET_LOADING', loading: false });
    }
  }, [selectedRole, firmName, userAddress, onComplete]);

  const handleRoleSelection = useCallback((role: UserRole) => {
    dispatch({ type: 'SET_ROLE', role });

    if (FIRM_REQUIRED_ROLES.has(role)) {
      dispatch({ type: 'SET_STEP', step: 'firm' });
    } else {
      void handleComplete(role);
    }
  }, [handleComplete]);

  const handleFirmNameChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    dispatch({ type: 'SET_FIRM_NAME', value: event.target.value });
  }, []);

  const handleBackToRole = useCallback(() => {
    dispatch({ type: 'SET_STEP', step: 'role' });
  }, []);

  const handleFirmSubmit = useCallback(() => {
    void handleComplete();
  }, [handleComplete]);

  if (step === 'role') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
        <Card className="w-full max-w-4xl">
          <div className="p-8">
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold text-white mb-4">Welcome to BlockVault Legal</h1>
              <p className="text-slate-400 text-lg">
                Please select your role to get started with secure legal document management
              </p>
              <div className="mt-4 p-3 bg-slate-800/50 rounded-lg">
                <p className="text-sm text-slate-300">
                  <strong>Wallet Address:</strong> <span className="font-mono text-blue-400">{userAddress}</span>
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {roleEntries.map(([role, meta]) => (
                <RoleOptionCard key={role} role={role} meta={meta} onSelect={handleRoleSelection} />
              ))}
            </div>
          </div>
        </Card>
      </div>
    );
  }

  if (step === 'firm') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
        <Card className="w-full max-w-2xl">
          <div className="p-8">
            <div className="text-center mb-8">
              {SelectedIcon && (
                <div className="flex justify-center mb-4">
                  <SelectedIcon className={`w-8 h-8 ${selectedIconClass}`} />
                </div>
              )}
              <h1 className="text-2xl font-bold text-white mb-2">
                Register Your Law Firm
              </h1>
              <p className="text-slate-400">
                As a {selectedRoleLabel || 'legal professional'}, you need to register your law firm to access case
                management features.
              </p>
            </div>

            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Law Firm Name *
                </label>
              <Input
                value={firmName}
                onChange={handleFirmNameChange}
                placeholder="Enter your law firm name"
                className="w-full"
              />
              </div>

              <div className="bg-slate-800/50 rounded-lg p-4">
                <h3 className="text-sm font-medium text-white mb-2">What happens next?</h3>
                <ul className="text-sm text-slate-400 space-y-1">
                  <li>• Your firm will be registered in the system</li>
                  <li>• You'll be able to create and manage case files</li>
                  <li>• You can invite other team members to join your firm</li>
                  <li>• All your documents will be securely encrypted and stored</li>
                </ul>
              </div>

              <div className="flex space-x-4">
                <Button
                  variant="outline"
                  onClick={handleBackToRole}
                  className="flex-1"
                >
                  Back
                </Button>
                <Button
                  onClick={handleFirmSubmit}
                  disabled={!firmName.trim() || loading}
                  className="flex-1"
                >
                  {loading ? 'Registering...' : 'Register Firm & Continue'}
                </Button>
              </div>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return null;
};
