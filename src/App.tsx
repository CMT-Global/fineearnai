import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { GlobalErrorBoundary } from "@/components/shared/GlobalErrorBoundary";
import { AdminRoute } from "@/components/admin/AdminRoute";
import { ProtectedRoute } from "@/components/shared/ProtectedRoute";
import { AdminModeProvider, useAdminMode } from "@/contexts/AdminModeContext";
import { CurrencyProvider } from "@/contexts/CurrencyContext";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { useEffect, lazy, Suspense } from "react";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";

// Eager-loaded critical routes
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Dashboard from "./pages/Dashboard";

// Lazy-loaded user routes
const Wallet = lazy(() => import("./pages/Wallet"));
const Transactions = lazy(() => import("./pages/Transactions"));
const MembershipPlans = lazy(() => import("./pages/MembershipPlans"));
const Tasks = lazy(() => import("./pages/Tasks"));
const TaskDetail = lazy(() => import("./pages/TaskDetail"));
const Referrals = lazy(() => import("./pages/Referrals"));
const Settings = lazy(() => import("./pages/Settings"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const DepositResult = lazy(() => import("./pages/DepositResult"));
const NotFound = lazy(() => import("./pages/NotFound"));

// Lazy-loaded admin routes
const Admin = lazy(() => import("./pages/Admin"));
const AITasksGenerate = lazy(() => import("@/pages/admin/AITasksGenerate"));
const AITasksManage = lazy(() => import("@/pages/admin/AITasksManage"));
const Withdrawals = lazy(() => import("@/pages/admin/Withdrawals"));
const Users = lazy(() => import("@/pages/admin/Users"));
const UserDetail = lazy(() => import("@/pages/admin/UserDetail"));
const Deposits = lazy(() => import("@/pages/admin/Deposits"));
const AdminTransactions = lazy(() => import("@/pages/admin/Transactions"));
const PaymentSettings = lazy(() => import("@/pages/admin/PaymentSettings"));
const PlansManage = lazy(() => import("@/pages/admin/PlansManage"));
const ReferralSystemManage = lazy(() => import("@/pages/admin/ReferralSystemManage"));
const TaskAnalytics = lazy(() => import("@/pages/admin/TaskAnalytics"));
const BulkEmail = lazy(() => import("@/pages/admin/BulkEmail"));
const EmailTemplates = lazy(() => import("@/pages/admin/EmailTemplates"));
const EmailSettings = lazy(() => import("@/pages/admin/EmailSettings"));
const ScheduledEmails = lazy(() => import("@/pages/admin/ScheduledEmails"));
const LoginMessage = lazy(() => import("@/pages/admin/LoginMessage"));
const SecuritySettings = lazy(() => import("@/pages/admin/SecuritySettings"));
const DailyResetLogs = lazy(() => import("@/pages/admin/DailyResetLogs"));
const CPAYMonitoring = lazy(() => import("@/pages/admin/CPAYMonitoring"));
const CPAYReconciliation = lazy(() => import("@/pages/admin/CPAYReconciliation"));
const CPAYCheckouts = lazy(() => import("@/pages/admin/CPAYCheckouts"));
const CommissionAudit = lazy(() => import("@/pages/admin/CommissionAudit"));
const InfluencerInvites = lazy(() => import("@/pages/admin/InfluencerInvites"));
const UserInvites = lazy(() => import("@/pages/admin/UserInvites"));
const PartnerApplications = lazy(() => import("@/pages/admin/PartnerApplications"));
const Partners = lazy(() => import("@/pages/admin/Partners"));
const VoucherMonitoring = lazy(() => import("@/pages/admin/VoucherMonitoring"));
const BecomePartner = lazy(() => import("./pages/BecomePartner"));
const PartnerDashboard = lazy(() => import("./pages/PartnerDashboard"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes (data stays fresh)
      gcTime: 30 * 60 * 1000, // 30 minutes (cache time)
      refetchOnWindowFocus: false, // Don't refetch on tab switch
      retry: 1, // Retry failed requests once
    },
  },
});

/**
 * RoutesWrapper - Handles automatic admin mode switching based on route
 */
const RoutesWrapper = () => {
  const location = useLocation();
  const { isAdminMode, isTransitioning, enterAdminMode, exitAdminMode } = useAdminMode();
  const isAdminRoute = location.pathname.startsWith("/admin");

  // Auto-enter admin mode when navigating to /admin/*
  // Auto-exit admin mode when navigating away from /admin/*
  useEffect(() => {
    if (isAdminRoute && !isAdminMode) {
      enterAdminMode();
    } else if (!isAdminRoute && isAdminMode) {
      exitAdminMode();
    }
  }, [isAdminRoute, isAdminMode, enterAdminMode, exitAdminMode]);
  
  // Show loading state during transition
  if (isTransitioning) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="h-12 w-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-muted-foreground">
            {isAdminMode ? "Entering Admin Mode..." : "Returning to Main App..."}
          </p>
        </div>
      </div>
    );
  }

  const PageLoader = () => (
    <div className="min-h-screen bg-background flex flex-col lg:flex-row">
      {/* Sidebar skeleton - mimics actual sidebar structure (desktop only) */}
      <aside className="hidden lg:flex w-64 bg-[hsl(var(--sidebar-bg))] flex-col border-r border-[hsl(var(--sidebar-border))]">
        {/* Logo skeleton */}
        <div className="p-6 border-b border-[hsl(var(--sidebar-border))]">
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 bg-muted animate-pulse rounded" />
            <div className="h-6 w-24 bg-muted animate-pulse rounded" />
          </div>
        </div>
        
        {/* User card skeleton */}
        <div className="p-4 border-b border-[hsl(var(--sidebar-border))]">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-muted animate-pulse" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-20 bg-muted animate-pulse rounded" />
              <div className="h-3 w-16 bg-muted animate-pulse rounded" />
            </div>
          </div>
        </div>
        
        {/* Currency selector skeleton */}
        <div className="p-4 border-b border-[hsl(var(--sidebar-border))]">
          <div className="h-9 bg-muted animate-pulse rounded" />
        </div>
        
        {/* Navigation items skeleton */}
        <div className="flex-1 p-4 space-y-2">
          {[...Array(7)].map((_, i) => (
            <div key={i} className="h-10 bg-muted/50 animate-pulse rounded-lg" />
          ))}
        </div>
        
        {/* Logout button skeleton */}
        <div className="p-4 border-t border-[hsl(var(--sidebar-border))]">
          <div className="h-10 bg-muted animate-pulse rounded-lg" />
        </div>
      </aside>
      
      {/* Mobile header skeleton (mobile only) */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-card border-b px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 bg-muted animate-pulse rounded" />
          <div className="h-5 w-32 bg-muted animate-pulse rounded" />
        </div>
        <div className="flex items-center gap-2">
          <div className="h-8 w-16 bg-muted animate-pulse rounded" />
          <div className="h-8 w-8 bg-muted animate-pulse rounded-full" />
        </div>
      </div>
      
      {/* Main content loading */}
      <main className="flex-1 flex items-center justify-center lg:mt-0 mt-16 pb-24 lg:pb-0">
        <LoadingSpinner size="lg" text="Loading page..." />
      </main>
    </div>
  );

  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/wallet" element={<Wallet />} />
        <Route path="/transactions" element={<Transactions />} />
        <Route path="/plans" element={
          <ProtectedRoute>
            <MembershipPlans />
          </ProtectedRoute>
        } />
        <Route path="/tasks" element={<Tasks />} />
        <Route path="/tasks/:userTaskId" element={<TaskDetail />} />
        <Route path="/referrals" element={<Referrals />} />
        <Route path="/become-partner" element={<BecomePartner />} />
        <Route path="/partner/dashboard" element={<PartnerDashboard />} />
        <Route path="/deposit-result" element={<DepositResult />} />
      
      {/* Admin Routes - Protected with AdminRoute guard and wrapped in AdminLayout */}
      <Route
        path="/admin"
        element={
          <AdminRoute>
            <AdminLayout>
              <Admin />
            </AdminLayout>
          </AdminRoute>
        }
      />
      <Route
        path="/admin/tasks/generate"
        element={
          <AdminRoute>
            <AdminLayout>
              <AITasksGenerate />
            </AdminLayout>
          </AdminRoute>
        }
      />
      <Route
        path="/admin/tasks/manage"
        element={
          <AdminRoute>
            <AdminLayout>
              <AITasksManage />
            </AdminLayout>
          </AdminRoute>
        }
      />
      <Route
        path="/admin/withdrawals"
        element={
          <AdminRoute>
            <AdminLayout>
              <Withdrawals />
            </AdminLayout>
          </AdminRoute>
        }
      />
      <Route
        path="/admin/users"
        element={
          <AdminRoute>
            <AdminLayout>
              <Users />
            </AdminLayout>
          </AdminRoute>
        }
      />
      <Route
        path="/admin/users/:userId"
        element={
          <AdminRoute>
            <AdminLayout>
              <UserDetail />
            </AdminLayout>
          </AdminRoute>
        }
      />
      <Route
        path="/admin/deposits"
        element={
          <AdminRoute>
            <AdminLayout>
              <Deposits />
            </AdminLayout>
          </AdminRoute>
        }
      />
      <Route
        path="/admin/transactions"
        element={
          <AdminRoute>
            <AdminLayout>
              <AdminTransactions />
            </AdminLayout>
          </AdminRoute>
        }
      />
      <Route
        path="/admin/settings/payments"
        element={
          <AdminRoute>
            <AdminLayout>
              <PaymentSettings />
            </AdminLayout>
          </AdminRoute>
        }
      />
      <Route
        path="/admin/monitoring/cpay"
        element={
          <AdminRoute>
            <AdminLayout>
              <CPAYMonitoring />
            </AdminLayout>
          </AdminRoute>
        }
      />
      <Route
        path="/admin/monitoring/cpay-reconciliation"
        element={
          <AdminRoute>
            <AdminLayout>
              <CPAYReconciliation />
            </AdminLayout>
          </AdminRoute>
        }
      />
      <Route
        path="/admin/settings/cpay-checkouts"
        element={
          <AdminRoute>
            <AdminLayout>
              <CPAYCheckouts />
            </AdminLayout>
          </AdminRoute>
        }
      />
      <Route
        path="/admin/plans/manage"
        element={
          <AdminRoute>
            <AdminLayout>
              <PlansManage />
            </AdminLayout>
          </AdminRoute>
        }
      />
      <Route
        path="/admin/referrals/manage"
        element={
          <AdminRoute>
            <AdminLayout>
              <ReferralSystemManage />
            </AdminLayout>
          </AdminRoute>
        }
      />
      <Route
        path="/admin/analytics/tasks"
        element={
          <AdminRoute>
            <AdminLayout>
              <TaskAnalytics />
            </AdminLayout>
          </AdminRoute>
        }
      />
      <Route
        path="/admin/communications/email"
        element={
          <AdminRoute>
            <AdminLayout>
              <BulkEmail />
            </AdminLayout>
          </AdminRoute>
        }
      />
      <Route
        path="/admin/communications/influencer-invites"
        element={
          <AdminRoute>
            <AdminLayout>
              <InfluencerInvites />
            </AdminLayout>
          </AdminRoute>
        }
      />
      <Route
        path="/admin/communications/user-invites"
        element={
          <AdminRoute>
            <AdminLayout>
              <UserInvites />
            </AdminLayout>
          </AdminRoute>
        }
      />
      <Route
        path="/admin/communications/templates"
        element={
          <AdminRoute>
            <AdminLayout>
              <EmailTemplates />
            </AdminLayout>
          </AdminRoute>
        }
      />
      <Route
        path="/admin/communications/email-settings"
        element={
          <AdminRoute>
            <AdminLayout>
              <EmailSettings />
            </AdminLayout>
          </AdminRoute>
        }
      />
      <Route
        path="/admin/communications/scheduled"
        element={
          <AdminRoute>
            <AdminLayout>
              <ScheduledEmails />
            </AdminLayout>
          </AdminRoute>
        }
      />
      <Route
        path="/admin/communications/login-message"
        element={
          <AdminRoute>
            <AdminLayout>
              <LoginMessage />
            </AdminLayout>
          </AdminRoute>
        }
      />
      <Route
        path="/admin/security-settings"
        element={
          <AdminRoute>
            <AdminLayout>
              <SecuritySettings />
            </AdminLayout>
          </AdminRoute>
        }
      />
      <Route
        path="/admin/monitoring/daily-reset-logs"
        element={
          <AdminRoute>
            <AdminLayout>
              <DailyResetLogs />
            </AdminLayout>
          </AdminRoute>
        }
      />
      <Route
        path="/admin/monitoring/commission-audit"
        element={
          <AdminRoute>
            <AdminLayout>
              <CommissionAudit />
            </AdminLayout>
          </AdminRoute>
        }
      />
      <Route
        path="/admin/partners/applications"
        element={
          <AdminRoute>
            <AdminLayout>
              <PartnerApplications />
            </AdminLayout>
          </AdminRoute>
        }
      />
      <Route
        path="/admin/partners"
        element={
          <AdminRoute>
            <AdminLayout>
              <Partners />
            </AdminLayout>
          </AdminRoute>
        }
      />
      <Route
        path="/admin/partners/vouchers"
        element={
          <AdminRoute>
            <AdminLayout>
              <VoucherMonitoring />
            </AdminLayout>
          </AdminRoute>
        }
      />
      
      <Route path="/settings" element={
        <ProtectedRoute>
          <Settings />
        </ProtectedRoute>
      } />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
      <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
};

const App = () => (
  <GlobalErrorBoundary>
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <AdminModeProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner position="top-right" />
            <CurrencyProvider>
              <RoutesWrapper />
            </CurrencyProvider>
          </TooltipProvider>
        </AdminModeProvider>
      </QueryClientProvider>
    </BrowserRouter>
  </GlobalErrorBoundary>
);

export default App;
