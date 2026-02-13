import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";
import { useMembershipPlans } from "@/hooks/useMembershipPlans";
import { useUserProfile } from "@/hooks/useUserProfile";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { PageLoading } from "@/components/shared/PageLoading";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, Info, AlertCircle, TrendingUp } from "lucide-react";
import { PlanCardSkeleton } from "@/components/membership/PlanCardSkeleton";
import { PlanCard } from "@/components/membership/PlanCard";
import { PlanTabs } from "@/components/membership/PlanTabs";
import { CurrencyDisplay } from "@/components/ui/CurrencyDisplay";
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
import { useTranslation } from "react-i18next";

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
  min_withdrawal: number;
  features: any;
  task_commission_rate: number;
  deposit_commission_rate: number;
  free_plan_expiry_days?: number;
  free_unlock_withdrawal_enabled?: boolean;
  free_unlock_withdrawal_days?: number;
}

export default function MembershipPlans() {
  const { t } = useTranslation();
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

  // Get current plan price for downgrade detection
  const currentPlanObj = plans.find(p => p.name === currentPlan);
  const currentPlanPrice = currentPlanObj?.price ?? 0;

  const [upgrading, setUpgrading] = useState<string | null>(null);
  const [showUpgradeDialog, setShowUpgradeDialog] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<any>(null);
  const [prorationDetails, setProrationDetails] = useState<any>(null);

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/login");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    loadPlans();
    loadUserProfile();
  }, [loadPlans, loadUserProfile]);


  const handleUpgradeClick = async (plan: any) => {
    // User must be authenticated (guaranteed by ProtectedRoute)
    if (!user || !profile) {
      toast.error(t("common.error"));
      return;
    }

    if (plan.name === currentPlan) {
      toast.info(t("membershipPlans.alreadyOnPlan"));
      return;
    }

    // ✅ CRITICAL: Price-based downgrade prevention
    if (currentPlanObj && plan.price < currentPlanObj.price) {
      toast.error(t("membershipPlans.cannotDowngrade"));
      return;
    }

    // Explicit free plan check (redundant but clear)
    if (plan.name === "free" && currentPlanPrice > 0) {
      toast.error(t("membershipPlans.cannotDowngradeToFree"));
      return;
    }

    // Check if sufficient funds
    if (depositBalance < plan.price) {
      const shortfall = plan.price - depositBalance;
      toast.error(t("membershipPlans.needMore", { amount: shortfall.toFixed(2) }), {
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
        toast.error(t("membershipPlans.noInternetConnection"));
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
          toast.error(t("membershipPlans.networkError"));
        } else if (error.message?.includes('JWT') || error.message?.includes('auth')) {
          toast.error(t("membershipPlans.authError"));
          setTimeout(() => navigate('/login'), 2000);
        } else {
          toast.error(t("membershipPlans.upgradeFailed"));
        }
        throw error;
      }

      if (data.error) {
        toast.error(data.error);
        return;
      }

      const prorationInfo = data.prorationApplied 
        ? ` (${t("membershipPlans.youSaveAmount")} $${data.prorationDetails?.savings || 0} ${t("membershipPlans.withProration")})`
        : '';
      
      toast.success(t("membershipPlans.upgradeSuccess", { plan: selectedPlan.display_name }) + prorationInfo);
      setCurrentPlan(selectedPlan.name);
      setProrationDetails(null);
      setSelectedPlan(null);
      
      // Reload profile to get updated data
      await loadUserProfile();
    } catch (error: any) {
      console.error("Upgrade error:", error);
      
      // Show user-friendly error if no specific error was already shown
      if (!navigator.onLine) {
        toast.error(t("membershipPlans.noInternetConnection"));
      } else if (error.message && !error.message.includes('Failed to fetch')) {
        toast.error(error.message || t("membershipPlans.upgradeFailed"));
      }
    } finally {
      setUpgrading(null);
    }
  };

  // Show skeleton loaders during initial load or auth
  if (authLoading || !user) {
    return <PageLoading text={t("dashboard.authenticating")} />;
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
          return t("membershipPlans.connectionError");
        case 'auth':
          return t("membershipPlans.authenticationRequired");
        case 'data':
          return t("membershipPlans.dataNotAvailable");
        default:
          return t("membershipPlans.unableToLoadPlans");
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
              {t("membershipPlans.logInAgain")}
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
                    {t("membershipPlans.retrying")}
                  </>
                ) : (
                  t("membershipPlans.tryAgain")
                )}
              </Button>
              
              {errorType === 'network' && (
                <p className="text-xs text-muted-foreground">
                  {t("membershipPlans.checkConnection")}
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
        currentPlan={currentPlan}
        currentPlanPrice={currentPlanPrice}
      />
    ));
  };

  if (loading || !profile) {
    return <PageLoading text={t("membershipPlans.loadingPlans")} />;
  }

  return (
    <>
      <div className="container mx-auto px-4 lg:px-8 py-8">
              <div className="text-center mb-8">
                <h1 className="text-4xl font-bold mb-4">{t("membershipPlans.title")}</h1>
                <p className="text-muted-foreground text-lg">
                  {t("membershipPlans.choosePlan")}
                </p>
              </div>

              {/* Plan Expiry Alerts */}
              {planStatus && planStatus.status === 'expired' && (
                <Alert variant="destructive" className="mb-6 max-w-3xl mx-auto">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>{t("membershipPlans.planExpired")}</AlertTitle>
                  <AlertDescription>
                    {t("membershipPlans.planExpiredDescription", { plan: currentPlan })}
                  </AlertDescription>
                </Alert>
              )}

              {user && profile && (
                <Alert className="mb-8 max-w-3xl mx-auto">
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    {t("membershipPlans.currentBalance")} <strong><CurrencyDisplay amountUSD={depositBalance} /></strong>
                    {depositBalance === 0 && (
                      <span className="text-muted-foreground">
                        {" "}- {t("membershipPlans.depositFundsDescription")} <Button variant="link" className="p-0 h-auto" onClick={() => navigate("/wallet")}>{t("membershipPlans.depositFunds")}</Button>.
                      </span>
                    )}
                  </AlertDescription>
                </Alert>
              )}

              <PlanTabs
                personalPlans={personalPlans}
                businessPlans={businessPlans}
                renderPlanCards={renderPlanCards}
                currentPlanDisplayName={profile && currentPlan ? (currentPlanObj?.display_name ?? currentPlan) : null}
              />
            </div>

            {/* Upgrade Confirmation Dialog with Proration */}
            <Dialog open={showUpgradeDialog} onOpenChange={setShowUpgradeDialog}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t("membershipPlans.confirmUpgrade")}</DialogTitle>
                  <DialogDescription>
                    {t("membershipPlans.confirmUpgradeDescription", { plan: selectedPlan?.display_name })}
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">{t("membershipPlans.currentBalanceLabel")}</span>
                    <span className="font-semibold"><CurrencyDisplay amountUSD={depositBalance} /></span>
                  </div>

                  {prorationDetails ? (
                    <>
                      <div className="border-t pt-4 space-y-3">
                        <div className="bg-primary/5 rounded-lg p-3 space-y-2">
                          <div className="font-semibold text-sm flex items-center gap-2">
                            <TrendingUp className="h-4 w-4 text-primary" />
                            {t("membershipPlans.prorationApplied")}
                          </div>
                          <div className="space-y-1 text-sm">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">{t("membershipPlans.originalPrice")}</span>
                              <span className="line-through"><CurrencyDisplay amountUSD={parseFloat(prorationDetails.originalPrice)} /></span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">{t("membershipPlans.credit", { days: prorationDetails.daysRemaining })}</span>
                              <span className="text-green-600">-<CurrencyDisplay amountUSD={parseFloat(prorationDetails.credit)} /></span>
                            </div>
                            <div className="flex justify-between font-bold text-base border-t pt-2">
                              <span>{t("membershipPlans.youPay")}</span>
                              <span className="text-primary"><CurrencyDisplay amountUSD={parseFloat(prorationDetails.newCost)} /></span>
                            </div>
                          </div>
                        </div>
                        <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg p-2 text-center">
                          <span className="text-sm text-green-700 dark:text-green-400 font-semibold">
                            {t("membershipPlans.youSaveAmount")} <CurrencyDisplay amountUSD={parseFloat(prorationDetails.savings)} /> {t("membershipPlans.withProration")}
                          </span>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="flex justify-between items-center border-t pt-4">
                      <span className="text-muted-foreground">{t("membershipPlans.upgradeCost")}</span>
                      <span className="font-bold text-xl text-primary"><CurrencyDisplay amountUSD={selectedPlan?.price || 0} /></span>
                    </div>
                  )}

                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">{t("membershipPlans.balanceAfter")}</span>
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
                    {t("membershipPlans.cancel")}
                  </Button>
                  <Button onClick={confirmUpgrade}>
                    {t("membershipPlans.confirmUpgradeButton")}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
    </>
  );
}