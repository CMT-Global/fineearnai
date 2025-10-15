import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";
import { AdminRoute } from "@/components/admin/AdminRoute";
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

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner position="top-right" />
        <BrowserRouter>
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
            
            {/* Admin Routes - Protected with AdminRoute guard */}
            <Route path="/admin" element={<AdminRoute><Admin /></AdminRoute>} />
            <Route path="/admin/tasks/generate" element={<AdminRoute><AITasksGenerate /></AdminRoute>} />
            <Route path="/admin/tasks/manage" element={<AdminRoute><AITasksManage /></AdminRoute>} />
            <Route path="/admin/withdrawals" element={<AdminRoute><Withdrawals /></AdminRoute>} />
            <Route path="/admin/users" element={<AdminRoute><Users /></AdminRoute>} />
            <Route path="/admin/users/:userId" element={<AdminRoute><UserDetail /></AdminRoute>} />
            <Route path="/admin/deposits" element={<AdminRoute><Deposits /></AdminRoute>} />
            <Route path="/admin/transactions" element={<AdminRoute><AdminTransactions /></AdminRoute>} />
            <Route path="/admin/settings/payments" element={<AdminRoute><PaymentSettings /></AdminRoute>} />
            <Route path="/admin/plans/manage" element={<AdminRoute><PlansManage /></AdminRoute>} />
            <Route path="/admin/analytics/tasks" element={<AdminRoute><TaskAnalytics /></AdminRoute>} />
            <Route path="/admin/communications/email" element={<AdminRoute><BulkEmail /></AdminRoute>} />
            <Route path="/admin/communications/templates" element={<AdminRoute><EmailTemplates /></AdminRoute>} />
            
            <Route path="/settings" element={<Settings />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
