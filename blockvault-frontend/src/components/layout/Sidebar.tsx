import { NavLink } from "react-router-dom";
import { FileText, Briefcase, Settings, Menu, X, LogOut, Pin, PinOff, BarChart3, CreditCard } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const navigation = [
  { name: "Personal Vault", href: "/files", icon: FileText },
  { name: "Analytics", href: "/analytics", icon: BarChart3 },
  { name: "Organizations", href: "/orgs", icon: Briefcase },
  { name: "Billing", href: "/billing", icon: CreditCard },
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
        root.style.setProperty('--sidebar-width-current', isExpanded ? '13rem' : '4.5rem');
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
    <TooltipProvider>
      {/* Mobile menu button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed top-4 left-4 z-50 md:hidden p-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300 shadow-sm"
      >
        {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {/* Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar background and border */}
      <aside
        className={cn(
          "group/sidebar fixed top-0 left-0 z-40 h-screen bg-[#09090b] border-r border-zinc-800 transition-all duration-200 ease-[cubic-bezier(0.25,0.1,0.25,1)] flex flex-col",
          "md:translate-x-0",
          isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
          isExpanded ? "w-52" : "md:w-[4.5rem] w-52"
        )}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {/* Logo Section */}
        <div className="flex h-16 items-center px-[1.125rem] shrink-0">
          <div
            className={cn(
              "flex flex-1 items-center transition-all duration-200 ease-out",
              isExpanded ? "justify-start" : "justify-center"
            )}
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-zinc-200">
              <div className="h-5 w-5 bg-zinc-200 rounded-sm" style={{ clipPath: "polygon(0 0, 70% 0, 100% 30%, 100% 100%, 0 100%)" }} />
            </div>
            {isExpanded && (
              <h1 className="font-semibold text-zinc-100 text-base tracking-tight ml-3 whitespace-nowrap overflow-hidden transition-all duration-200 delay-75">
                BlockVault
              </h1>
            )}
          </div>
          
          <button
            type="button"
            onClick={() => setIsPinned((prev) => !prev)}
            className={cn(
              "ml-auto hidden rounded-full p-1.5 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-200 md:inline-flex",
              !isExpanded && "md:opacity-0 md:pointer-events-none md:hidden" 
            )}
            aria-label={isPinned ? "Unpin sidebar" : "Pin sidebar"}
          >
            {isPinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
          </button>
        </div>

        {/* Navigation Section */}
        <nav className="flex-1 overflow-x-hidden overflow-y-auto px-3 py-4 space-y-1.5 no-scrollbar">
          {navigation.map((item) => (
            <Tooltip key={item.name} delayDuration={150}>
              <TooltipTrigger asChild>
                <NavLink
                  to={item.href}
                  onClick={() => setIsOpen(false)}
                  className={({ isActive }) =>
                    cn(
                      "group/nav flex items-center gap-3 rounded-[10px] px-2 py-2 text-sm font-medium transition-all duration-200 ease-out transform hover:scale-[1.02]",
                      !isExpanded && "md:justify-center md:px-0",
                      isActive 
                        ? "text-zinc-100" 
                        : "text-zinc-400 hover:bg-zinc-800/40 hover:text-zinc-200"
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      <div
                        className={cn(
                          "flex items-center justify-center shrink-0 w-[34px] h-[34px] rounded-[8px] transition-all duration-200 ease-out",
                          isActive
                            ? "bg-zinc-800/80 text-zinc-100 shadow-[0_2px_10px_rgba(0,0,0,0.12)] border border-white/5"
                            : "text-zinc-400 group-hover/nav:text-zinc-300"
                        )}
                      >
                        <item.icon className={cn("h-[18px] w-[18px]", isActive ? "opacity-100" : "opacity-80")} />
                      </div>
                      
                      <span
                        className={cn(
                          "truncate transition-all duration-200 ease-out",
                          isExpanded 
                            ? "opacity-100 translate-x-0 w-[120px] ml-1" 
                            : "md:opacity-0 md:-translate-x-2 md:w-0 md:ml-0 overflow-hidden"
                        )}
                      >
                        {item.name}
                      </span>
                    </>
                  )}
                </NavLink>
              </TooltipTrigger>
              {!isExpanded && (
                <TooltipContent side="right" sideOffset={14} className="bg-zinc-800 text-zinc-200 border-zinc-700/60 shadow-lg font-medium text-xs px-2.5 py-1.5 rounded-md">
                  {item.name}
                </TooltipContent>
              )}
            </Tooltip>
          ))}
        </nav>

        {/* User Profile & Actions Section */}
        <div className="p-3 shrink-0 mb-2 mt-auto">
          
          <Tooltip delayDuration={150}>
            <TooltipTrigger asChild>
              <div className={cn(
                "flex transition-all duration-200 ease-out rounded-[10px]",
                isExpanded
                  ? "items-center gap-3 px-2 py-2.5"
                  : "md:justify-center md:items-center md:p-2"
              )}>
                <div className={cn(
                    "flex items-center justify-center rounded-[8px] bg-zinc-800 text-zinc-300 font-medium transition-all duration-200 shrink-0 border border-zinc-700/50",
                    isExpanded ? "h-[34px] w-[34px] text-xs" : "h-[34px] w-[34px] text-[11px]"
                  )}>
                    {user?.address?.slice(2, 4).toUpperCase() || 'BV'}
                </div>
                
                <div
                  className={cn(
                    "flex-1 min-w-0 text-left transition-all duration-200 ease-out",
                    isExpanded 
                      ? "opacity-100 translate-x-0" 
                      : "md:opacity-0 md:-translate-x-2 md:w-0 overflow-hidden"
                  )}
                >
                  <p className="text-[13px] font-medium text-zinc-300 truncate leading-none mb-1.5">
                    {user?.address ? `${user.address.slice(0, 6)}...${user.address.slice(-4)}` : 'Guest'}
                  </p>
                  <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-zinc-600" />
                    <p className="text-[11px] text-zinc-500 font-medium truncate leading-none">Vault Active</p>
                  </div>
                </div>
              </div>
            </TooltipTrigger>
            {!isExpanded && (
              <TooltipContent side="right" sideOffset={14} className="bg-zinc-800 text-zinc-200 border-zinc-700/60 shadow-lg px-3 py-2 rounded-md">
                <p className="font-medium text-xs mb-1">
                  {user?.address ? `${user.address.slice(0, 6)}...${user.address.slice(-4)}` : 'Guest'}
                </p>
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-zinc-600" />
                  <p className="text-[10px] text-zinc-400 font-medium leading-none">Vault Active</p>
                </div>
              </TooltipContent>
            )}
          </Tooltip>

          {user && (
            <Tooltip delayDuration={150}>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "mt-1 w-full justify-start gap-3 rounded-[10px] px-2 py-4 text-[13px] font-medium text-zinc-500 transition-all duration-200 hover:bg-zinc-800/40 hover:text-zinc-300 transform hover:scale-[1.02]",
                    !isExpanded && "md:justify-center md:px-0"
                  )}
                  onClick={handleLogout}
                >
                  <div className="flex items-center justify-center shrink-0 w-[34px] h-[34px]">
                    <LogOut className="h-[18px] w-[18px]" />
                  </div>
                  
                  <span
                    className={cn(
                      "transition-all duration-200 ease-out",
                      isExpanded 
                        ? "opacity-100 translate-x-0" 
                        : "md:opacity-0 md:-translate-x-2 md:w-0 overflow-hidden"
                    )}
                  >
                    Logout
                  </span>
                </Button>
              </TooltipTrigger>
              {!isExpanded && (
                <TooltipContent side="right" sideOffset={14} className="bg-zinc-800 text-zinc-300 border-zinc-700/60 shadow-lg font-medium text-xs px-2.5 py-1.5 rounded-md">
                  Logout
                </TooltipContent>
              )}
            </Tooltip>
          )}

        </div>
      </aside>
    </TooltipProvider>
  );
}
