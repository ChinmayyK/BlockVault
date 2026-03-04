import { Search, Wallet, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { useRBAC } from "@/contexts/RBACContext";

export function TopBar() {
  const { user, isAuthenticated } = useAuth();
  const { currentUser } = useRBAC();

  return (
    <header
      className="fixed top-0 left-0 right-0 z-30 h-16 bg-background border-b border-border transition-[padding-left] duration-200"
      data-layout="topbar"
    >
      <div className="flex h-full items-center justify-between px-6">
        {/* Search */}
        <div className="flex-1 max-w-xl">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search documents..."
              className="pl-10 bg-input border-border"
            />
          </div>
        </div>

        {/* Right side actions */}
        <div className="flex items-center gap-3">
          {isAuthenticated && user ? (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-card border border-primary/50">
              <div className="w-2 h-2 bg-success rounded-full animate-pulse" />
              <span className="text-sm font-mono text-muted-foreground">
                {user.address.slice(0, 6)}...{user.address.slice(-4)}
              </span>
              {currentUser?.role && (
                <Badge variant="outline" className="ml-1">{currentUser.role}</Badge>
              )}
            </div>
          ) : (
            <Button variant="outline" size="sm" className="gap-2">
              <Wallet className="h-4 w-4" />
              Connect Wallet
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
