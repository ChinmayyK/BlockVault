import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster as HotToaster } from "react-hot-toast";
import { MainLayout } from "./components/layout/MainLayout";
import { ErrorBoundary } from "./components/ErrorBoundary";

// Lazy load pages for code splitting
const IndexPage = lazy(() => import("./pages/IndexPage"));
const LearnMorePage = lazy(() => import("./pages/LearnMorePage"));
const LoginPage = lazy(() =>
  import("./components/auth/LoginPage").then((mod) => ({ default: mod.LoginPage }))
);
const DashboardPage = lazy(() => import("./pages/DashboardPage"));
const LegalPage = lazy(() => import("./pages/LegalPage"));
const CasesPage = lazy(() => import("./pages/CasesPage"));
const BlockchainPage = lazy(() => import("./pages/BlockchainPage"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));
const NotFoundPage = lazy(() => import("./pages/NotFoundPage"));

// Import BlockVault contexts
import { AuthProvider } from "@/contexts/AuthContext";
import { FileProvider } from "@/contexts/FileContext";
import { RBACProvider } from "@/contexts/RBACContext";
import { CaseProvider } from "@/contexts/CaseContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";

// Loading component
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-screen bg-background">
    <div className="flex flex-col items-center gap-4">
      <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      <p className="text-sm text-muted-foreground">Loading...</p>
    </div>
  </div>
);

// Optimized query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <FileProvider>
            <RBACProvider>
              <CaseProvider>
                <TooltipProvider>
                <Toaster />
                <Sonner />
                <HotToaster
                  position="top-right"
                  toastOptions={{
                    duration: 4000,
                    style: {
                      background: '#0a0a0a',
                      color: '#ffffff',
                      border: '1px solid #1f6feb',
                    },
                    success: {
                      iconTheme: {
                        primary: '#22C55E',
                        secondary: '#ffffff',
                      },
                    },
                    error: {
                      iconTheme: {
                        primary: '#EF4444',
                        secondary: '#ffffff',
                      },
                    },
                  }}
                />
                <BrowserRouter>
                  <Suspense fallback={<PageLoader />}>
                    <Routes>
                      <Route path="/" element={<IndexPage />} />
                      <Route path="/login" element={<LoginPage />} />
                      <Route path="/learn-more" element={<LearnMorePage />} />
                      <Route 
                        path="/files" 
                        element={
                          <ProtectedRoute>
                            <MainLayout><DashboardPage /></MainLayout>
                          </ProtectedRoute>
                        } 
                      />
                      <Route 
                        path="/dashboard" 
                        element={
                          <ProtectedRoute>
                            <MainLayout><DashboardPage /></MainLayout>
                          </ProtectedRoute>
                        } 
                      />
                      <Route 
                        path="/legal" 
                        element={
                          <ProtectedRoute>
                            <MainLayout><LegalPage /></MainLayout>
                          </ProtectedRoute>
                        } 
                      />
                      <Route 
                        path="/cases" 
                        element={
                          <ProtectedRoute>
                            <MainLayout><CasesPage /></MainLayout>
                          </ProtectedRoute>
                        } 
                      />
                      <Route 
                        path="/blockchain" 
                        element={
                          <ProtectedRoute>
                            <MainLayout><BlockchainPage /></MainLayout>
                          </ProtectedRoute>
                        } 
                      />
                      <Route 
                        path="/settings" 
                        element={
                          <ProtectedRoute>
                            <MainLayout><SettingsPage /></MainLayout>
                          </ProtectedRoute>
                        } 
                      />
                      <Route path="*" element={<NotFoundPage />} />
                    </Routes>
                  </Suspense>
                </BrowserRouter>
                </TooltipProvider>
              </CaseProvider>
            </RBACProvider>
          </FileProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
