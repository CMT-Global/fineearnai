import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageLoading } from "@/components/shared/PageLoading";
import { Badge } from "@/components/ui/badge";
import { FreeAccountUpgradeBanner } from "@/components/dashboard/FreeAccountUpgradeBanner";
import { PremiumUpgradeBanner } from "@/components/dashboard/PremiumUpgradeBanner";
import { RecentTransactionsCard } from "@/components/transactions/RecentTransactionsCard";
import { SocialFollowCard } from "@/components/dashboard/SocialFollowCard";
import { InternationalGuideCard } from "@/components/dashboard/InternationalGuideCard";
import { EmailVerificationBanner } from "@/components/dashboard/EmailVerificationBanner";
import { EmailVerificationDialog } from "@/components/dashboard/EmailVerificationDialog";
import { 
  Crown, 
  Sparkles,
  DollarSign,
  TrendingUp,
  UserPlus,
  Zap,
  AlertCircle,  
  Settings,
  Rocket,
  ArrowRight,
  Send
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";
import { useDashboardData } from "@/hooks/useDashboardData";
import { useMembershipPlans } from "@/hooks/useMembershipPlans";
import { isFreeTierPlan, getHighestTierPlan, getDaysSinceExpiry } from "@/lib/plan-utils";
import { useRealtimeTransactions } from "@/hooks/useRealtimeTransactions";
import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { WalletCard } from "@/components/wallet/WalletCard";
import { CurrencyDisplay } from "@/components/ui/CurrencyDisplay";
import { LoginMessageDialog } from "@/components/shared/LoginMessageDialog";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useBranding } from "@/contexts/BrandingContext";
import { useTranslation } from "react-i18next";

const Dashboard = () => {
  const { t } = useTranslation();
  const { user, loading, signOut } = useAuth();
  const { isAdmin } = useAdmin();
  const { platformName } = useBranding();
  const navigate = useNavigate();
  const location = useLocation();
  
  // State to track fresh login for login message dialog
  const [showLoginMessage, setShowLoginMessage] = useState(false);
  
  // State for email verification
  const [showEmailVerification, setShowEmailVerification] = useState(false);

  // Open email verification dialog when redirected from Tasks (guard sends state)
  useEffect(() => {
    if ((location.state as { openEmailVerification?: boolean })?.openEmailVerification) {
      setShowEmailVerification(true);
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, location.pathname, navigate]);
  
  // ✅ Phase 1: Single React Query hook for all dashboard data (with caching)
  const { data, isLoading, refetch } = useDashboardData(user?.id);
  const { profile, referralStats, membershipPlan } = data || {};
  const { plans } = useMembershipPlans();
  const highestTierPlan = getHighestTierPlan(plans ?? undefined);
  const isOnFreeTier = !membershipPlan || isFreeTierPlan(membershipPlan);
  const isOnHighestTier = highestTierPlan && membershipPlan?.name === highestTierPlan.name;

  // Dashboard content configuration
  const { data: dashboardContentData } = useQuery({
    queryKey: ["dashboard-content"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("platform_config")
        .select("key, value")
        .eq("key", "dashboard_content")
        .maybeSingle();

      if (error) throw error;
      return data?.value as any || {};
    },
    staleTime: 5 * 60 * 1000,
  });

  const dashboardContent = dashboardContentData || {};
  const earnersGuideVisible = dashboardContent.earnersGuide?.isVisible ?? true;
  const guidesSectionVisible = dashboardContent.guidesSection?.isVisible ?? true;
  const guidesTitle = dashboardContent.guidesSection?.title || "💳 Deposit & Withdrawal Quick Guides";
  const guidesDescription = dashboardContent.guidesSection?.description || "Learn how to fund your account and withdraw earnings using various payment methods globally";
  const socialSectionVisible = dashboardContent.socialSection?.isVisible ?? true;
  const socialFacebookUrl = dashboardContent.socialSection?.facebookUrl;
  const socialInstagramUrl = dashboardContent.socialSection?.instagramUrl;
  const socialTiktokUrl = dashboardContent.socialSection?.tiktokUrl;

  // Enable real-time transaction updates
  useRealtimeTransactions(user?.id);

  // Fetch VIP commission rate for current user
  const { data: vipRate } = useQuery({
    queryKey: ["vip-commission-rate-dashboard", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from("profiles")
        .select("vip_deposit_commission_rate")
        .eq("id", user.id)
        .single();
      return (data?.vip_deposit_commission_rate as number | null) ?? null;
    },
    enabled: !!user?.id,
    staleTime: 2 * 60 * 1000,
  });

  const isVipUser = vipRate !== null && vipRate !== undefined && vipRate > 0;

  // ✅ NEW: Check for login trigger flag on mount
  useEffect(() => {
    if (!user?.id) return;
    
    const triggerKey = `loginMessageTrigger_${user.id}`;
    const hasTrigger = sessionStorage.getItem(triggerKey);
    
    if (hasTrigger === 'true') {
      // Remove trigger flag (one-time use)
      sessionStorage.removeItem(triggerKey);
      console.info(`[LoginMessage] Trigger consumed for user ${user.id}`);
      
      // Show login message after smooth transition
      setTimeout(() => {
        setShowLoginMessage(true);
      }, 300);
    }
  }, [user?.id]);

  // ✅ SIMPLIFIED: Auth state listener (cleanup only)
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      // Reset on logout and cleanup trigger flags
      if (event === 'SIGNED_OUT') {
        setShowLoginMessage(false);
        
        // Clean up any leftover trigger flags
        if (session?.user?.id) {
          const triggerKey = `loginMessageTrigger_${session.user.id}`;
          sessionStorage.removeItem(triggerKey);
          console.info(`[LoginMessage] Trigger cleaned up on logout for user ${session.user.id}`);
        }
      }
    });

    // Cleanup subscription on unmount
    return () => {
      subscription.unsubscribe();
      setShowLoginMessage(false);
    };
  }, []); // Run once on mount only

  useEffect(() => {
    if (!loading && !user) {
      navigate("/login");
    }
  }, [user, loading, navigate]);

  // Check if plan is expired or expiring soon
  const getPlanStatus = () => {
    if (!profile || !profile.plan_expires_at) return null;
    
    const now = new Date();
    const expiryDate = new Date(profile.plan_expires_at);
    const daysUntilExpiry = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysUntilExpiry < 0) {
      const daysSinceExpiry = getDaysSinceExpiry(profile.plan_expires_at);
      return { status: 'expired', daysUntilExpiry: 0, daysSinceExpiry: daysSinceExpiry ?? Math.abs(daysUntilExpiry), expiryDate };
    } else if (daysUntilExpiry <= 7) {
      return { status: 'expiring_soon', daysUntilExpiry, expiryDate };
    }
    return { status: 'active', daysUntilExpiry, expiryDate };
  };

  const planStatus = getPlanStatus();

  // Early return ONLY for auth loading (before we have user)
  if (loading || !user) {
    return <PageLoading text={t("dashboard.authenticating")} />;
  }

  if (isLoading || !profile) {
    return <PageLoading text={t("dashboard.loadingDashboard")} />;
  }

  return (
    <>
      {/* Login Message Dialog - Phase 3 with proper trigger reset */}
      {user && (
        <LoginMessageDialog 
          userId={user.id}
          trigger={showLoginMessage}
          onOpenChange={(open) => {
            // Reset trigger state when dialog is dismissed
            setShowLoginMessage(open);
          }}
        />
      )}

      {/* Email Verification Dialog */}
      {profile && (
        <EmailVerificationDialog
          open={showEmailVerification}
          onOpenChange={setShowEmailVerification}
          userEmail={profile.email}
          onVerificationSuccess={() => {
            // Refetch dashboard data to update email_verified status
            refetch();
          }}
        />
      )}

      {profile && (
        <>
          {/* Header */}
          <header className="bg-card border-b px-4 lg:px-8 py-6">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold">{t("dashboard.welcomeBack", { username: profile.username })}</h1>
                <p className="text-muted-foreground">{t("dashboard.subtitle")}</p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <Button 
                  variant="outline" 
                  className="gap-2"
                  onClick={() => navigate("/plans")}
                >
                  <Crown className="h-4 w-4" />
                  <span className="hidden sm:inline">{t("dashboard.membership")}</span>
                  <Badge 
                    variant={
                      planStatus?.status === 'expired' ? 'destructive' :
                      planStatus?.status === 'expiring_soon' ? 'secondary' :
                      'default'
                    }
                    className="ml-2 capitalize"
                  >
                    {profile.membership_plan}
                    {planStatus && planStatus.status !== 'active' && planStatus.daysUntilExpiry > 0 && 
                      ` (${t("dashboard.daysLeft", { days: planStatus.daysUntilExpiry })})`
                    }
                    {planStatus?.status === 'expired' && ` (${t("dashboard.expired")})`}
                  </Badge>
                </Button>
                <Button 
                  className="gap-2 bg-orange-600 hover:bg-orange-700 text-white"
                  onClick={() => navigate("/plans")}
                >
                  <Sparkles className="h-4 w-4" />
                  <span className="hidden sm:inline">{t("dashboard.upgradeNow")}</span>
                  <span className="sm:hidden">{t("dashboard.upgradeNow")}</span>
                </Button>
              </div>
            </div>
          </header>

          {/* Free tier upgrade banner - show when on default (free) plan and NOT expired */}
          {isOnFreeTier && planStatus?.status !== 'expired' && (
            <div className="mx-4 lg:mx-8 mt-6">
              <FreeAccountUpgradeBanner 
                userId={user.id}
                planExpiresAt={profile.plan_expires_at}
                planStartDate={profile.current_plan_start_date}
                accountCreatedAt={profile.created_at}
                freePlanExpiryDays={membershipPlan?.free_plan_expiry_days}
                onUpgrade={() => navigate("/plans")}
              />
            </div>
          )}

          {/* Premium Upgrade Banner - For paid plans below the highest tier (from DB) */}
          {membershipPlan && !isOnFreeTier && !isOnHighestTier && (
            <div className="mx-4 lg:mx-8 mt-6">
              <PremiumUpgradeBanner 
                userId={user.id}
                currentPlan={profile.membership_plan}
                onUpgrade={() => navigate("/plans")}
                highestTierPlanName={highestTierPlan?.name}
              />
            </div>
          )}

          {/* Plan Expiry Alerts */}
          {planStatus && planStatus.status === 'expired' && (
            <div className="mx-4 lg:mx-8 mt-6">
              <div className="relative rounded-lg border-2 border-destructive/80 bg-destructive/5 dark:bg-destructive/10 p-5 lg:p-6 shadow-lg animate-in slide-in-from-top-2 duration-300">
                <div className="flex flex-col gap-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-destructive/20">
                      <AlertCircle className="h-5 w-5 text-destructive" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-bold text-destructive leading-tight mb-2">
                        {t("dashboard.accountExpired")}
                      </h3>
                      <ul className="list-disc list-inside space-y-1.5 text-sm text-destructive/90 leading-relaxed marker:text-destructive">
                        <li>{t("dashboard.accountExpiredMessage")}</li>
                        <li>{t("dashboard.accountExpiredSubline")}</li>
                        {planStatus.daysSinceExpiry != null && planStatus.daysSinceExpiry > 0 && (
                          <li className="font-medium">
                            {planStatus.daysSinceExpiry === 1
                              ? t("dashboard.expiredOneDayAgo")
                              : t("dashboard.expiredDaysAgo", { days: planStatus.daysSinceExpiry })}
                          </li>
                        )}
                      </ul>
                    </div>
                  </div>
                  <Button
                    size="lg"
                    className="w-fit bg-orange-600 hover:bg-orange-700 text-white font-semibold rounded-lg shadow-md px-6"
                    onClick={() => navigate("/plans")}
                  >
                    {t("dashboard.upgradeNow")}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Platform Earners Guide Button */}
          {earnersGuideVisible && (
          <div className="mx-4 lg:mx-8 mt-6">
            <Button
              onClick={() => navigate("/how-it-works")}
              size="lg"
              className="w-full group relative overflow-hidden bg-gradient-to-r from-primary/80 via-primary to-primary/80 text-primary-foreground hover:shadow-2xl transition-all duration-500 hover:scale-[1.02] h-auto py-6"
            >
              {/* Animated background pulse */}
              <div className="absolute inset-0 bg-gradient-to-r from-primary via-primary/90 to-primary opacity-0 group-hover:opacity-100 transition-opacity duration-700 animate-pulse" />
              
              {/* Content */}
              <div className="relative flex items-center justify-center gap-3">
                <Sparkles className="h-6 w-6 animate-spin-slow" />
                <div className="flex flex-col items-start text-primary-foreground">
                    <span className="text-lg font-bold">{t("dashboard.earnersGuide", { platform: platformName })}</span>
                  <span className="text-xs opacity-80">{t("dashboard.earnersGuideSubtitle")}</span>
                </div>
                <div className="ml-4 h-10 w-10 rounded-full bg-black/20 backdrop-blur-sm flex items-center justify-center group-hover:rotate-180 transition-transform duration-700">
                  <Rocket className="h-5 w-5" />
                </div>
              </div>
            </Button>
          </div>
          )}

          {/* Email Verification Banner - Show if email not verified */}
          {profile.email_verified === false && (
            <div className="mx-4 lg:mx-8 mt-6">
              <EmailVerificationBanner 
                onVerifyClick={() => setShowEmailVerification(true)}
              />
            </div>
          )}

          {/* Telegram Community Banner */}
          <div className="mx-4 lg:mx-8 mt-6">
            <a
              href="https://t.me/profitchipsglobal"
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center gap-4 rounded-xl p-4 bg-[#229ED9]/10 border border-[#229ED9]/30 hover:bg-[#229ED9]/20 hover:border-[#229ED9]/60 transition-all duration-300 cursor-pointer"
            >
              {/* Telegram icon */}
              <div className="flex-shrink-0 h-12 w-12 rounded-full bg-[#229ED9] flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300">
                <Send className="h-6 w-6 text-white translate-x-0.5 -translate-y-0.5" />
              </div>
              {/* Text */}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-[#229ED9] dark:text-[#5bbfe8] text-sm sm:text-base">
                  Join our Telegram Channel
                </p>
                <p className="text-xs sm:text-sm text-muted-foreground truncate">
                  Get tips, updates &amp; announcements from ProfitChips
                </p>
              </div>
              {/* Arrow */}
              <div className="flex-shrink-0 hidden sm:flex items-center gap-1 text-[#229ED9] dark:text-[#5bbfe8] font-medium text-sm group-hover:translate-x-1 transition-transform duration-300">
                <span>Join Now</span>
                <ArrowRight className="h-4 w-4" />
              </div>
            </a>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 p-4 lg:p-8">
              <WalletCard 
                depositBalance={Number(profile?.deposit_wallet_balance || 0)}
                earningsBalance={Number(profile?.earnings_wallet_balance || 0)}
                onBalanceUpdate={refetch}
              />

              <Card className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">{t("dashboard.tasksToday")}</p>
                    <p className="text-3xl font-bold">
                      {profile?.tasks_completed_today || 0}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      <CurrencyDisplay amountUSD={Number(profile?.total_earned || 0)} /> {t("dashboard.totalEarned")}
                    </p>
                  </div>
                  <div className="h-12 w-12 rounded-xl bg-[hsl(var(--wallet-tasks))]/10 flex items-center justify-center">
                    <Zap className="h-6 w-6 text-[hsl(var(--wallet-tasks))]" />
                  </div>
                </div>
              </Card>

            <Card className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">{t("dashboard.referrals")}</p>
                  <p className="text-3xl font-bold">{referralStats?.total_referrals || 0}</p>
                  <div className="flex flex-col gap-0.5 mt-1">
                    <p className="text-xs text-muted-foreground">
                      {referralStats?.active_referrals || 0} {t("dashboard.active")}
                    </p>
                    <p className="text-xs font-semibold text-[hsl(var(--wallet-referrals))]">
                      <CurrencyDisplay amountUSD={Number(referralStats?.total_earnings || 0)} /> {t("dashboard.earned")}
                    </p>
                    {/* VIP Commission Badge */}
                    {isVipUser && (
                      <div className="mt-2 flex items-center gap-1.5 px-2 py-1 rounded-full bg-yellow-500/15 border border-yellow-400/40 w-fit">
                        <Sparkles className="h-3 w-3 text-yellow-500" />
                        <span className="text-[10px] font-bold text-yellow-600 dark:text-yellow-400 leading-none">
                          VIP {(vipRate! * 100).toFixed(0)}% Commission
                        </span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="h-12 w-12 rounded-xl bg-[hsl(var(--wallet-referrals))]/10 flex items-center justify-center">
                  <UserPlus className="h-6 w-6 text-[hsl(var(--wallet-referrals))]" />
                </div>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full mt-2"
                onClick={() => navigate("/referrals")}
              >
                {t("dashboard.viewDetails")}
              </Button>
            </Card>
          </div>

          {/* Deposit & Withdrawal Quick Guides Section */}
          {guidesSectionVisible && (
          <div className="px-4 lg:px-8 pb-6">
              <InternationalGuideCard title={guidesTitle} description={guidesDescription} />
          </div>
          )}

          {/* Social Media Follow Section */}
          {socialSectionVisible && (
          <div className="px-4 lg:px-8 pb-6">
              <SocialFollowCard
                facebookUrl={socialFacebookUrl}
                instagramUrl={socialInstagramUrl}
                tiktokUrl={socialTiktokUrl}
              />
          </div>
          )}

          {/* Two Column Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 px-4 lg:px-8 pb-8">
            {/* Today's Progress */}
            <Card className="lg:col-span-2 p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  <h2 className="font-semibold">{t("dashboard.todaysProgress")}</h2>
                </div>
                <Button 
                  size="sm" 
                  className="bg-primary text-primary-foreground hover:opacity-90"
                  onClick={() => navigate("/tasks")}
                >
                  {t("dashboard.startTasks")}
                </Button>
              </div>
              
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-medium mb-2">{t("dashboard.keepUpGreatWork")}</p>
                  <p className="text-sm text-muted-foreground">
                    {t("dashboard.completeTasksDescription")}
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{t("dashboard.dailyProgress")}</span>
                    <span className="font-medium">
                      {profile?.tasks_completed_today || 0}/
                      {membershipPlan?.daily_task_limit || 10} {t("dashboard.tasks")}
                    </span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-[hsl(var(--wallet-deposit))] to-[hsl(var(--wallet-tasks))]"
                      style={{ 
                        width: `${((profile?.tasks_completed_today || 0) / 
                                   (membershipPlan?.daily_task_limit || 10)) * 100}%` 
                      }}
                    ></div>
                  </div>
                </div>
              </div>
            </Card>

            {/* Quick Actions */}
            <Card className="p-6">
              <h2 className="font-semibold mb-4">{t("dashboard.quickActions")}</h2>
              <div className="space-y-2">
                <Button 
                  variant="outline" 
                  className="w-full justify-start gap-2"
                  onClick={() => navigate("/tasks")}
                >
                  <Zap className="h-4 w-4 text-[hsl(var(--wallet-tasks))]" />
                  {t("dashboard.startAITasks")}
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full justify-start gap-2"
                  onClick={() => navigate("/transactions")}
                >
                  <DollarSign className="h-4 w-4 text-[hsl(var(--wallet-earnings))]" />
                  {t("dashboard.transactionHistory")}
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full justify-start gap-2"
                  onClick={() => navigate("/referrals")}
                >
                  <UserPlus className="h-4 w-4 text-[hsl(var(--wallet-referrals))]" />
                  {t("dashboard.inviteFriends")}
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full justify-start gap-2"
                  onClick={() => navigate("/plans")}
                >
                  <Crown className="h-4 w-4 text-[hsl(var(--wallet-deposit))]" />
                  {t("dashboard.upgradePlan")}
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full justify-start gap-2"
                  onClick={() => navigate("/settings")}
                >
                  <Settings className="h-4 w-4 text-muted-foreground" />
                  {t("dashboard.accountSettings")}
                </Button>
              </div>
            </Card>
          </div>

          {/* Recent Activity */}
          <div className="px-4 lg:px-8 pb-8">
            <RecentTransactionsCard 
              userId={user?.id || ''} 
              maxItems={5} 
              showPagination={false} 
              title={t("dashboard.recentActivity")}
            />
          </div>

        </>
      )}
    </>
  );
};

export default Dashboard;
