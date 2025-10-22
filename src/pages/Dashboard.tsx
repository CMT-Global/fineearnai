import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Sidebar } from "@/components/layout/Sidebar";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { FreeAccountUpgradeBanner } from "@/components/dashboard/FreeAccountUpgradeBanner";
import { PremiumUpgradeBanner } from "@/components/dashboard/PremiumUpgradeBanner";
import { RecentTransactionsCard } from "@/components/transactions/RecentTransactionsCard";
import { 
  Crown, 
  Sparkles,
  DollarSign,
  TrendingUp,
  UserPlus,
  Zap,
  AlertCircle,
  Clock
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";
import { useDashboardData } from "@/hooks/useDashboardData";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { WalletCard } from "@/components/wallet/WalletCard";
import { CurrencyDisplay } from "@/components/ui/CurrencyDisplay";

const Dashboard = () => {
  const { user, loading, signOut } = useAuth();
  const { isAdmin } = useAdmin();
  const navigate = useNavigate();
  
  // ✅ Phase 1: Single React Query hook for all dashboard data (with caching)
  const { data, isLoading, refetch } = useDashboardData(user?.id);
  const { profile, referralStats, membershipPlan } = data || {};

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

  if (loading || !user || isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <LoadingSpinner size="lg" text="Loading dashboard..." />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <LoadingSpinner size="lg" text="Loading profile..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col lg:flex-row">
      {/* Sidebar */}
      <Sidebar profile={profile} isAdmin={isAdmin} onSignOut={signOut} />

      {/* Main Content */}
      <main className="flex-1 overflow-auto lg:mt-0 mt-16">
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
                  <li>You earn from the AI Training tasks you do yourself. The tasks are simple as long as you understand English and only take 30 to 40 minutes daily.</li>
                  <li>You also earn a commission from every AI task completed by people you invite if you have an upgraded account.</li>
                </ol>
                <p className="text-sm text-foreground/80 mt-2">
                  This allows you to earn yourself and also to create a team and employ people under you.
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
      </main>
    </div>
  );
};

export default Dashboard;
