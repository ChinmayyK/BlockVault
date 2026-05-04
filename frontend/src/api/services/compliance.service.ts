/**
 * Compliance Profile API Service
 * 
 * Provides methods for managing compliance profiles:
 * - List available profiles
 * - Activate profile for organization
 * - Deactivate active profile
 */

import apiClient from '../client';

export interface ComplianceProfile {
  name: string;
  description: string;
  rules: string[];
  risk_threshold: 'low' | 'medium' | 'high';
  auto_redact: boolean;
}

export interface ComplianceProfilesResponse {
  profiles: ComplianceProfile[];
}

export interface ActivateProfileRequest {
  profile_name: string;
}

export interface ActivateProfileResponse {
  success: boolean;
  profile: string;
}

export interface DeactivateProfileResponse {
  success: boolean;
}

/**
 * List all available compliance profiles
 */
export const listProfiles = async (): Promise<ComplianceProfile[]> => {
  const response = await apiClient.get<ComplianceProfilesResponse>('/compliance/profiles');
  return response.data.profiles;
};

/**
 * Activate a compliance profile for an organization
 * 
 * @param orgId - Organization ID
 * @param profileName - Name of profile to activate
 */
export const activateProfile = async (
  orgId: string,
  profileName: string
): Promise<ActivateProfileResponse> => {
  const response = await apiClient.post<ActivateProfileResponse>(
    `/compliance/orgs/${orgId}/compliance-profile`,
    { profile_name: profileName }
  );
  return response.data;
};

/**
 * Deactivate the active compliance profile for an organization
 * 
 * @param orgId - Organization ID
 */
export const deactivateProfile = async (
  orgId: string
): Promise<DeactivateProfileResponse> => {
  const response = await apiClient.delete<DeactivateProfileResponse>(
    `/compliance/orgs/${orgId}/compliance-profile`
  );
  return response.data;
};

export const complianceService = {
  listProfiles,
  activateProfile,
  deactivateProfile,
};

export default complianceService;
