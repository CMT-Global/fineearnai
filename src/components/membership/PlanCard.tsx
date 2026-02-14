import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Loader2, Clock, TrendingUp, DollarSign, X, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { CurrencyDisplay } from "@/components/ui/CurrencyDisplay";
import { Alert, AlertDescription } from "@/components/ui/alert";

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

interface PlanCardProps {
  plan: MembershipPlan;
  isCurrentPlan: boolean;
  earningPotential: { daily: number; weekly: number; monthly: number; quarterly: number; sixMonthly: number; annually: number } | null;
  depositBalance: number;
  upgrading: boolean;
  onUpgradeClick: (plan: MembershipPlan) => void;
  hasProfile: boolean;
  variant?: 'vertical' | 'horizontal';
  freePlanEarning?: number; // For comparison calculations
  currentPlan?: string; // Current plan name for downgrade detection
  currentPlanPrice?: number; // Current plan price for downgrade detection
}

export function PlanCard({
  plan,
  isCurrentPlan,
  earningPotential,
  depositBalance,
  upgrading,
  onUpgradeClick,
  hasProfile,
  variant = 'vertical',
  freePlanEarning = 0,
  currentPlan,
  currentPlanPrice = 0
}: PlanCardProps) {
  const navigate = useNavigate();
  const isBusinessAccount = plan.account_type?.toLowerCase() === 'business';
  const isDefaultPlan = plan.account_type?.toLowerCase() === 'free';
  const isInsufficientBalance = depositBalance < plan.price && !isDefaultPlan && !isCurrentPlan && plan.price > 0;

  // Default/free tier: no monthly/yearly earning potential (trial expires in X days)
  const isTraineeOrFreePlan = isDefaultPlan || (plan.free_plan_expiry_days != null && plan.free_plan_expiry_days > 0);

  // ✅ PRIMARY: Price-based downgrade detection (single source of truth from DB)
  const isPriceDowngrade = currentPlanPrice > 0 && plan.price < currentPlanPrice;
  const isDowngrade = !isCurrentPlan && isPriceDowngrade;

  // Calculate annual savings vs default (free tier) plan
  const annualSavingsVsFree = !isDefaultPlan && freePlanEarning > 0 && earningPotential
    ? earningPotential.annually - (freePlanEarning * 365)
    : null;

  // Calculate daily cost
  const dailyCost = plan.price > 0 ? (plan.price / plan.billing_period_days).toFixed(2) : null;

  // Plan-specific gradient themes by account_type from DB (no hardcoded plan names)
  const getCardStyles = () => {
    const accountType = plan.account_type?.toLowerCase() ?? '';
    if (isCurrentPlan) {
      return "border-2 border-primary shadow-lg bg-gradient-to-br from-primary/5 to-primary/10";
    }
    if (accountType === 'free') {
      return "border-2 border-dashed border-muted-foreground/30 bg-muted/20 opacity-95 hover:opacity-100 transition-all duration-300";
    }
    if (accountType === 'personal') {
      return "border-2 border-transparent bg-gradient-to-br from-blue-500/10 via-cyan-500/10 to-blue-500/5 hover:from-blue-500/20 hover:via-cyan-500/20 hover:to-blue-500/10 hover:shadow-2xl hover:shadow-blue-500/20 transition-all duration-300 hover:scale-105 hover:-rotate-1";
    }
    if (accountType === 'business') {
      return "border-2 border-transparent bg-gradient-to-br from-amber-500/15 via-yellow-500/15 to-amber-500/10 hover:from-amber-500/25 hover:via-yellow-500/25 hover:to-amber-500/20 hover:shadow-2xl hover:shadow-amber-500/30 transition-all duration-300 hover:scale-105 hover:rotate-1";
    }
    if (accountType === 'group') {
      return "border-2 border-transparent bg-gradient-to-br from-violet-500/15 via-purple-500/15 to-violet-500/10 hover:from-violet-500/25 hover:via-purple-500/25 hover:to-violet-500/20 hover:shadow-2xl hover:shadow-violet-500/30 transition-all duration-300 hover:scale-105 hover:rotate-1";
    }
    return "border-2 border-border hover:shadow-xl transition-all duration-300";
  };

  // Get badge for special plans by account_type (optional: could add a DB field like "badge" later)
  const getSpecialBadge = () => {
    const accountType = plan.account_type?.toLowerCase() ?? '';
    if (accountType === 'business') {
      return (
        <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-amber-500 to-orange-500 text-white border-0">
          🏆 Best Value
        </Badge>
      );
    }
    if (accountType === 'group') {
      return (
        <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-purple-500 to-pink-500 text-white border-0 animate-pulse">
          ⭐ Most Popular
        </Badge>
      );
    }
    return null;
  };


  // Horizontal layout for Free Trial card
  if (variant === 'horizontal') {
    return (
      <Card className={`relative ${getCardStyles()} animate-fade-in`}>
        {/* START HERE Banner */}
        {isDefaultPlan && (
          <div className="bg-gradient-to-r from-blue-500 to-cyan-500 text-white text-center py-2 rounded-t-lg">
            <span className="font-bold text-xs sm:text-sm uppercase tracking-wider">🎯 Free Trial Account</span>
          </div>
        )}

        {isCurrentPlan && (
          <Badge className="absolute top-14 sm:top-4 right-4 text-xs z-10">
            Current Plan
          </Badge>
        )}

        <div className="p-4 sm:p-6">
          <div className="flex flex-col lg:flex-row gap-4 sm:gap-6 items-stretch lg:items-start">
            {/* Left Section - Price & Title - Stack on Mobile */}
            <div className="flex-shrink-0 w-full lg:w-1/4">
              <CardTitle className="text-xl sm:text-2xl mb-2">
                {plan.display_name}
              </CardTitle>
              <div className="flex items-baseline gap-1 flex-wrap">
                <div className="text-2xl sm:text-3xl lg:text-4xl font-extrabold">
                  <span className="bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
                    <CurrencyDisplay amountUSD={plan.price} />
                  </span>
                </div>
                <div className="text-xs sm:text-sm text-muted-foreground">
                  Subscription Valid: {isDefaultPlan && plan.free_plan_expiry_days 
                    ? plan.free_plan_expiry_days 
                    : plan.billing_period_days} days
                </div>
              </div>

              {/* Daily cost breakdown for paid plans */}
              {dailyCost && !isDefaultPlan && (
                <div className="text-xs text-muted-foreground mt-2 animate-fade-in">
                  Costs just <CurrencyDisplay amountUSD={parseFloat(dailyCost)} showTooltip={false} className="font-semibold text-primary inline" /> per day
                </div>
              )}
              
              {/* Warning Badge */}
              {isDefaultPlan && (
                <div className="mt-4 bg-gradient-to-r from-amber-100 to-orange-100 dark:from-amber-950 dark:to-orange-950 border-2 border-amber-400 dark:border-amber-700 rounded-lg p-3 animate-pulse">
                  <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 font-semibold text-xs sm:text-sm">
                    ⚠️ Limited Earnings - Upgrade to Unlock
                  </div>
                  <div className="text-xs text-amber-700 dark:text-amber-400 mt-1">
                    You're missing out on higher rates & commissions
                  </div>
                </div>
              )}
            </div>

            {/* Middle Section - Features - Full Width on Mobile */}
            <div className="flex-1 w-full lg:w-1/2">
              <div className="space-y-2 sm:space-y-3">
                <div className="flex items-center gap-2 min-h-[44px] sm:min-h-0">
                  <Check className="h-4 w-4 sm:h-5 sm:w-5 text-blue-500 flex-shrink-0" />
                  <span className="text-sm">{plan.daily_task_limit} tasks/day</span>
                </div>
                <div className="flex items-center gap-2 min-h-[44px] sm:min-h-0">
                  <Check className="h-4 w-4 sm:h-5 sm:w-5 text-green-500 flex-shrink-0" />
                  <span className="text-sm"><CurrencyDisplay amountUSD={plan.earning_per_task} /> per task</span>
                </div>
                <div className="flex items-center gap-2 min-h-[44px] sm:min-h-0">
                  <Check className="h-4 w-4 sm:h-5 sm:w-5 text-orange-500 flex-shrink-0" />
                  <span className="text-sm">{plan.task_skip_limit_per_day} skips/day</span>
                </div>
                <div className="flex items-center gap-2 min-h-[44px] sm:min-h-0">
                  <Check className="h-4 w-4 sm:h-5 sm:w-5 text-cyan-500 flex-shrink-0" />
                  <span className="text-sm">Min withdrawal: <CurrencyDisplay amountUSD={plan.min_withdrawal} /></span>
                </div>
                {plan.task_commission_rate > 0 && (
                  <div className="flex items-center gap-2 min-h-[44px] sm:min-h-0">
                    <Check className="h-4 w-4 sm:h-5 sm:w-5 text-purple-500 flex-shrink-0" />
                    <span className="text-sm">
                      {(plan.task_commission_rate * 100).toFixed(1)}% task commission
                    </span>
                  </div>
                )}
                {plan.deposit_commission_rate > 0 && (
                  <div className="flex items-center gap-2 min-h-[44px] sm:min-h-0">
                    <Check className="h-4 w-4 sm:h-5 sm:w-5 text-purple-500 flex-shrink-0" />
                    <span className="text-sm">{(plan.deposit_commission_rate * 100).toFixed(1)}% deposit commission</span>
                  </div>
                )}

                {/* Default (free tier) plan specifics */}
                {isDefaultPlan && (
                  <div className="bg-muted/50 rounded-lg p-3 space-y-2 text-sm mt-4">
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

                {/* What Free Users DON'T Get - Strikethrough Features */}
                {isDefaultPlan && (
                  <div className="mt-4 space-y-2 border-t pt-3">
                    <div className="text-xs font-semibold text-muted-foreground mb-2">What you're missing:</div>
                    <div className="flex items-center gap-2 opacity-60">
                      <X className="h-4 w-4 text-red-500" />
                      <span className="text-sm line-through">Higher earning rates</span>
                    </div>
                    <div className="flex items-center gap-2 opacity-60">
                      <X className="h-4 w-4 text-red-500" />
                      <span className="text-sm line-through">Referral commissions from tasks</span>
                    </div>
                    <div className="flex items-center gap-2 opacity-60">
                      <X className="h-4 w-4 text-red-500" />
                      <span className="text-sm line-through">Deposit commissions from referrals</span>
                    </div>
                    <div className="flex items-center gap-2 opacity-60">
                      <X className="h-4 w-4 text-red-500" />
                      <span className="text-sm line-through">More daily tasks</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Savings Comparison vs Free Plan - Horizontal */}
              {annualSavingsVsFree && annualSavingsVsFree > 0 && (
                <div className="bg-gradient-to-r from-blue-500/10 to-cyan-500/10 border-2 border-blue-500/30 rounded-lg p-3 mt-4 text-center animate-fade-in">
                  <div className="text-xs text-muted-foreground mb-1">Annual Advantage</div>
                  <div className="text-sm font-bold text-blue-600 dark:text-blue-400">
                    Earn <CurrencyDisplay amountUSD={annualSavingsVsFree} /> more per year
                  </div>
                </div>
              )}
            </div>

            {/* Right Section - Earning Potential & CTA - Stack on Mobile */}
            <div className="flex-shrink-0 w-full lg:w-1/4 space-y-4">
              {earningPotential && !isTraineeOrFreePlan && (
                <div className="relative overflow-hidden backdrop-blur-lg bg-gradient-to-br from-primary/20 to-primary/5 border-2 border-primary/40 rounded-lg p-3 hover:shadow-lg transition-shadow duration-300">
                  <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent pointer-events-none"></div>
                  <div className="relative z-10">
                    <div className="flex items-center gap-2 text-primary mb-2">
                      <TrendingUp className="h-4 w-4 animate-pulse" />
                      <span className="font-semibold text-xs">Earning Potential</span>
                    </div>
                    <div className="space-y-1 text-xs">
                      <div className="flex justify-between items-center min-h-[32px] sm:min-h-0">
                        <span className="text-muted-foreground">Monthly:</span>
                        <span className="font-bold"><CurrencyDisplay amountUSD={earningPotential.monthly} /></span>
                      </div>
                      <div className="flex justify-between items-center min-h-[32px] sm:min-h-0">
                        <span className="text-muted-foreground">{isBusinessAccount ? '6 Months:' : 'Annually:'}</span>
                        <span className="font-bold"><CurrencyDisplay amountUSD={isBusinessAccount ? earningPotential.sixMonthly : earningPotential.annually} /></span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Upgrade CTA for Free Trial - Prominent Button */}
              {isDefaultPlan && (
                <Alert className="bg-gradient-to-r from-primary/10 to-primary/5 border-2 border-primary/30">
                  <AlertDescription className="flex items-center justify-between gap-3">
                    <div className="flex-1">
                      <div className="font-semibold text-xs sm:text-sm mb-1">🚀 Unlock Full Potential</div>
                      <div className="text-xs text-muted-foreground">
                        See how much more you could earn with premium plans
                      </div>
                    </div>
                    <ArrowRight className="h-4 w-4 sm:h-5 sm:w-5 text-primary animate-bounce flex-shrink-0" style={{ animationDirection: 'alternate' }} />
                  </AlertDescription>
                </Alert>
              )}

              {/* Insufficient Balance Alert - Always Visible */}
              {isInsufficientBalance && !isCurrentPlan && !isDowngrade && (
                <Alert variant="destructive" className="w-full">
                  <AlertDescription className="text-xs text-center space-y-1">
                    <p>Insufficient balance</p>
                    <p>Deposit <strong><CurrencyDisplay amountUSD={plan.price - depositBalance} /></strong> more</p>
                  <Button
                    variant="link"
                    size="sm"
                    className="h-auto p-0 text-xs text-destructive-foreground underline touch-manipulation min-h-[32px] active:opacity-70 [-webkit-tap-highlight-color:transparent]"
                    onClick={() => navigate("/wallet")}
                  >
                    Go to Wallet
                  </Button>
                  </AlertDescription>
                </Alert>
              )}

              <Button
                className={`w-full min-h-[44px] h-12 sm:h-10 text-base sm:text-sm transition-all duration-300 touch-manipulation active:scale-95 [-webkit-tap-highlight-color:transparent] ${
                  isDowngrade || isCurrentPlan
                    ? 'opacity-60 cursor-not-allowed hover:scale-100' 
                    : 'hover:scale-105 hover:shadow-xl active:shadow-lg'
                }`}
                onClick={() => !isDowngrade && !isCurrentPlan && onUpgradeClick(plan)}
                disabled={
                  !hasProfile ||
                  isCurrentPlan || 
                  upgrading || 
                  isDowngrade
                }
                variant={isCurrentPlan || isDowngrade ? "secondary" : "default"}
              >
                {upgrading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Upgrading...
                  </>
                ) : isCurrentPlan ? (
                  "Current Plan"
                ) : isDowngrade ? (
                  "Cannot Downgrade"
                ) : !hasProfile ? (
                  "Loading..."
                ) : isInsufficientBalance ? (
                  <>
                    You Need <CurrencyDisplay amountUSD={plan.price - depositBalance} className="inline font-bold" /> More
                  </>
                ) : (
                  "Upgrade Now"
                )}
              </Button>
            </div>
          </div>
        </div>
      </Card>
    );
  }

  // Vertical layout (default)
  return (
    <Card className={`relative flex flex-col ${getCardStyles()} animate-fade-in`}>
      {isCurrentPlan && (
        <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-primary to-primary/70">
          Current Plan
        </Badge>
      )}
      
      {/* Special badges for Premium/Pro plans */}
      {!isCurrentPlan && getSpecialBadge()}
      
      <CardHeader className="pb-3 sm:pb-6">
        <CardTitle className="text-xl sm:text-2xl">
          {!isDefaultPlan && '👑 '}
          {plan.display_name}
        </CardTitle>
        <div className="space-y-1 text-sm text-muted-foreground">
          <div className="flex items-baseline gap-1 flex-wrap mt-2">
            <div className="text-2xl sm:text-3xl lg:text-4xl font-extrabold">
              <span className="bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
                <CurrencyDisplay amountUSD={plan.price} />
              </span>
            </div>
            <span className="text-xs sm:text-sm font-normal text-muted-foreground">
              Subscription Valid: {isDefaultPlan && plan.free_plan_expiry_days 
                ? plan.free_plan_expiry_days 
                : plan.billing_period_days} days
            </span>
          </div>
          {/* Daily cost breakdown */}
          {dailyCost && !isDefaultPlan && (
            <div className="text-xs text-muted-foreground animate-fade-in">
              Costs just <CurrencyDisplay amountUSD={parseFloat(dailyCost)} showTooltip={false} className="font-semibold text-primary inline" /> per day
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4 flex-1 pb-4">
        {/* Earning Potential with Glassmorphism - hidden for free/trainee plan */}
        {earningPotential && !isTraineeOrFreePlan && (
          <div className="relative overflow-hidden backdrop-blur-lg bg-gradient-to-br from-primary/20 to-primary/5 border-2 border-primary/40 rounded-lg p-3 space-y-2 hover:shadow-lg hover:scale-105 transition-all duration-300">
            <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent pointer-events-none"></div>
            <div className="relative z-10">
              <div className="flex items-center gap-2 text-primary mb-2">
                <TrendingUp className="h-4 w-4 animate-pulse" />
                <span className="font-semibold text-sm">Earning Potential</span>
              </div>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between animate-fade-in">
                  <span className="text-muted-foreground">Weekly:</span>
                  <span className="font-bold"><CurrencyDisplay amountUSD={earningPotential.weekly} /></span>
                </div>
                <div className="flex justify-between animate-fade-in" style={{ animationDelay: '0.1s' }}>
                  <span className="text-muted-foreground">Monthly:</span>
                  <span className="font-bold"><CurrencyDisplay amountUSD={earningPotential.monthly} /></span>
                </div>
                <div className="flex justify-between animate-fade-in" style={{ animationDelay: '0.2s' }}>
                  <span className="text-muted-foreground">Quarterly:</span>
                  <span className="font-bold"><CurrencyDisplay amountUSD={earningPotential.quarterly} /></span>
                </div>
                <div className="flex justify-between animate-fade-in" style={{ animationDelay: '0.3s' }}>
                  <span className="text-muted-foreground">{isBusinessAccount ? '6 Months:' : 'Annually:'}</span>
                  <span className="font-bold"><CurrencyDisplay amountUSD={isBusinessAccount ? earningPotential.sixMonthly : earningPotential.annually} /></span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Default (free tier) plan specifics */}
        {isDefaultPlan && (
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

        {/* Features - Touch-optimized */}
        <div className="space-y-2 sm:space-y-3">
          <div className="flex items-center gap-2 min-h-[44px] sm:min-h-0">
            <Check className="h-4 w-4 sm:h-5 sm:w-5 text-blue-500 flex-shrink-0" />
            <span className="text-sm">{plan.daily_task_limit} tasks/day</span>
          </div>
          <div className="flex items-center gap-2 min-h-[44px] sm:min-h-0">
            <Check className="h-4 w-4 sm:h-5 sm:w-5 text-green-500 flex-shrink-0" />
            <span className="text-sm"><CurrencyDisplay amountUSD={plan.earning_per_task} /> per task</span>
          </div>
          <div className="flex items-center gap-2 min-h-[44px] sm:min-h-0">
            <Check className="h-4 w-4 sm:h-5 sm:w-5 text-orange-500 flex-shrink-0" />
            <span className="text-sm">{plan.task_skip_limit_per_day} skips/day</span>
          </div>
          <div className="flex items-center gap-2 min-h-[44px] sm:min-h-0">
            <Check className="h-4 w-4 sm:h-5 sm:w-5 text-cyan-500 flex-shrink-0" />
            <span className="text-sm">Min withdrawal: <CurrencyDisplay amountUSD={plan.min_withdrawal} /></span>
          </div>
          {plan.task_commission_rate > 0 && (
            <div className="flex items-center gap-2 min-h-[44px] sm:min-h-0">
              <Check className="h-4 w-4 sm:h-5 sm:w-5 text-purple-500 flex-shrink-0" />
              <span className="text-sm">
                {(plan.task_commission_rate * 100).toFixed(1)}% task commission
              </span>
            </div>
          )}
          {plan.deposit_commission_rate > 0 && (
            <div className="flex items-center gap-2 min-h-[44px] sm:min-h-0">
              <Check className="h-4 w-4 sm:h-5 sm:w-5 text-purple-500 flex-shrink-0" />
              <span className="text-sm">{(plan.deposit_commission_rate * 100).toFixed(1)}% deposit commission</span>
            </div>
          )}
        </div>

        {/* What default plan users don't get - Strikethrough Features (Vertical) */}
        {isDefaultPlan && (
          <div className="mt-4 space-y-2 border-t pt-3">
            <div className="text-xs font-semibold text-muted-foreground mb-2">What you're missing:</div>
            <div className="flex items-center gap-2 opacity-60">
              <X className="h-4 w-4 text-red-500" />
              <span className="text-sm line-through">Higher earning rates</span>
            </div>
            <div className="flex items-center gap-2 opacity-60">
              <X className="h-4 w-4 text-red-500" />
              <span className="text-sm line-through">Referral commissions from tasks</span>
            </div>
            <div className="flex items-center gap-2 opacity-60">
              <X className="h-4 w-4 text-red-500" />
              <span className="text-sm line-through">Deposit commissions from referrals</span>
            </div>
            <div className="flex items-center gap-2 opacity-60">
              <X className="h-4 w-4 text-red-500" />
              <span className="text-sm line-through">Unlimited daily tasks</span>
            </div>
          </div>
        )}

        {/* Savings Comparison vs Free Plan */}
        {annualSavingsVsFree && annualSavingsVsFree > 0 && (
          <div className="bg-gradient-to-r from-blue-500/10 to-cyan-500/10 border-2 border-blue-500/30 rounded-lg p-3 text-center animate-fade-in">
            <div className="text-xs text-muted-foreground mb-1">Annual Advantage</div>
            <div className="text-sm font-bold text-blue-600 dark:text-blue-400">
              Earn <CurrencyDisplay amountUSD={annualSavingsVsFree} /> more per year than Free Trial
            </div>
          </div>
        )}
      </CardContent>

      <CardFooter className="flex flex-col gap-2 relative p-4 sm:p-6">
        {/* Upgrade CTA for default plan - Prominent Alert (Vertical) */}
        {isDefaultPlan && (
          <Alert className="bg-gradient-to-r from-primary/10 to-primary/5 border-2 border-primary/30 w-full">
            <AlertDescription className="flex items-center justify-between gap-3">
              <div className="flex-1">
                <div className="font-semibold text-xs sm:text-sm mb-1">🚀 Unlock Full Potential</div>
                <div className="text-xs text-muted-foreground">
                  See how much more you could earn below
                </div>
              </div>
              <ArrowRight className="h-4 w-4 sm:h-5 sm:w-5 text-primary animate-bounce flex-shrink-0" style={{ animationDirection: 'alternate' }} />
            </AlertDescription>
          </Alert>
        )}

        {/* Insufficient Balance Alert - Always Visible */}
        {isInsufficientBalance && !isCurrentPlan && !isDowngrade && (
          <Alert variant="destructive" className="w-full">
            <AlertDescription className="text-xs text-center space-y-1">
              <p>Insufficient balance</p>
                  <p>Deposit <strong><CurrencyDisplay amountUSD={plan.price - depositBalance} /></strong> More</p>
              <Button
                variant="link"
                size="sm"
                className="h-auto p-0 text-xs text-destructive-foreground underline touch-manipulation min-h-[32px] active:opacity-70 [-webkit-tap-highlight-color:transparent]"
                onClick={() => navigate("/wallet")}
              >
                Go to Wallet
              </Button>
            </AlertDescription>
          </Alert>
        )}

        <Button
          className={`w-full min-h-[44px] h-12 sm:h-10 text-base sm:text-sm transition-all duration-300 touch-manipulation active:scale-95 [-webkit-tap-highlight-color:transparent] ${
            isDowngrade || isCurrentPlan
              ? 'opacity-60 cursor-not-allowed hover:scale-100' 
              : 'hover:scale-105 hover:shadow-xl active:shadow-lg'
          }`}
          onClick={() => !isDowngrade && !isCurrentPlan && onUpgradeClick(plan)}
          disabled={
            !hasProfile ||
            isCurrentPlan || 
            upgrading || 
            isDowngrade
          }
          variant={isCurrentPlan || isDowngrade ? "secondary" : "default"}
        >
          {upgrading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Upgrading...
            </>
          ) : isCurrentPlan ? (
            "Current Plan"
          ) : isDowngrade ? (
            "Cannot Downgrade"
          ) : !hasProfile ? (
            "Loading..."
          ) : isInsufficientBalance ? (
            <>
              You Need <CurrencyDisplay amountUSD={plan.price - depositBalance} className="inline font-bold" /> More
            </>
          ) : (
            "Upgrade Now"
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}
