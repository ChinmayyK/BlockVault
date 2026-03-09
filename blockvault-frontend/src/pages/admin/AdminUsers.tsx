import React from 'react';
import { ShieldAlert, Users } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { isAdmin } from '@/utils/permissions';
import { Card } from '@/components/ui/card';

export default function AdminUsers() {
  const { user } = useAuth();

  if (!isAdmin(user?.role)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <ShieldAlert className="w-16 h-16 text-destructive" />
        <h2 className="text-2xl font-bold text-foreground">Access Denied</h2>
        <p className="text-muted-foreground">You do not have permission to perform this action.</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto py-8 px-4 space-y-8">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
          <Users className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-foreground">User Management</h1>
          <p className="text-muted-foreground">Manage user roles and platform access</p>
        </div>
      </div>

      <Card variant="premium" className="p-6">
        <div className="text-center py-12">
          <h3 className="text-xl font-semibold mb-2">Admin Dashboard Panel</h3>
          <p className="text-muted-foreground">User administration controls will be loaded here.</p>
        </div>
      </Card>
    </div>
  );
}
