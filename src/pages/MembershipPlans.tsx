import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";
import { useMembershipPlans } from "@/hooks/useMembershipPlans";
import { useUserProfile } from "@/hooks/useUserProfile";
import { Button } from "@/components/ui/button";
import { Sidebar } from "@/components/layout/Sidebar";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, Info, AlertCircle, Clock, TrendingUp } from "lucide-react";
import { PlanCardSkeleton } from "@/components/membership/PlanCardSkeleton";
import { PlanCard } from "@/components/membership/PlanCard";
import { PlanTabs } from "@/components/membership/PlanTabs";
import { CurrencyDisplay } from "@/components/ui/CurrencyDisplay";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface MembershipPlan {
  id: string;
  name: string;
  display_name: string;
  account_type: string;
  price: number;
  billing_period_days: number;
  billing_period_unit?: string;
  billing_period_value?: number;
  daily_task_limit: number;
  earning_per_task: number;
  task_skip_limit_per_day: number;
  features: any;
  task_commission_rate: number;
  deposit_commission_rate: number;
  free_plan_expiry_days?: number;
  free_unlock_withdrawal_enabled?: boolean;
  free_unlock_withdrawal_days?: number;
}

export default function MembershipPlans() {
  const { user, signOut, loading: authLoading } = useAuth();
  const { isAdmin } = useAdmin();
  const navigate = useNavigate();
  
  // Custom hooks for data management
  const {
    plans,
    loading,
    error,
    errorType,
    retrying,
    earningPotentials,
    loadPlans,
    retry
  } = useMembershipPlans();
  
  const {
    profile,
    currentPlan,
    depositBalance,
    planStatus,
    loadUserProfile,
    setCurrentPlan
  } = useUserProfile(user);

  const [upgrading, setUpgrading] = useState<string | null>(null);
  const [showUpgradeDialog, setShowUpgradeDialog] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<any>(null);
  const [prorationDetails, setProrationDetails] = useState<any>(null);

  useEffect(() => {
    loadPlans();
    loadUserProfile();
  }, [loadPlans, loadUserProfile]);


  const handleUpgradeClick = async (plan: any) => {
    // User must be authenticated (guaranteed by ProtectedRoute)
    if (!user || !profile) {
      toast.error("Please refresh the page and try again");
      return;
    }

    if (plan.name === currentPlan) {
      toast.info("You are already on this plan");
      return;
    }

    if (plan.name === "free") {
      toast.error("Cannot downgrade to free plan. Please contact support.");
      return;
    }

    // Check if sufficient funds
    if (depositBalance < plan.price) {
      const shortfall = plan.price - depositBalance;
      toast.error(`Insufficient balance. You need $${shortfall.toFixed(2)} more. Redirecting to wallet...`, {
        duration: 4000
      });
      setTimeout(() => navigate("/wallet"), 2000);
      return;
    }

    // Show upgrade dialog with proration if applicable
    setSelectedPlan(plan);
    
    // Calculate proration if upgrading from paid plan
    if (profile.current_plan_start_date && currentPlan !== 'free') {
      const currentPlanData = plans.find(p => p.name === currentPlan);
      if (currentPlanData && currentPlanData.price > 0) {
        const planStartDate = new Date(profile.current_plan_start_date);
        const now = new Date();
        const daysUsed = Math.floor((now.getTime() - planStartDate.getTime()) / (1000 * 60 * 60 * 24));
        const daysRemaining = Math.max(0, currentPlanData.billing_period_days - daysUsed);
        const dailyRate = currentPlanData.price / currentPlanData.billing_period_days;
        const credit = dailyRate * daysRemaining;
        const newCost = Math.max(0, plan.price - credit);
        
        setProrationDetails({
          daysRemaining,
          credit: credit.toFixed(2),
          originalPrice: plan.price.toFixed(2),
          newCost: newCost.toFixed(2),
          savings: credit.toFixed(2)
        });
      }
    }
    
    setShowUpgradeDialog(true);
  };

  const confirmUpgrade = async () => {
    if (!selectedPlan) return;
    
    setShowUpgradeDialog(false);
    setUpgrading(selectedPlan.id);

    try {
      // Check network connectivity first
      if (!navigator.onLine) {
        toast.error("No internet connection. Please check your network and try again.");
        setUpgrading(null);
        return;
      }

      // Call the upgrade-plan edge function
      const { data, error } = await supabase.functions.invoke("upgrade-plan", {
        body: { planName: selectedPlan.name },
      });

      if (error) {
        // Determine error type
        if (error.message?.includes('Failed to fetch') || error.message?.includes('network')) {
          toast.error("Network error during upgrade. Please check your connection and try again.");
        } else if (error.message?.includes('JWT') || error.message?.includes('auth')) {
          toast.error("Authentication error. Please log in again and retry.");
          setTimeout(() => navigate('/login'), 2000);
        } else {
          toast.error("Failed to process upgrade. Please try again or contact support.");
        }
        throw error;
      }

      if (data.error) {
        toast.error(data.error);
        return;
      }

      const prorationInfo = data.prorationApplied 
        ? ` (Saved $${data.prorationDetails?.savings || 0} from proration)`
        : '';
      
      toast.success(`Successfully upgraded to ${selectedPlan.display_name}!${prorationInfo}`);
      setCurrentPlan(selectedPlan.name);
      setProrationDetails(null);
      setSelectedPlan(null);
      
      // Reload profile to get updated data
      await loadUserProfile();
    } catch (error: any) {
      console.error("Upgrade error:", error);
      
      // Show user-friendly error if no specific error was already shown
      if (!navigator.onLine) {
        toast.error("Lost internet connection. Please try again when connected.");
      } else if (error.message && !error.message.includes('Failed to fetch')) {
        toast.error(error.message || "Failed to upgrade plan. Please try again.");
      }
    } finally {
      setUpgrading(null);
    }
  };

  // Show skeleton loaders during initial load
  if (authLoading || loading || !profile) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <LoadingSpinner size="lg" text="Loading membership plans..." />
      </div>
    );
  }

  // Show error state with retry option
  if (error) {
    const getErrorIcon = () => {
      if (errorType === 'network') {
        return <AlertCircle className="h-12 w-12 text-amber-500 mx-auto" />;
      }
      return <AlertCircle className="h-12 w-12 text-destructive mx-auto" />;
    };

    const getErrorTitle = () => {
      switch (errorType) {
        case 'network':
          return 'Connection Error';
        case 'auth':
          return 'Authentication Required';
        case 'data':
          return 'Data Not Available';
        default:
          return 'Unable to Load Plans';
      }
    };


    return (
      <div className="flex items-center justify-center min-h-screen p-4">
        <div className="text-center space-y-4 max-w-md">
          {getErrorIcon()}
          <h2 className="text-2xl font-bold">{getErrorTitle()}</h2>
          <p className="text-muted-foreground">{error}</p>
          
          {errorType === 'auth' && (
            <Button 
              onClick={() => navigate('/login')}
              className="w-full"
            >
              Log In Again
            </Button>
          )}
          
          {errorType !== 'auth' && (
            <div className="space-y-2">
              <Button 
                onClick={retry}
                disabled={retrying}
                className="w-full"
              >
                {retrying ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Retrying...
                  </>
                ) : (
                  'Try Again'
                )}
              </Button>
              
              {errorType === 'network' && (
                <p className="text-xs text-muted-foreground">
                  Check your internet connection and try again
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Separate plans by account type
  const personalPlans = plans.filter(p => 
    p.account_type === 'free' || p.account_type === 'personal'
  );
  const businessPlans = plans.filter(p => 
    p.account_type === 'business'
  );

  // Calculate free plan daily earning for comparison
  const freePlan = plans.find(p => p.name === 'free');
  const freePlanDailyEarning = freePlan 
    ? freePlan.earning_per_task * freePlan.daily_task_limit 
    : 0;

  // Render plan cards function with optional variant
  const renderPlanCards = (planList: MembershipPlan[], variant: 'vertical' | 'horizontal' = 'vertical') => {
    if (loading && planList.length === 0) {
      return [1, 2, 3, 4].map((i) => <PlanCardSkeleton key={i} />);
    }
    return planList.map((plan) => (
      <PlanCard
        key={plan.id}
        plan={plan}
        isCurrentPlan={plan.name === currentPlan}
        earningPotential={earningPotentials[plan.id]}
        depositBalance={depositBalance}
        upgrading={upgrading === plan.id}
        onUpgradeClick={handleUpgradeClick}
        hasProfile={!!profile}
        variant={variant}
        freePlanEarning={freePlanDailyEarning}
      />
    ));
  };

  return (
    <div className="min-h-screen bg-background flex flex-col lg:flex-row">
      <Sidebar profile={profile || null} isAdmin={isAdmin} onSignOut={signOut} />
      
      <main className="flex-1 overflow-auto lg:mt-0 mt-16 pb-24 lg:pb-0">
        <div className="container mx-auto px-4 lg:px-8 py-8">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold mb-4">Membership Plans</h1>
            <p className="text-muted-foreground text-lg">
              Choose the perfect plan to maximize your earnings
            </p>
          </div>

          {/* Plan Expiry Alerts */}
          {planStatus && planStatus.status === 'expired' && (
            <Alert variant="destructive" className="mb-6 max-w-3xl mx-auto">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Plan Expired</AlertTitle>
              <AlertDescription>
                Your {currentPlan} plan has expired. Upgrade now to continue enjoying premium benefits.
              </AlertDescription>
            </Alert>
          )}

          {planStatus && planStatus.status === 'expiring_soon' && (
            <Alert className="mb-6 max-w-3xl mx-auto bg-amber-50 border-amber-200 dark:bg-amber-950 dark:border-amber-800">
              <Clock className="h-4 w-4 text-amber-600" />
              <AlertTitle className="text-amber-900 dark:text-amber-100">Plan Expiring Soon</AlertTitle>
              <AlertDescription className="text-amber-800 dark:text-amber-200">
                Your {currentPlan} plan expires in {planStatus.daysUntilExpiry} day{planStatus.daysUntilExpiry !== 1 ? 's' : ''}. Renew your account to avoid losing access.
              </AlertDescription>
            </Alert>
          )}

          {/* Urgency Banner for Free Users */}
          {user && profile && currentPlan === 'free' && (
            <Alert className="mb-8 max-w-4xl mx-auto bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 border-2 border-amber-300 dark:border-amber-700 animate-fade-in">
              <TrendingUp className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              <AlertTitle className="text-amber-900 dark:text-amber-100 text-lg font-bold">
                🎉 Limited Time: Get Pro-Rated Pricing on All Upgrades!
              </AlertTitle>
              <AlertDescription className="text-amber-800 dark:text-amber-200 mt-2">
                Upgrade now and only pay for the remaining days of your billing period. Start earning more immediately with higher task limits and better rates!
              </AlertDescription>
            </Alert>
          )}

          {user && profile && (
            <Alert className="mb-8 max-w-3xl mx-auto">
              <Info className="h-4 w-4" />
              <AlertDescription>
                Your current deposit wallet balance: <strong><CurrencyDisplay amountUSD={depositBalance} /></strong>
                {depositBalance === 0 && (
                  <span className="text-muted-foreground">
                    {" "}- Please <Button variant="link" className="p-0 h-auto" onClick={() => navigate("/wallet")}>deposit funds</Button> to upgrade your plan.
                  </span>
                )}
              </AlertDescription>
            </Alert>
          )}

          <PlanTabs
            personalPlans={personalPlans}
            businessPlans={businessPlans}
            renderPlanCards={renderPlanCards}
          />
        </div>

        {/* Upgrade Confirmation Dialog with Proration */}
        <Dialog open={showUpgradeDialog} onOpenChange={setShowUpgradeDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirm Plan Upgrade</DialogTitle>
              <DialogDescription>
                You are about to upgrade to {selectedPlan?.display_name}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Current Balance:</span>
                <span className="font-semibold"><CurrencyDisplay amountUSD={depositBalance} /></span>
              </div>

              {prorationDetails ? (
                <>
                  <div className="border-t pt-4 space-y-3">
                    <div className="bg-primary/5 rounded-lg p-3 space-y-2">
                      <div className="font-semibold text-sm flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-primary" />
                        Proration Applied
                      </div>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Original Price:</span>
                          <span className="line-through"><CurrencyDisplay amountUSD={parseFloat(prorationDetails.originalPrice)} /></span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Credit ({prorationDetails.daysRemaining} days unused):</span>
                          <span className="text-green-600">-<CurrencyDisplay amountUSD={parseFloat(prorationDetails.credit)} /></span>
                        </div>
                        <div className="flex justify-between font-bold text-base border-t pt-2">
                          <span>You Pay:</span>
                          <span className="text-primary"><CurrencyDisplay amountUSD={parseFloat(prorationDetails.newCost)} /></span>
                        </div>
                      </div>
                    </div>
                    <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg p-2 text-center">
                      <span className="text-sm text-green-700 dark:text-green-400 font-semibold">
                        You save <CurrencyDisplay amountUSD={parseFloat(prorationDetails.savings)} /> with proration!
                      </span>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex justify-between items-center border-t pt-4">
                  <span className="text-muted-foreground">Upgrade Cost:</span>
                  <span className="font-bold text-xl text-primary"><CurrencyDisplay amountUSD={selectedPlan?.price || 0} /></span>
                </div>
              )}

              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Balance After:</span>
                <span className="font-semibold">
                  <CurrencyDisplay amountUSD={depositBalance - parseFloat(prorationDetails?.newCost || selectedPlan?.price || 0)} />
                </span>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => {
                setShowUpgradeDialog(false);
                setSelectedPlan(null);
                setProrationDetails(null);
              }}>
                Cancel
              </Button>
              <Button onClick={confirmUpgrade}>
                Confirm Upgrade
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}