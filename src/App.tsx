import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Dashboard from "./pages/Dashboard";
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
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/transactions" element={<Transactions />} />
            <Route path="/plans" element={<MembershipPlans />} />
            <Route path="/tasks" element={<Tasks />} />
            <Route path="/tasks/:userTaskId" element={<TaskDetail />} />
            <Route path="/referrals" element={<Referrals />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/admin/tasks/generate" element={<AITasksGenerate />} />
          <Route path="/admin/tasks/manage" element={<AITasksManage />} />
          <Route path="/admin/withdrawals" element={<Withdrawals />} />
          <Route path="/admin/users" element={<Users />} />
          <Route path="/admin/users/:userId" element={<UserDetail />} />
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
