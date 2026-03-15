import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { writeStoredUser } from '@/utils/authStorage';
import { SecureLoader } from '@/components/ui/SecureLoader';

/**
 * DemoInitPage — Entry point for /demo.
 *
 * This page bypasses wallet authentication entirely.
 * It injects a synthetic "demo_user" into AuthContext,
 * then immediately redirects to the standard /files page
 * which will pick up the demo session seamlessly.
 */
export default function DemoInitPage() {
  const { setUser } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // Create a mock demo user that bypasses wallet auth
    const demoUser = {
      address: 'demo_user',
      jwt: 'demo_token',
      user_id: 'demo_user_id',
      role: 'USER',
      platform_role: 'USER',
      organizations: [],
      workspaces: [],
    };

    // Inject into AuthContext and localStorage
    setUser(demoUser);
    writeStoredUser(demoUser);

    // Dispatch auth-changed event so FileContext picks it up
    window.dispatchEvent(new Event('blockvault:auth-changed'));

    // Navigate to /files after a brief delay for state propagation
    const timer = setTimeout(() => {
      navigate('/files', { replace: true });
    }, 400);

    return () => clearTimeout(timer);
  }, [setUser, navigate]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <div className="flex flex-col items-center gap-4">
        <SecureLoader size={56} />
        <p className="text-sm text-muted-foreground animate-pulse">
          Initializing Demo Environment...
        </p>
      </div>
    </div>
  );
}
