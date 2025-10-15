import { useEffect, useState, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sidebar } from "@/components/layout/Sidebar";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Check, Loader2, Info, AlertCircle, Clock, TrendingUp, DollarSign } from "lucide-react";
import { PlanCardSkeleton } from "@/components/membership/PlanCardSkeleton";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { comparePlans } from "@/lib/plan-utils";
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
  const [profile, setProfile] = useState<any>(null);
  const [plans, setPlans] = useState<MembershipPlan[]>([]);
  const [currentPlan, setCurrentPlan] = useState<string>("free");
  const [depositBalance, setDepositBalance] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errorType, setErrorType] = useState<'network' | 'auth' | 'data' | 'unknown' | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [upgrading, setUpgrading] = useState<string | null>(null);
  const [showUpgradeDialog, setShowUpgradeDialog] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<MembershipPlan | null>(null);
  const [prorationDetails, setProrationDetails] = useState<any>(null);

  // Cache key for plans data
  const PLANS_CACHE_KEY = 'membership_plans_cache';
  const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  useEffect(() => {
    loadPlans();
    loadUserProfile();
  }, []);

  const loadPlans = useCallback(async () => {
    try {
      setError(null);
      setErrorType(null);
      
      // Check cache first
      const cachedData = sessionStorage.getItem(PLANS_CACHE_KEY);
      if (cachedData) {
        const { data: cachedPlans, timestamp } = JSON.parse(cachedData);
        if (Date.now() - timestamp < CACHE_DURATION) {
          setPlans(cachedPlans);
          setLoading(false);
          setRetrying(false);
          return;
        }
      }
      
      const { data, error } = await supabase
        .from("membership_plans")
        .select("*")
        .eq("is_active", true)
        .order("price", { ascending: true });

      if (error) {
        // Determine error type
        if (error.message?.includes('Failed to fetch') || error.message?.includes('network')) {
          setErrorType('network');
          setError("Network connection failed. Please check your internet connection and try again.");
        } else if (error.message?.includes('JWT') || error.message?.includes('auth')) {
          setErrorType('auth');
          setError("Authentication error. Please log in again.");
        } else {
          setErrorType('data');
          setError("Unable to load membership plans. Please try again.");
        }
        throw error;
      }
      
      if (!data || data.length === 0) {
        setErrorType('data');
        setError("No membership plans are currently available. Please contact support.");
        return;
      }
      
      // Cache the data
      sessionStorage.setItem(PLANS_CACHE_KEY, JSON.stringify({
        data,
        timestamp: Date.now()
      }));
      
      setPlans(data);
    } catch (error: any) {
      console.error("Failed to load plans:", error);
      
      // Only show toast if not already setting a specific error
      if (!errorType) {
        const isNetworkError = !navigator.onLine || error.message?.includes('Failed to fetch');
        if (isNetworkError) {
          setErrorType('network');
          setError("Network connection failed. Please check your internet connection and try again.");
        } else {
          setErrorType('unknown');
          setError("An unexpected error occurred. Please try again.");
        }
        toast.error(isNetworkError ? "No internet connection" : "Failed to load membership plans");
      }
    } finally {
      setLoading(false);
      setRetrying(false);
    }
  }, [PLANS_CACHE_KEY, CACHE_DURATION, errorType]);

  const loadUserProfile = useCallback(async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (error) {
        // Determine specific error
        if (error.message?.includes('Failed to fetch') || error.message?.includes('network')) {
          toast.error("Network error while loading profile. Some features may be limited.");
        } else if (error.code === 'PGRST116') {
          toast.error("Profile not found. Please contact support.");
        } else {
          toast.error("Failed to load your profile. Please refresh the page.");
        }
        throw error;
      }
      
      setProfile(data);
      setCurrentPlan(data?.membership_plan || "free");
      setDepositBalance(parseFloat(String(data?.deposit_wallet_balance || 0)));
    } catch (error: any) {
      console.error("Failed to load profile:", error);
      // Error toast already shown above
    }
  }, [user]);

  // Memoized earning potential calculations
  const earningPotentials = useMemo(() => {
    const potentials: Record<string, { daily: number; weekly: number; monthly: number } | null> = {};
    
    plans.forEach(plan => {
      if (plan.name === 'free') {
        potentials[plan.id] = null;
      } else {
        const daily = plan.daily_task_limit * plan.earning_per_task;
        potentials[plan.id] = {
          daily,
          weekly: daily * 7,
          monthly: daily * 30
        };
      }
    });
    
    return potentials;
  }, [plans]);

  // Memoized plan status check
  const planStatus = useMemo(() => {
    if (!profile || !profile.plan_expires_at) return null;
    
    const now = new Date();
    const expiryDate = new Date(profile.plan_expires_at);
    const daysUntilExpiry = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysUntilExpiry < 0) {
      return { status: 'expired', daysUntilExpiry: 0 };
    } else if (daysUntilExpiry <= 7) {
      return { status: 'expiring_soon', daysUntilExpiry };
    }
    return null;
  }, [profile]);

  const handleUpgradeClick = async (plan: MembershipPlan) => {
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
  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col lg:flex-row">
        <Sidebar profile={null} isAdmin={false} onSignOut={signOut} />
        <main className="flex-1 overflow-auto lg:mt-0 mt-16">
          <div className="container mx-auto px-4 lg:px-8 py-8">
            <div className="text-center mb-8">
              <h1 className="text-4xl font-bold mb-4">Membership Plans</h1>
              <p className="text-muted-foreground text-lg">
                Choose the perfect plan to maximize your earnings
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
              {[1, 2, 3, 4].map((i) => (
                <PlanCardSkeleton key={i} />
              ))}
            </div>
          </div>
        </main>
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

    const handleRetry = async () => {
      setRetrying(true);
      setError(null);
      setErrorType(null);
      
      // Check network connectivity first
      if (!navigator.onLine) {
        toast.error("No internet connection. Please check your network.");
        setRetrying(false);
        return;
      }
      
      await loadPlans();
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
                onClick={handleRetry}
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

  return (
    <div className="min-h-screen bg-background flex flex-col lg:flex-row">
      <Sidebar profile={profile || null} isAdmin={isAdmin} onSignOut={signOut} />
      
      <main className="flex-1 overflow-auto lg:mt-0 mt-16">
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

          {user && profile && (
            <Alert className="mb-8 max-w-3xl mx-auto">
              <Info className="h-4 w-4" />
              <AlertDescription>
                Your current deposit wallet balance: <strong>${depositBalance.toFixed(2)}</strong>
                {depositBalance === 0 && (
                  <span className="text-muted-foreground">
                    {" "}- Please <Button variant="link" className="p-0 h-auto" onClick={() => navigate("/wallet")}>deposit funds</Button> to upgrade your plan.
                  </span>
                )}
              </AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
            {loading && plans.length === 0 ? (
              // Show skeleton loaders during initial data fetch
              [1, 2, 3, 4].map((i) => <PlanCardSkeleton key={i} />)
            ) : (
              plans.map((plan) => {
                const earningPotential = earningPotentials[plan.id];
                
                return (
                  <Card
                    key={plan.id}
                    className={`relative flex flex-col ${
                      profile && plan.name === currentPlan ? "border-primary shadow-lg" : ""
                    }`}
                  >
                  {profile && plan.name === currentPlan && (
                    <Badge className="absolute -top-3 left-1/2 -translate-x-1/2">
                      Current Plan
                    </Badge>
                  )}
                  
                  <CardHeader>
                    <CardTitle className="text-2xl">{plan.display_name}</CardTitle>
                    <CardDescription className="text-3xl font-bold mt-2">
                      ${plan.price}
                      <span className="text-sm font-normal text-muted-foreground">
                        /{plan.billing_period_days} days
                      </span>
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="space-y-4 flex-1">
                    {/* Earning Potential - Show for all plans except free */}
                    {earningPotential && (
                      <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 space-y-2">
                        <div className="flex items-center gap-2 text-primary mb-2">
                          <TrendingUp className="h-4 w-4" />
                          <span className="font-semibold text-sm">Earning Potential</span>
                        </div>
                        <div className="space-y-1 text-sm">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Daily:</span>
                            <span className="font-bold">${earningPotential.daily.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Weekly:</span>
                            <span className="font-bold">${earningPotential.weekly.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Monthly:</span>
                            <span className="font-bold">${earningPotential.monthly.toFixed(2)}</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Free Plan Specifics */}
                    {plan.name === 'free' && (
                      <div className="bg-muted/50 rounded-lg p-3 space-y-2 text-sm">
                        {plan.free_plan_expiry_days && (
                          <div className="flex items-center gap-2">
                            <Clock className="h-3 w-3" />
                            <span>Free trial: {plan.free_plan_expiry_days} days</span>
                          </div>
                        )}
                        {plan.free_unlock_withdrawal_enabled && plan.free_unlock_withdrawal_days && (
                          <div className="flex items-center gap-2">
                            <DollarSign className="h-3 w-3" />
                            <span>Withdrawals unlock after {plan.free_unlock_withdrawal_days} active days</span>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-primary" />
                        <span className="text-sm">{plan.daily_task_limit} tasks/day</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-primary" />
                        <span className="text-sm">${plan.earning_per_task} per task</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-primary" />
                        <span className="text-sm">{plan.task_skip_limit_per_day} skips/day</span>
                      </div>
                      {plan.task_commission_rate > 0 && (
                        <div className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-primary" />
                          <span className="text-sm">{(plan.task_commission_rate * 100).toFixed(1)}% task commission</span>
                        </div>
                      )}
                      {plan.deposit_commission_rate > 0 && (
                        <div className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-primary" />
                          <span className="text-sm">{(plan.deposit_commission_rate * 100).toFixed(1)}% deposit commission</span>
                        </div>
                      )}
                    </div>

                    {Array.isArray(plan.features) && plan.features.length > 0 && (
                      <div className="border-t pt-4 space-y-1">
                        {plan.features.map((feature: string, idx: number) => (
                          <div key={idx} className="flex items-start gap-2">
                            <Check className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                            <span className="text-sm">{feature}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>

                  <CardFooter className="flex flex-col gap-2">
                    {user && depositBalance < plan.price && plan.name !== currentPlan && plan.price > 0 && (
                      <div className="text-xs text-destructive text-center space-y-1">
                        <p>Insufficient balance</p>
                        <p>Need <strong>${(plan.price - depositBalance).toFixed(2)}</strong> more</p>
                        <Button
                          variant="link"
                          size="sm"
                          className="h-auto p-0 text-xs"
                          onClick={() => navigate("/wallet")}
                        >
                          Go to Wallet
                        </Button>
                      </div>
                    )}
                    <Button
                      className="w-full"
                      onClick={() => handleUpgradeClick(plan)}
                      disabled={
                        !profile ||
                        plan.name === currentPlan || 
                        upgrading === plan.id || 
                        (depositBalance < plan.price && plan.price > 0) ||
                        plan.name === "free"
                      }
                      variant={plan.name === currentPlan ? "outline" : "default"}
                    >
                      {upgrading === plan.id ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Upgrading...
                        </>
                      ) : plan.name === currentPlan ? (
                        "Current Plan"
                      ) : plan.name === "free" ? (
                        "Cannot Downgrade"
                      ) : !profile ? (
                        "Loading..."
                      ) : (
                        "Upgrade Now"
                      )}
                    </Button>
                  </CardFooter>
                </Card>
              );
            })
            )}
          </div>
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
                <span className="font-semibold">${depositBalance.toFixed(2)}</span>
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
                          <span className="line-through">${prorationDetails.originalPrice}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Credit ({prorationDetails.daysRemaining} days unused):</span>
                          <span className="text-green-600">-${prorationDetails.credit}</span>
                        </div>
                        <div className="flex justify-between font-bold text-base border-t pt-2">
                          <span>You Pay:</span>
                          <span className="text-primary">${prorationDetails.newCost}</span>
                        </div>
                      </div>
                    </div>
                    <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg p-2 text-center">
                      <span className="text-sm text-green-700 dark:text-green-400 font-semibold">
                        You save ${prorationDetails.savings} with proration!
                      </span>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex justify-between items-center border-t pt-4">
                  <span className="text-muted-foreground">Upgrade Cost:</span>
                  <span className="font-bold text-xl text-primary">${selectedPlan?.price.toFixed(2)}</span>
                </div>
              )}

              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Balance After:</span>
                <span className="font-semibold">
                  ${(depositBalance - parseFloat(prorationDetails?.newCost || selectedPlan?.price || 0)).toFixed(2)}
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