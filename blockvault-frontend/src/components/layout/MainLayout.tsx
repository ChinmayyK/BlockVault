import { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";

interface MainLayoutProps {
  children: ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  return (
    <div className="min-h-screen w-full bg-background">
      <Sidebar />
      <TopBar />
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
