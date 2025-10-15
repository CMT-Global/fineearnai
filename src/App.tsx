import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation, useNavigate } from "react-router-dom";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";
import { AdminRoute } from "@/components/admin/AdminRoute";
import { AdminModeProvider, useAdminMode } from "@/contexts/AdminModeContext";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { useEffect } from "react";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Dashboard from "./pages/Dashboard";
import Wallet from "./pages/Wallet";
import Transactions from "./pages/Transactions";
import MembershipPlans from "./pages/MembershipPlans";
import Tasks from "./pages/Tasks";
import TaskDetail from "./pages/TaskDetail";
import Referrals from "./pages/Referrals";
import Admin from "./pages/Admin";
import AITasksGenerate from "@/pages/admin/AITasksGenerate";
import AITasksManage from "@/pages/admin/AITasksManage";
import Withdrawals from "@/pages/admin/Withdrawals";
import Users from "@/pages/admin/Users";
import UserDetail from "@/pages/admin/UserDetail";
import Deposits from "@/pages/admin/Deposits";
import AdminTransactions from "@/pages/admin/Transactions";
import PaymentSettings from "@/pages/admin/PaymentSettings";
import PlansManage from "@/pages/admin/PlansManage";
import TaskAnalytics from "@/pages/admin/TaskAnalytics";
import BulkEmail from "@/pages/admin/BulkEmail";
import EmailTemplates from "@/pages/admin/EmailTemplates";
import Settings from "./pages/Settings";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  },
});

/**
 * RoutesWrapper - Handles automatic admin mode switching based on route
 */
const RoutesWrapper = () => {
  const location = useLocation();
  const { isAdminMode, enterAdminMode, exitAdminMode } = useAdminMode();
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

  return (
    <Routes>
      <Route path="/" element={<Login />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/wallet" element={<Wallet />} />
      <Route path="/transactions" element={<Transactions />} />
      <Route path="/plans" element={<MembershipPlans />} />
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
      
      <Route path="/settings" element={<Settings />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <AdminModeProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner position="top-right" />
          <BrowserRouter>
            <RoutesWrapper />
          </BrowserRouter>
        </TooltipProvider>
      </AdminModeProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
