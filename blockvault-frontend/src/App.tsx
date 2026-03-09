import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster as HotToaster } from "react-hot-toast";
import { MainLayout } from "./components/layout/MainLayout";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { useGlobalShortcuts } from "./utils/keyboardShortcuts";

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
const RedactPage = lazy(() => import("./pages/RedactPage"));
const RecoverFilePage = lazy(() => import("./pages/RecoverFile"));
const AdminUsersPage = lazy(() => import("./pages/admin/AdminUsers"));
const AdminAuditPage = lazy(() => import("./pages/admin/AdminAudit"));
const OrganizationsPage = lazy(() => import("./pages/Organizations"));
const WorkspaceDashboardPage = lazy(() => import("./pages/WorkspaceDashboard"));

// Import BlockVault contexts
import { AuthProvider } from "@/contexts/AuthContext";
import { FileProvider } from "@/contexts/FileContext";
import { RBACProvider } from "@/contexts/RBACContext";
import { CaseProvider } from "@/contexts/CaseContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { LoadingProvider } from "@/contexts/LoadingContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { GlobalLoader } from "@/components/ui/GlobalLoader";
import { AxiosLoadingInterceptor } from "@/components/ui/AxiosLoadingInterceptor";
import { RouteProgress } from "@/components/ui/RouteProgress";
import { SecureLoader } from "@/components/ui/SecureLoader";

// Loading component
// Loading component
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-screen bg-background">
    <div className="flex flex-col items-center gap-4">
      <SecureLoader size={56} />
      <p className="text-sm text-muted-foreground animate-pulse">Loading secure environment...</p>
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

const App = () => {
  useGlobalShortcuts();
  
  return (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <LoadingProvider>
          <GlobalLoader />
          <AxiosLoadingInterceptor />
          <BrowserRouter future={{ v7_relativeSplatPath: true }}>
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
                      <RouteProgress />
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
                          <Route
                            path="/redact/:fileId"
                            element={
                              <ProtectedRoute>
                                <MainLayout><RedactPage /></MainLayout>
                              </ProtectedRoute>
                            }
                          />
                          <Route
                            path="/recover-file"
                            element={
                              <ProtectedRoute>
                                <MainLayout><RecoverFilePage /></MainLayout>
                              </ProtectedRoute>
                            }
                          />
                          <Route
                            path="/admin/users"
                            element={
                              <ProtectedRoute>
                                <MainLayout><AdminUsersPage /></MainLayout>
                              </ProtectedRoute>
                            }
                          />
                          <Route
                            path="/admin/audit"
                            element={
                              <ProtectedRoute>
                                <MainLayout><AdminAuditPage /></MainLayout>
                              </ProtectedRoute>
                            }
                          />
                          <Route
                            path="/orgs"
                            element={
                              <ProtectedRoute>
                                <MainLayout><OrganizationsPage /></MainLayout>
                              </ProtectedRoute>
                            }
                          />
                          <Route
                            path="/workspaces/:id"
                            element={
                              <ProtectedRoute>
                                <MainLayout><WorkspaceDashboardPage /></MainLayout>
                              </ProtectedRoute>
                            }
                          />
                          <Route path="*" element={<NotFoundPage />} />
                        </Routes>
                      </Suspense>
                    </TooltipProvider>
                  </CaseProvider>
                </RBACProvider>
              </FileProvider>
            </AuthProvider>
          </BrowserRouter>
        </LoadingProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </ErrorBoundary>
  );
};

export default App;
