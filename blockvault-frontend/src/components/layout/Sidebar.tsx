import { NavLink } from "react-router-dom";
import { FileText, Scale, Briefcase, Link2, Settings, Menu, X, LogOut, Pin, PinOff } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";

const navigation = [
  { name: "Files", href: "/files", icon: FileText },
  { name: "Legal", href: "/legal", icon: Scale },
  { name: "Cases", href: "/cases", icon: Briefcase },
  { name: "Blockchain", href: "/blockchain", icon: Link2 },
  { name: "Settings", href: "/settings", icon: Settings },
];

export function Sidebar() {
  const [isOpen, setIsOpen] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const { user, logout } = useAuth();

  const handleLogout = () => {
    logout();
    window.location.href = '/';
  };

  const isExpanded = isOpen || isPinned || isHovered;

  const handleMouseEnter = () => {
    if (!isPinned) {
      setIsHovered(true);
    }
  };

  const handleMouseLeave = () => {
    if (!isPinned) {
      setIsHovered(false);
    }
  };

  useEffect(() => {
    const root = document.documentElement;

    const updateSidebarWidth = () => {
      const isDesktop = window.matchMedia('(min-width: 768px)').matches;
      if (isDesktop) {
        root.style.setProperty('--sidebar-width-current', isExpanded ? '13rem' : '4rem');
      } else {
        root.style.setProperty('--sidebar-width-current', isOpen ? '13rem' : '0px');
      }
    };

    updateSidebarWidth();
    window.addEventListener('resize', updateSidebarWidth);
    return () => {
      window.removeEventListener('resize', updateSidebarWidth);
    };
  }, [isExpanded, isOpen]);

  return (
    <>
      {/* Mobile menu button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed top-4 left-4 z-50 md:hidden p-2 rounded-lg bg-card border border-border"
      >
        {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {/* Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "group/sidebar fixed top-0 left-0 z-40 h-screen bg-sidebar border-r border-sidebar-border transition-all duration-200",
          "md:translate-x-0",
          isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
          isExpanded ? "w-52" : "w-52",
          isExpanded ? "md:w-52" : "md:w-16"
        )}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <div className="flex h-full flex-col">
          {/* Logo */}
          <div className="flex h-16 items-center border-b border-sidebar-border px-3 md:px-4">
            <div
              className={cn(
                "flex items-center transition-all duration-200",
                isExpanded ? "gap-2" : "justify-center w-full"
              )}
            >
              <h1
                className={cn(
                  "font-semibold transition-all duration-200",
                  isExpanded ? "text-lg" : "text-base tracking-[0.08em]"
                )}
              >
                {isExpanded ? "BlockVault" : "BV"}
              </h1>
            </div>
            <button
              type="button"
              onClick={() => setIsPinned((prev) => !prev)}
              className={cn(
                "ml-auto hidden rounded-full p-1.5 text-muted-foreground transition-colors hover:text-foreground md:inline-flex",
                !isExpanded && "md:opacity-0 md:pointer-events-none"
              )}
              aria-label={isPinned ? "Unpin sidebar" : "Pin sidebar"}
            >
              {isPinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 space-y-1 p-3 md:p-2">
            {navigation.map((item) => (
              <NavLink
                key={item.name}
                to={item.href}
                onClick={() => setIsOpen(false)}
                className={({ isActive }) =>
                  cn(
                    "group/nav flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
                    !isExpanded && "md:justify-center md:px-2",
                    isActive ? "text-primary" : "text-sidebar-foreground hover:text-primary/80"
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <div
                      className={cn(
                        "sidebar-icon h-9 w-9",
                        isActive
                          ? "sidebar-icon--active"
                          : "text-sidebar-foreground group-hover/nav:text-primary/70 group-focus-visible/nav:text-primary"
                      )}
              >
                <item.icon className="h-5 w-5 shrink-0" />
                    </div>
                <span
                  className={cn(
                    "ml-2 truncate transition-all duration-200",
                    !isExpanded && "md:ml-0 md:w-0 md:opacity-0 md:overflow-hidden"
                  )}
                >
                  {item.name}
                </span>
                  </>
                )}
              </NavLink>
            ))}
          </nav>

          {/* Footer */}
          <div className="border-t border-sidebar-border p-3 md:p-3">
            <div
              className={cn(
                "flex transition-all duration-200",
                isExpanded
                  ? "items-center gap-2 rounded-xl bg-sidebar-accent/60 px-2.5 py-2 hover:bg-sidebar-accent"
                  : "md:flex-col md:items-center md:gap-1 md:px-0 md:py-0"
              )}
            >
              <div
                className={cn(
                  "flex items-center justify-center rounded-full border border-white/12 bg-primary/75 text-primary-foreground font-semibold transition-all duration-200",
                  isExpanded ? "h-8 w-8 text-xs" : "h-6 w-6 text-[10px]"
                )}
              >
                {user?.address?.slice(2, 4).toUpperCase() || 'BV'}
              </div>
            {isExpanded && (
              <div className="flex-1 min-w-0 text-left transition-all duration-200">
                <p className="text-sm font-medium truncate">
                  {user?.address ? `${user.address.slice(0, 6)}...${user.address.slice(-4)}` : 'Guest'}
                </p>
                <p className="text-xs text-muted-foreground truncate">Connected</p>
              </div>
            )}
            </div>
            {user && (
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  "mt-2 w-full justify-start gap-2 rounded-lg px-2.5 py-2 text-sm text-muted-foreground transition-all duration-200 hover:bg-sidebar-accent hover:text-foreground",
                  !isExpanded && "md:justify-center md:px-0"
                )}
                onClick={handleLogout}
              >
                <LogOut className="h-4 w-4" />
                <span className={cn(!isExpanded && "md:hidden")}>Logout</span>
              </Button>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}
