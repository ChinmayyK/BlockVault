/**
 * Profile Badge Component
 * 
 * Displays the active compliance profile in the dashboard header.
 * Hidden when no profile is active.
 */

import React from 'react';
import { Shield } from 'lucide-react';

interface ProfileBadgeProps {
  profileName: string | null;
}

export const ProfileBadge: React.FC<ProfileBadgeProps> = ({ profileName }) => {
  if (!profileName) {
    return null;
  }

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-100 border border-blue-300 rounded-md">
      <Shield className="w-4 h-4 text-blue-700" />
      <span className="text-sm font-medium text-blue-900">
        Organization Compliance: <span className="font-semibold">{profileName}</span> Active
      </span>
    </div>
  );
};

export default ProfileBadge;
