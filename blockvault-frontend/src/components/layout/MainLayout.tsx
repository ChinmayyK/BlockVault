import { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { useAuth } from "@/contexts/AuthContext";

interface MainLayoutProps {
  children: ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  const { user } = useAuth();
  const isDemoMode = user?.address === 'demo_user';

  return (
    <div className="min-h-screen w-full bg-background">
      <Sidebar />
      <TopBar />
      {isDemoMode && (
        <div className="fixed top-0 left-0 right-0 z-[60] flex items-center justify-center pointer-events-none">
          <div className="mt-1 pointer-events-auto rounded-full border border-amber-500/40 bg-amber-950/80 px-4 py-1 text-xs font-medium text-amber-300 backdrop-blur-sm shadow-lg shadow-amber-900/20">
            <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
            Demo Mode — Simulated Environment
          </div>
        </div>
      )}
      <main
        className="pt-16 transition-[padding-left] duration-200"
        data-layout="content"
      >
        <div className="container mx-auto flex min-h-[calc(100vh-6rem)] flex-col gap-10 p-6">
          <div className="flex-1">{children}</div>
          <div className="mt-auto flex justify-center pb-4">
            <a
              href="https://madewithloveinindia.org"
              target="_blank"
              rel="noreferrer noopener"
              className="group inline-flex items-center gap-2 rounded-full border border-border bg-card/80 px-5 py-2.5 text-sm font-medium text-muted-foreground shadow-lg shadow-black/10 backdrop-blur-sm transition-all hover:-translate-y-0.5 hover:border-primary/60 hover:text-foreground hover:shadow-primary/20 dark:bg-slate-900/80 dark:text-slate-200"
            >
              <span className="uppercase tracking-[0.24em] text-[0.65rem] text-muted-foreground">
                Made With
              </span>
              <span
                className="text-lg leading-none text-rose-500 transition-transform group-hover:scale-110 group-hover:text-rose-400"
                role="img"
                aria-label="Love"
              >
                ♥
              </span>
              <span className="text-sm font-semibold text-foreground">
                in India
              </span>
            </a>
          </div>
        </div>
      </main>
    </div>
  );
}
