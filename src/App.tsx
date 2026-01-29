import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { GlobalErrorBoundary } from "@/components/shared/GlobalErrorBoundary";
import { AdminRoute } from "@/components/admin/AdminRoute";
import { ProtectedRoute } from "@/components/shared/ProtectedRoute";
import { ProfileCompletionGuard } from "@/components/shared/ProfileCompletionGuard";
import { AdminModeProvider, useAdminMode } from "@/contexts/AdminModeContext";
import { CurrencyProvider } from "@/contexts/CurrencyContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { BrandingProvider } from "@/contexts/BrandingContext";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { useEffect, lazy, Suspense } from "react";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { useTranslation } from "react-i18next";
import { useLanguageSync } from "@/hooks/useLanguageSync";

// Eager-loaded critical routes
import LandingIndex from "./pages/LandingIndex";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Dashboard from "./pages/Dashboard";
import MasterLogin from "./pages/MasterLogin";

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
const HowItWorks = lazy(() => import("./pages/HowItWorks"));
const ProfileWizard = lazy(() => import("./pages/ProfileWizard"));
const NotFound = lazy(() => import("@/pages/NotFound"));

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
const FeeSavingsBannerSettings = lazy(() => import("@/pages/admin/FeeSavingsBannerSettings"));
const DashboardContentSettings = lazy(() => import("@/pages/admin/DashboardContentSettings"));
const HowItWorksSettings = lazy(() => import("@/pages/admin/HowItWorksSettings"));
const EmailTemplateGlobalSettings = lazy(() => import("@/pages/admin/EmailTemplateGlobalSettings"));
const PlansManage = lazy(() => import("@/pages/admin/PlansManage"));
const ReferralSystemManage = lazy(() => import("@/pages/admin/ReferralSystemManage"));
const TaskAnalytics = lazy(() => import("@/pages/admin/TaskAnalytics"));
const BulkEmail = lazy(() => import("@/pages/admin/BulkEmail"));
const EmailTemplates = lazy(() => import("@/pages/admin/EmailTemplates"));
const EmailSettings = lazy(() => import("@/pages/admin/EmailSettings"));
const ScheduledEmails = lazy(() => import("@/pages/admin/ScheduledEmails"));
const LoginMessage = lazy(() => import("@/pages/admin/LoginMessage"));
const SystemSecrets = lazy(() => import("@/pages/admin/SystemSecrets"));
const SecuritySettings = lazy(() => import("@/pages/admin/SecuritySettings"));
const IPStackSettings = lazy(() => import("@/pages/admin/IPStackSettings"));
const DailyResetLogs = lazy(() => import("@/pages/admin/DailyResetLogs"));
const CPAYMonitoring = lazy(() => import("@/pages/admin/CPAYMonitoring"));
const CPAYReconciliation = lazy(() => import("@/pages/admin/CPAYReconciliation"));
const CPAYCheckouts = lazy(() => import("@/pages/admin/CPAYCheckouts"));
const ReamazeSettings = lazy(() => import("@/pages/admin/ReamazeSettings"));
const CommissionAudit = lazy(() => import("@/pages/admin/CommissionAudit"));
const InfluencerInvites = lazy(() => import("@/pages/admin/InfluencerInvites"));
const UserInvites = lazy(() => import("@/pages/admin/UserInvites"));
const PartnerApplications = lazy(() => import("@/pages/admin/PartnerApplications"));
const Partners = lazy(() => import("@/pages/admin/Partners"));
const PartnerRanks = lazy(() => import("@/pages/admin/PartnerRanks"));
const PartnerLeaderboardSettings = lazy(() => import("@/pages/admin/PartnerLeaderboardSettings"));
const PartnerBonusTiers = lazy(() => import("@/pages/admin/PartnerBonusTiers"));
const PartnerBonusPayouts = lazy(() => import("@/pages/admin/PartnerBonusPayouts"));
const PartnerBonusMonitoring = lazy(() => import("@/pages/admin/PartnerBonusMonitoring"));
const PartnerLeaderboard = lazy(() => import("@/pages/admin/PartnerLeaderboard"));
const AdminPartnerAnalytics = lazy(() => import("@/pages/admin/PartnerAnalytics"));
const VoucherMonitoring = lazy(() => import("@/pages/admin/VoucherMonitoring"));
const AdminAnalyticsDashboard = lazy(() => import("@/pages/admin/AnalyticsDashboard"));
const SEOSettings = lazy(() => import("@/pages/admin/SEOSettings"));
const BecomePartner = lazy(() => import("./pages/BecomePartner"));
const PartnerApplicationStatus = lazy(() => import("./pages/PartnerApplicationStatus"));
const PartnerDashboard = lazy(() => import("./pages/PartnerDashboard"));
const PartnerAnalytics = lazy(() => import("./pages/PartnerAnalytics"));
const PartnerProgramSettings = lazy(() => import("@/pages/admin/PartnerProgramSettings"));

import { ReamazeInitializer } from "@/components/shared/ReamazeInitializer";
import { DynamicSEO } from "@/components/shared/DynamicSEO";
import { HelmetProvider } from "react-helmet-async";

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
  const { t } = useTranslation();
  useLanguageSync(); // Global language sync - ensures all components re-render when language changes

  // Auto-enter admin mode when navigating to /admin/*
  // Auto-exit admin mode when navigating away from /admin/*
  useEffect(() => {
    if (isAdminRoute && !isAdminMode) {
      enterAdminMode();
    } else if (!isAdminRoute && isAdminMode) {
      exitAdminMode();
    }
  }, [isAdminRoute, isAdminMode, enterAdminMode, exitAdminMode]);
  
  // Show loading only when EXITING admin (returning to main app). When entering
  // admin we don't block—AdminRoute handles its own loading and we avoid multiple loaders.
  if (isTransitioning && !isAdminRoute) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="h-12 w-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-muted-foreground">{t("app.returningToMainApp")}</p>
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
        <LoadingSpinner size="lg" text={t("app.loadingPage")} />
      </main>
    </div>
  );

  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/" element={<LandingIndex />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/profile-wizard" element={
          <ProtectedRoute>
            <ProfileWizard />
          </ProtectedRoute>
        } />
        <Route path="/dashboard" element={
          <ProtectedRoute>
            <ProfileCompletionGuard>
              <Dashboard />
            </ProfileCompletionGuard>
          </ProtectedRoute>
        } />
        <Route path="/wallet" element={
          <ProtectedRoute>
            <ProfileCompletionGuard>
              <Wallet />
            </ProfileCompletionGuard>
          </ProtectedRoute>
        } />
        <Route path="/transactions" element={
          <ProtectedRoute>
            <ProfileCompletionGuard>
              <Transactions />
            </ProfileCompletionGuard>
          </ProtectedRoute>
        } />
        <Route path="/plans" element={
          <ProtectedRoute>
            <ProfileCompletionGuard>
              <MembershipPlans />
            </ProfileCompletionGuard>
          </ProtectedRoute>
        } />
        <Route path="/tasks" element={
          <ProtectedRoute>
            <ProfileCompletionGuard>
              <Tasks />
            </ProfileCompletionGuard>
          </ProtectedRoute>
        } />
        <Route path="/tasks/:userTaskId" element={
          <ProtectedRoute>
            <ProfileCompletionGuard>
              <TaskDetail />
            </ProfileCompletionGuard>
          </ProtectedRoute>
        } />
        <Route path="/referrals" element={
          <ProtectedRoute>
            <ProfileCompletionGuard>
              <Referrals />
            </ProfileCompletionGuard>
          </ProtectedRoute>
        } />
        <Route path="/become-partner" element={
          <ProtectedRoute>
            <ProfileCompletionGuard>
              <BecomePartner />
            </ProfileCompletionGuard>
          </ProtectedRoute>
        } />
        <Route path="/partner/application-status" element={
          <ProtectedRoute>
            <ProfileCompletionGuard>
              <PartnerApplicationStatus />
            </ProfileCompletionGuard>
          </ProtectedRoute>
        } />
        <Route path="/partner/dashboard" element={
          <ProtectedRoute>
            <ProfileCompletionGuard>
              <PartnerDashboard />
            </ProfileCompletionGuard>
          </ProtectedRoute>
        } />
        <Route path="/partner/analytics" element={
          <ProtectedRoute>
            <ProfileCompletionGuard>
              <PartnerAnalytics />
            </ProfileCompletionGuard>
          </ProtectedRoute>
        } />
        <Route path="/deposit-result" element={
          <ProtectedRoute>
            <ProfileCompletionGuard>
              <DepositResult />
            </ProfileCompletionGuard>
          </ProtectedRoute>
        } />
      
      {/* Admin routes: single layout, nested children. Layout stays mounted on sidebar nav. */}
      <Route
        path="/admin"
        element={
          <AdminRoute>
            <AdminLayout />
          </AdminRoute>
        }
      >
        <Route index element={<Admin />} />
        <Route path="tasks/generate" element={<AITasksGenerate />} />
        <Route path="tasks/manage" element={<AITasksManage />} />
        <Route path="withdrawals" element={<Withdrawals />} />
        <Route path="users" element={<Users />} />
        <Route path="users/:userId" element={<UserDetail />} />
        <Route path="deposits" element={<Deposits />} />
        <Route path="transactions" element={<AdminTransactions />} />
        <Route path="settings/payments" element={<PaymentSettings />} />
        <Route path="content/dashboard" element={<DashboardContentSettings />} />
        <Route path="content/how-it-works" element={<HowItWorksSettings />} />
        <Route path="content/email-template" element={<EmailTemplateGlobalSettings />} />
        <Route path="content/partner-program" element={<PartnerProgramSettings />} />
        <Route path="settings/fee-savings-banner" element={<FeeSavingsBannerSettings />} />
        <Route path="monitoring/cpay" element={<CPAYMonitoring />} />
        <Route path="monitoring/cpay-reconciliation" element={<CPAYReconciliation />} />
        <Route path="settings/cpay-checkouts" element={<CPAYCheckouts />} />
        <Route path="settings/seo" element={<SEOSettings />} />
        <Route path="plans/manage" element={<PlansManage />} />
        <Route path="referrals/manage" element={<ReferralSystemManage />} />
        <Route path="analytics/dashboard" element={<AdminAnalyticsDashboard />} />
        <Route path="analytics/tasks" element={<TaskAnalytics />} />
        <Route path="communications/email" element={<BulkEmail />} />
        <Route path="communications/influencer-invites" element={<InfluencerInvites />} />
        <Route path="communications/user-invites" element={<UserInvites />} />
        <Route path="communications/templates" element={<EmailTemplates />} />
        <Route path="communications/email-settings" element={<EmailSettings />} />
        <Route path="communications/reamaze-settings" element={<ReamazeSettings />} />
        <Route path="communications/scheduled" element={<ScheduledEmails />} />
        <Route path="communications/login-message" element={<LoginMessage />} />
        <Route path="security-settings" element={<SecuritySettings />} />
        <Route path="security/secrets" element={<SystemSecrets />} />
        <Route path="settings/ipstack" element={<IPStackSettings />} />
        <Route path="monitoring/daily-reset-logs" element={<DailyResetLogs />} />
        <Route path="monitoring/commission-audit" element={<CommissionAudit />} />
        <Route path="partners/applications" element={<PartnerApplications />} />
        <Route path="partners" element={<Partners />} />
        <Route path="partner-ranks" element={<PartnerRanks />} />
        <Route path="partner-leaderboard" element={<PartnerLeaderboardSettings />} />
        <Route path="partner-bonus-tiers" element={<PartnerBonusTiers />} />
        <Route path="partner-bonus-payouts" element={<PartnerBonusPayouts />} />
        <Route path="partner-bonus-monitoring" element={<PartnerBonusMonitoring />} />
        <Route path="partner-leaderboard-stats" element={<PartnerLeaderboard />} />
        <Route path="partner-analytics" element={<AdminPartnerAnalytics />} />
        <Route path="partners/vouchers" element={<VoucherMonitoring />} />
      </Route>
      
      <Route path="/how-it-works" element={
        <ProtectedRoute>
          <HowItWorks />
        </ProtectedRoute>
      } />
      <Route path="/settings" element={
        <ProtectedRoute>
          <Settings />
        </ProtectedRoute>
      } />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/master-login" element={<MasterLogin />} />
      {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
      <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
};

const App = () => (
  <GlobalErrorBoundary>
    <HelmetProvider>
    <BrowserRouter
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
      <QueryClientProvider client={queryClient}>
        <AdminModeProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner position="top-right" />
            <BrandingProvider>
              <CurrencyProvider>
                <LanguageProvider>
                  <DynamicSEO />
                  <ReamazeInitializer />
                  <RoutesWrapper />
                </LanguageProvider>
              </CurrencyProvider>
            </BrandingProvider>
          </TooltipProvider>
        </AdminModeProvider>
      </QueryClientProvider>
    </BrowserRouter>
    </HelmetProvider>
  </GlobalErrorBoundary>
);

export default App;
