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
const SecuritySettings = lazy(() => import("@/pages/admin/SecuritySettings"));
const DailyResetLogs = lazy(() => import("@/pages/admin/DailyResetLogs"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30000, // 30 seconds (data stays fresh)
      gcTime: 5 * 60 * 1000, // 5 minutes (cache time)
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
    <div className="min-h-screen bg-background flex items-center justify-center">
      <LoadingSpinner size="lg" />
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
