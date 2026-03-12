/**
 * Compliance Settings Page
 * 
 * Allows organization administrators to view and activate compliance profiles
 * for regulatory-aligned redaction policies (GDPR, HIPAA, FINRA, Legal Discovery).
 */

import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { complianceService, ComplianceProfile } from '@/api/services/compliance.service';
import { ProfileCard } from '@/components/compliance/ProfileCard';
import { logger } from '@/utils/logger';

export const ComplianceSettingsPage: React.FC = () => {
  const [profiles, setProfiles] = useState<ComplianceProfile[]>([]);
  const [activeProfile, setActiveProfile] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [activating, setActivating] = useState<string | null>(null);

  // TODO: Get org_id from user context/auth
  const orgId = 'default-org';

  useEffect(() => {
    loadProfiles();
  }, []);

  const loadProfiles = async () => {
    try {
      setLoading(true);
      const profilesData = await complianceService.listProfiles();
      setProfiles(profilesData);
      
      // TODO: Load active profile from organization data
      // For now, we'll detect it from the first activation
    } catch (error) {
      logger.error('Failed to load compliance profiles:', error);
      toast.error('Failed to load compliance profiles');
    } finally {
      setLoading(false);
    }
  };

  const handleActivateProfile = async (profileName: string) => {
    try {
      setActivating(profileName);
      await complianceService.activateProfile(orgId, profileName);
      setActiveProfile(profileName);
      toast.success(`${profileName} profile activated`);
      logger.info(`Activated compliance profile: ${profileName}`);
    } catch (error: any) {
      logger.error('Failed to activate profile:', error);
      const errorMsg = error.response?.data?.error || 'Failed to activate profile';
      toast.error(errorMsg);
    } finally {
      setActivating(null);
    }
  };

  const handleDeactivateProfile = async () => {
    try {
      setActivating('deactivating');
      await complianceService.deactivateProfile(orgId);
      const previousProfile = activeProfile;
      setActiveProfile(null);
      toast.success('Compliance profile deactivated');
      logger.info(`Deactivated compliance profile: ${previousProfile}`);
    } catch (error: any) {
      logger.error('Failed to deactivate profile:', error);
      const errorMsg = error.response?.data?.error || 'Failed to deactivate profile';
      toast.error(errorMsg);
    } finally {
      setActivating(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading compliance profiles...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Compliance Profiles
        </h1>
        <p className="text-gray-600">
          Activate predefined redaction policies aligned with regulatory standards.
          Your organization can enable one profile at a time.
        </p>
      </div>

      {activeProfile && (
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-blue-900">
                Active Compliance Profile
              </p>
              <p className="text-lg font-semibold text-blue-700">
                {activeProfile}
              </p>
            </div>
            <button
              onClick={handleDeactivateProfile}
              disabled={activating === 'deactivating'}
              className="px-4 py-2 text-sm font-medium text-blue-700 bg-white border border-blue-300 rounded-md hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {activating === 'deactivating' ? 'Deactivating...' : 'Deactivate'}
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
        {profiles.map((profile) => (
          <ProfileCard
            key={profile.name}
            profile={profile}
            isActive={activeProfile === profile.name}
            isActivating={activating === profile.name}
            onActivate={handleActivateProfile}
          />
        ))}
      </div>

      {profiles.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500">No compliance profiles available</p>
        </div>
      )}
    </div>
  );
};

export default ComplianceSettingsPage;
