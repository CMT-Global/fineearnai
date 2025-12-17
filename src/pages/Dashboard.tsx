import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageLayout } from "@/components/layout/PageLayout";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
  Clock,
  Settings,
  Rocket,
  ArrowRight
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";
import { useDashboardData } from "@/hooks/useDashboardData";
import { useRealtimeTransactions } from "@/hooks/useRealtimeTransactions";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { WalletCard } from "@/components/wallet/WalletCard";
import { CurrencyDisplay } from "@/components/ui/CurrencyDisplay";
import { LoginMessageDialog } from "@/components/shared/LoginMessageDialog";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

const Dashboard = () => {
  const { user, loading, signOut } = useAuth();
  const { isAdmin } = useAdmin();
  const navigate = useNavigate();
  
  // State to track fresh login for login message dialog
  const [showLoginMessage, setShowLoginMessage] = useState(false);
  
  // State for email verification
  const [showEmailVerification, setShowEmailVerification] = useState(false);
  
  // ✅ Phase 1: Single React Query hook for all dashboard data (with caching)
  const { data, isLoading, refetch } = useDashboardData(user?.id);
  const { profile, referralStats, membershipPlan } = data || {};

  // Dashboard content & platform name configuration
  const { data: dashboardContentData } = useQuery({
    queryKey: ["dashboard-content"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("platform_config")
        .select("key, value")
        .in("key", ["platform_name", "dashboard_content"]);

      if (error) throw error;

      const map = new Map<string, any>();
      data?.forEach((row: any) => {
        map.set(row.key, row.value);
      });

      const platformName = (map.get("platform_name") as string) || "ProfitChips";
      const dashboardContent = map.get("dashboard_content") || {};

      return {
        platformName,
        dashboardContent,
      };
    },
    staleTime: 5 * 60 * 1000,
  });

  const platformName = dashboardContentData?.platformName || "ProfitChips";
  const earnersGuideVisible =
    dashboardContentData?.dashboardContent?.earnersGuide?.isVisible ?? true;
  const guidesSectionVisible =
    dashboardContentData?.dashboardContent?.guidesSection?.isVisible ?? true;
  const guidesTitle =
    dashboardContentData?.dashboardContent?.guidesSection?.title ||
    "💳 Deposit & Withdrawal Quick Guides";
  const guidesDescription =
    dashboardContentData?.dashboardContent?.guidesSection?.description ||
    "Learn how to fund your account and withdraw earnings using various payment methods globally";
  const socialSectionVisible =
    dashboardContentData?.dashboardContent?.socialSection?.isVisible ?? true;
  const socialFacebookUrl =
    dashboardContentData?.dashboardContent?.socialSection?.facebookUrl;
  const socialInstagramUrl =
    dashboardContentData?.dashboardContent?.socialSection?.instagramUrl;
  const socialTiktokUrl =
    dashboardContentData?.dashboardContent?.socialSection?.tiktokUrl;

  // Enable real-time transaction updates
  useRealtimeTransactions(user?.id);

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
      return { status: 'expired', daysUntilExpiry: 0, expiryDate };
    } else if (daysUntilExpiry <= 7) {
      return { status: 'expiring_soon', daysUntilExpiry, expiryDate };
    }
    return { status: 'active', daysUntilExpiry, expiryDate };
  };

  const planStatus = getPlanStatus();

  // Early return ONLY for auth loading (before we have user)
  if (loading || !user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <LoadingSpinner size="lg" text="Authenticating..." />
      </div>
    );
  }

  return (
    <PageLayout
      profile={profile}
      isAdmin={isAdmin}
      onSignOut={signOut}
      isLoading={isLoading || !profile}
      loadingText="Loading dashboard..."
    >
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
          {/* Email Verification Banner - Show if email not verified */}
          {profile.email_verified === false && (
            <div className="mx-4 lg:mx-8 mt-6">
              <EmailVerificationBanner 
                onVerifyClick={() => setShowEmailVerification(true)}
              />
            </div>
          )}

          {/* Earner Status Banner - Unverified Users Only */}
          {profile.earnerBadge && !profile.earnerBadge.isVerified && (
            <div className="mx-4 lg:mx-8 mt-6">
              <Alert className="bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-950/20 dark:to-amber-950/20 border-orange-200 dark:border-orange-800">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{profile.earnerBadge.icon}</span>
               
                </div>
                <AlertTitle className="text-orange-900 dark:text-orange-100 flex items-center gap-2">
                  {profile.earnerBadge.badgeText}
                </AlertTitle>
                <AlertDescription className="text-orange-800 dark:text-orange-200 space-y-3">
                  <p>{profile.earnerBadge.upgradePrompt}</p>
                  <Button 
                    onClick={() => navigate("/plans")}
                    className="w-full sm:w-auto bg-orange-600 hover:bg-orange-700 text-white font-semibold"
                  >
                    Upgrade to Verified Earner
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </AlertDescription>
              </Alert>
            </div>
          )}

          {/* Header */}
          <header className="bg-card border-b px-4 lg:px-8 py-6">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold">Welcome back, {profile.username}!</h1>
                <p className="text-muted-foreground">Manage your account and track your progress.</p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <Button 
                  variant="outline" 
                  className="gap-2"
                  onClick={() => navigate("/plans")}
                >
                  <Crown className="h-4 w-4" />
                  <span className="hidden sm:inline">Membership</span>
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
                      ` (${planStatus.daysUntilExpiry}d left)`
                    }
                    {planStatus?.status === 'expired' && ' (Expired)'}
                  </Badge>
                </Button>
                {planStatus && (planStatus.status === 'expired' || planStatus.status === 'expiring_soon') ? (
                  <Button 
                    className="gap-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:opacity-90"
                    onClick={() => navigate("/plans")}
                  >
                    <AlertCircle className="h-4 w-4" />
                    <span className="hidden sm:inline">{planStatus.status === 'expired' ? 'Upgrade Now' : 'Renew Account'}</span>
                    <span className="sm:hidden">Renew</span>
                  </Button>
                ) : (
                  <Button 
                    className="gap-2 bg-gradient-to-r from-[hsl(var(--wallet-deposit))] to-[hsl(var(--wallet-tasks))] text-white hover:opacity-90"
                    onClick={() => navigate("/plans")}
                  >
                    <Sparkles className="h-4 w-4" />
                    <span className="hidden sm:inline">Upgrade Account</span>
                    <span className="sm:hidden">Upgrade</span>
                  </Button>
                )}
              </div>
            </div>
          </header>

          {/* Free Account Upgrade Banner */}
          {profile.membership_plan === 'free' && (
            <div className="mx-4 lg:mx-8 mt-6">
              <FreeAccountUpgradeBanner 
                userId={user.id}
                planExpiresAt={profile.plan_expires_at}
                onUpgrade={() => navigate("/plans")}
              />
            </div>
          )}

          {/* Premium Upgrade Banner - For paid plans below the highest tier */}
          {profile.membership_plan !== 'free' && profile.membership_plan !== 'pro' && (
            <div className="mx-4 lg:mx-8 mt-6">
              <PremiumUpgradeBanner 
                userId={user.id}
                currentPlan={profile.membership_plan}
                onUpgrade={() => navigate("/plans")}
              />
            </div>
          )}

          {/* Plan Expiry Alerts */}
          {planStatus && planStatus.status === 'expired' && (
            <div className="mx-4 lg:mx-8 mt-6">
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Plan Expired</AlertTitle>
                <AlertDescription className="flex items-center justify-between">
                  <span>Your {profile.membership_plan} plan has expired. Upgrade now to continue enjoying premium benefits.</span>
                  <Button size="sm" variant="destructive" onClick={() => navigate("/plans")}>
                    Upgrade Now
                  </Button>
                </AlertDescription>
              </Alert>
            </div>
          )}

          {planStatus && planStatus.status === 'expiring_soon' && (
            <div className="mx-4 lg:mx-8 mt-6">
              <Alert className="bg-amber-50 border-amber-200 dark:bg-amber-950 dark:border-amber-800">
                <Clock className="h-4 w-4 text-amber-600" />
                <AlertTitle className="text-amber-900 dark:text-amber-100">Plan Expiring Soon</AlertTitle>
                <AlertDescription className="flex items-center justify-between text-amber-800 dark:text-amber-200">
                  <span>Your {profile.membership_plan} plan expires in {planStatus.daysUntilExpiry} day{planStatus.daysUntilExpiry !== 1 ? 's' : ''}. Renew now to avoid losing access.</span>
                  <Button size="sm" variant="default" onClick={() => navigate("/plans")}>
                    Renew Account
                  </Button>
                </AlertDescription>
              </Alert>
            </div>
          )}

          {/* Platform Earners Guide Button */}
          {earnersGuideVisible && (
          <div className="mx-4 lg:mx-8 mt-6">
            <Button
              onClick={() => navigate("/how-it-works")}
              size="lg"
              className="w-full group relative overflow-hidden bg-gradient-to-r from-blue-500 via-cyan-500 to-teal-500 text-white hover:shadow-2xl transition-all duration-500 hover:scale-[1.02] h-auto py-6"
            >
              {/* Animated background pulse */}
              <div className="absolute inset-0 bg-gradient-to-r from-cyan-500 via-blue-500 to-teal-500 opacity-0 group-hover:opacity-100 transition-opacity duration-700 animate-pulse" />
              
              {/* Content */}
              <div className="relative flex items-center justify-center gap-3">
                <Sparkles className="h-6 w-6 animate-spin-slow" />
                <div className="flex flex-col items-start">
                    <span className="text-lg font-bold">{platformName} - Earners Guide</span>
                  <span className="text-xs text-white/80">Learn how to maximize your earnings</span>
                </div>
                <div className="ml-4 h-10 w-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center group-hover:rotate-180 transition-transform duration-700">
                  <Rocket className="h-5 w-5" />
                </div>
              </div>
            </Button>
          </div>
          )}

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
                    <p className="text-sm text-muted-foreground mb-1">Tasks Today</p>
                    <p className="text-3xl font-bold">
                      {profile?.tasks_completed_today || 0}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      <CurrencyDisplay amountUSD={Number(profile?.total_earned || 0)} /> total earned
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
                  <p className="text-sm text-muted-foreground mb-1">Referrals</p>
                  <p className="text-3xl font-bold">{referralStats?.total_referrals || 0}</p>
                  <div className="flex flex-col gap-0.5 mt-1">
                    <p className="text-xs text-muted-foreground">
                      {referralStats?.active_referrals || 0} active
                    </p>
                    <p className="text-xs font-semibold text-[hsl(var(--wallet-referrals))]">
                      <CurrencyDisplay amountUSD={Number(referralStats?.total_earnings || 0)} /> earned
                    </p>
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
                View Details
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
                  <h2 className="font-semibold">Today's Progress</h2>
                </div>
                <Button 
                  size="sm" 
                  className="bg-[hsl(var(--wallet-tasks))] text-white hover:opacity-90"
                  onClick={() => navigate("/tasks")}
                >
                  Start Tasks
                </Button>
              </div>
              
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-medium mb-2">Keep up the great work!</p>
                  <p className="text-sm text-muted-foreground">
                    Complete AI training tasks to earn money and help improve artificial intelligence
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Daily Progress</span>
                    <span className="font-medium">
                      {profile?.tasks_completed_today || 0}/
                      {membershipPlan?.daily_task_limit || 10} tasks
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
              <h2 className="font-semibold mb-4">Quick Actions</h2>
              <div className="space-y-2">
                <Button 
                  variant="outline" 
                  className="w-full justify-start gap-2"
                  onClick={() => navigate("/tasks")}
                >
                  <Zap className="h-4 w-4 text-[hsl(var(--wallet-tasks))]" />
                  Start AI Tasks
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full justify-start gap-2"
                  onClick={() => navigate("/transactions")}
                >
                  <DollarSign className="h-4 w-4 text-[hsl(var(--wallet-earnings))]" />
                  Transaction History
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full justify-start gap-2"
                  onClick={() => navigate("/referrals")}
                >
                  <UserPlus className="h-4 w-4 text-[hsl(var(--wallet-referrals))]" />
                  Invite Friends
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full justify-start gap-2"
                  onClick={() => navigate("/plans")}
                >
                  <Crown className="h-4 w-4 text-[hsl(var(--wallet-deposit))]" />
                  Upgrade Plan
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full justify-start gap-2"
                  onClick={() => navigate("/settings")}
                >
                  <Settings className="h-4 w-4 text-muted-foreground" />
                  Account Settings
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
              title="Recent Activity"
            />
          </div>

        </>
      )}
    </PageLayout>
  );
};

export default Dashboard;
