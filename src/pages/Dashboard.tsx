import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageLayout } from "@/components/layout/PageLayout";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { FreeAccountUpgradeBanner } from "@/components/dashboard/FreeAccountUpgradeBanner";
import { PremiumUpgradeBanner } from "@/components/dashboard/PremiumUpgradeBanner";
import { RecentTransactionsCard } from "@/components/transactions/RecentTransactionsCard";
import { FloatingTelegramButton } from "@/components/shared/FloatingTelegramButton";
import { SocialFollowCard } from "@/components/dashboard/SocialFollowCard";
import { 
  Crown, 
  Sparkles,
  DollarSign,
  TrendingUp,
  UserPlus,
  Zap,
  AlertCircle,
  Clock,
  Settings
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

const Dashboard = () => {
  const { user, loading, signOut } = useAuth();
  const { isAdmin } = useAdmin();
  const navigate = useNavigate();
  
  // State to track fresh login for login message dialog
  const [showLoginMessage, setShowLoginMessage] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  
  // ✅ Phase 1: Single React Query hook for all dashboard data (with caching)
  const { data, isLoading, refetch } = useDashboardData(user?.id);
  const { profile, referralStats, membershipPlan } = data || {};

  // Enable real-time transaction updates
  useRealtimeTransactions(user?.id);

  // ✅ Phase 3: Detect fresh authentication for login message with improved auth tracking
  useEffect(() => {
    // Check for existing session on mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      // If there's already a session on initial load, mark as initial load (not fresh login)
      if (session?.user) {
        setIsInitialLoad(true);
      }
    });

    // Set up listener for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      // Only trigger on SIGNED_IN event (fresh login), not on initial page load
      // Differentiate between initial session load vs actual fresh login
      if (event === 'SIGNED_IN' && session?.user && !isInitialLoad) {
        // Small delay to ensure smooth transition after auth
        setTimeout(() => {
          setShowLoginMessage(true);
        }, 500);
      }
      
      // After first auth event, mark initial load as complete
      if (isInitialLoad && (event === 'INITIAL_SESSION' || event === 'SIGNED_IN')) {
        setIsInitialLoad(false);
      }
      
      // Reset trigger state on logout to ensure clean state for next login
      if (event === 'SIGNED_OUT') {
        setShowLoginMessage(false);
        // Reset initial load flag to allow login message on next sign in
        setIsInitialLoad(false);
      }
    });

    // Cleanup function to reset trigger state when component unmounts
    return () => {
      subscription.unsubscribe();
      setShowLoginMessage(false);
    };
  }, [isInitialLoad]);

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

      {profile && (
        <>
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

          {/* Info Alert */}
          <div className="mx-8 mt-6">
            <Card className="p-4 bg-[hsl(var(--wallet-earnings))]/5 border-[hsl(var(--wallet-earnings))]/20">
              <div className="flex gap-3">
                <div className="h-5 w-5 rounded-full bg-[hsl(var(--wallet-earnings))]/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Sparkles className="h-3 w-3 text-[hsl(var(--wallet-earnings))]" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-[hsl(var(--wallet-earnings))] mb-1">What is FineEarn?</h3>
                  <p className="text-sm text-foreground/80 mb-2">
                    FineEarn is an AI training platform that allows you and your team to earn online by training AI. You mainly earn in 2 ways:
                  </p>
                  <ol className="text-sm text-foreground/80 space-y-1 ml-4 list-decimal">
                    <li>You <strong>earn from the AI Training tasks you do yourself</strong>. The tasks are simple as long as you understand English and only take 30 to 40 minutes daily.</li>
                    <li>You also <strong>earn a commission from every AI task completed by people you invite</strong> if you have an upgraded account.</li>
                  </ol>
                  <p className="text-sm text-foreground/80 mt-2">
                    This allows you to earn yourself and also to <strong>create a team and employ people under you</strong>.
                  </p>
                </div>
              </div>
            </Card>
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

          {/* Social Media Follow Section */}
          <div className="px-4 lg:px-8 pb-6">
            <SocialFollowCard />
          </div>

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

          {/* Floating Telegram Button */}
          <FloatingTelegramButton />
        </>
      )}
    </PageLayout>
  );
};

export default Dashboard;
