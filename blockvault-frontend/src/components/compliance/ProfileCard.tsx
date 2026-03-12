/**
 * Profile Card Component
 * 
 * Displays a compliance profile with name, description, rules, and activation button.
 * Visually distinguishes active profiles from inactive ones.
 */

import React from 'react';
import { ComplianceProfile } from '@/api/services/compliance.service';
import { CheckCircle } from 'lucide-react';

interface ProfileCardProps {
  profile: ComplianceProfile;
  isActive: boolean;
  isActivating: boolean;
  onActivate: (profileName: string) => void;
}

export const ProfileCard: React.FC<ProfileCardProps> = ({
  profile,
  isActive,
  isActivating,
  onActivate,
}) => {
  const handleActivate = () => {
    if (!isActive && !isActivating) {
      onActivate(profile.name);
    }
  };

  const getRiskThresholdColor = (threshold: string) => {
    switch (threshold) {
      case 'high':
        return 'text-red-600 bg-red-50';
      case 'medium':
        return 'text-yellow-600 bg-yellow-50';
      case 'low':
        return 'text-green-600 bg-green-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  return (
    <div
      className={`
        relative p-6 rounded-lg border-2 transition-all
        ${
          isActive
            ? 'border-blue-500 bg-blue-50 shadow-lg'
            : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-md'
        }
      `}
    >
      {isActive && (
        <div className="absolute top-4 right-4">
          <div className="flex items-center gap-2 px-3 py-1 bg-blue-600 text-white text-sm font-medium rounded-full">
            <CheckCircle className="w-4 h-4" />
            Active
          </div>
        </div>
      )}

      <div className="mb-4">
        <h3 className="text-xl font-bold text-gray-900 mb-2">
          {profile.name}
        </h3>
        <p className="text-gray-600 text-sm">
          {profile.description}
        </p>
      </div>

      <div className="mb-4">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-sm font-medium text-gray-700">
            Risk Threshold:
          </span>
          <span
            className={`px-2 py-1 text-xs font-semibold rounded ${getRiskThresholdColor(
              profile.risk_threshold
            )}`}
          >
            {profile.risk_threshold.toUpperCase()}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700">
            Auto-Redact:
          </span>
          <span
            className={`px-2 py-1 text-xs font-semibold rounded ${
              profile.auto_redact
                ? 'text-green-600 bg-green-50'
                : 'text-gray-600 bg-gray-50'
            }`}
          >
            {profile.auto_redact ? 'ENABLED' : 'DISABLED'}
          </span>
        </div>
      </div>

      <div className="mb-4">
        <p className="text-sm font-medium text-gray-700 mb-2">
          Detection Rules:
        </p>
        <div className="flex flex-wrap gap-2">
          {profile.rules.map((rule) => (
            <span
              key={rule}
              className="px-2 py-1 text-xs font-medium text-gray-700 bg-gray-100 rounded"
            >
              {rule}
            </span>
          ))}
        </div>
      </div>

      {!isActive && (
        <button
          onClick={handleActivate}
          disabled={isActivating}
          className="w-full px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isActivating ? 'Activating...' : 'Activate Profile'}
        </button>
      )}
    </div>
  );
};

export default ProfileCard;
