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
  earningPotential: { daily: number; weekly: number; monthly: number; quarterly: number; annually: number } | null;
  depositBalance: number;
  upgrading: boolean;
  onUpgradeClick: (plan: MembershipPlan) => void;
  hasProfile: boolean;
  variant?: 'vertical' | 'horizontal';
  freePlanEarning?: number; // For comparison calculations
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
  freePlanEarning = 0
}: PlanCardProps) {
  const navigate = useNavigate();
  const isInsufficientBalance = depositBalance < plan.price && plan.name !== 'free' && !isCurrentPlan && plan.price > 0;

  // Calculate break even days for paid plans
  const breakEvenDays = plan.name !== 'free' && plan.price > 0 && plan.earning_per_task > 0 && plan.daily_task_limit > 0
    ? Math.ceil(plan.price / (plan.earning_per_task * plan.daily_task_limit))
    : null;

  // Calculate annual savings vs free plan
  const annualSavingsVsFree = plan.name !== 'free' && freePlanEarning > 0 && earningPotential
    ? earningPotential.annually - (freePlanEarning * 365)
    : null;

  // Calculate daily cost
  const dailyCost = plan.price > 0 ? (plan.price / plan.billing_period_days).toFixed(2) : null;

  // Plan-specific gradient themes with animations
  const getCardStyles = () => {
    const planNameLower = plan.name.toLowerCase();
    
    if (isCurrentPlan) {
      return "border-2 border-primary shadow-lg bg-gradient-to-br from-primary/5 to-primary/10";
    }
    
    if (planNameLower === 'free') {
      return "border-2 border-dashed border-muted-foreground/30 bg-muted/20 opacity-95 hover:opacity-100 transition-all duration-300";
    }
    
    if (planNameLower.includes('basic')) {
      return "border-2 border-transparent bg-gradient-to-br from-blue-500/10 via-cyan-500/10 to-blue-500/5 hover:from-blue-500/20 hover:via-cyan-500/20 hover:to-blue-500/10 hover:shadow-2xl hover:shadow-blue-500/20 transition-all duration-300 hover:scale-105 hover:-rotate-1";
    }
    
    if (planNameLower.includes('premium')) {
      return "border-2 border-transparent bg-gradient-to-br from-purple-500/10 via-pink-500/10 to-purple-500/5 hover:from-purple-500/20 hover:via-pink-500/20 hover:to-purple-500/10 hover:shadow-2xl hover:shadow-purple-500/20 transition-all duration-300 hover:scale-105 hover:-rotate-1 animate-pulse";
    }
    
    if (planNameLower.includes('pro')) {
      return "border-2 border-transparent bg-gradient-to-br from-amber-500/10 via-orange-500/10 to-amber-500/5 hover:from-amber-500/20 hover:via-orange-500/20 hover:to-amber-500/10 hover:shadow-2xl hover:shadow-amber-500/20 transition-all duration-300 hover:scale-105 hover:-rotate-1";
    }
    
    return "border-2 border-border hover:shadow-xl transition-all duration-300";
  };

  // Get badge for special plans
  const getSpecialBadge = () => {
    const planNameLower = plan.name.toLowerCase();
    
    if (planNameLower.includes('premium')) {
      return (
        <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-purple-500 to-pink-500 text-white border-0 animate-pulse">
          ⭐ Most Popular
        </Badge>
      );
    }
    
    if (planNameLower.includes('pro')) {
      return (
        <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-amber-500 to-orange-500 text-white border-0">
          🏆 Best Value
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
        {plan.name === 'free' && (
          <div className="bg-gradient-to-r from-blue-500 to-cyan-500 text-white text-center py-2 rounded-t-lg">
            <span className="font-bold text-sm uppercase tracking-wider">🎯 Start Here - Free Trial</span>
          </div>
        )}

        {/* Prominent Limitation Badge for Free Trial */}
        {plan.name === 'free' && (
          <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-10">
            <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-white border-0 px-4 py-2 text-sm font-bold shadow-lg animate-pulse">
              ⚠️ LIMITED EARNINGS
            </Badge>
          </div>
        )}
        
        {isCurrentPlan && (
          <Badge className="absolute top-4 right-4">
            Current Plan
          </Badge>
        )}

        <div className="p-6">
          <div className="flex flex-col lg:flex-row gap-6 items-start">
            {/* Left Section - Price & Title */}
            <div className="flex-shrink-0 lg:w-1/4">
              <CardTitle className="text-2xl mb-2">
                {plan.display_name}
              </CardTitle>
              <div className="text-4xl font-extrabold">
                <span className="bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
                  <CurrencyDisplay amountUSD={plan.price} />
                </span>
              </div>
              <div className="text-sm text-muted-foreground mt-1">
                /{plan.billing_period_days} days
              </div>

              {/* Daily cost breakdown for paid plans */}
              {dailyCost && plan.name !== 'free' && (
                <div className="text-xs text-muted-foreground mt-2 animate-fade-in">
                  Just <span className="font-semibold text-primary">${dailyCost}</span> per day
                </div>
              )}
              
              {/* Warning Badge */}
              {plan.name === 'free' && (
                <div className="mt-4 bg-gradient-to-r from-amber-100 to-orange-100 dark:from-amber-950 dark:to-orange-950 border-2 border-amber-400 dark:border-amber-700 rounded-lg p-3 animate-pulse">
                  <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 font-semibold text-sm">
                    ⚠️ Limited Earnings - Upgrade to Unlock
                  </div>
                  <div className="text-xs text-amber-700 dark:text-amber-400 mt-1">
                    You're missing out on higher rates & commissions
                  </div>
                </div>
              )}
            </div>

            {/* Middle Section - Features */}
            <div className="flex-1 lg:w-1/2">
              {/* Break Even Calculator for Paid Plans - Horizontal */}
              {breakEvenDays && plan.name !== 'free' && (
                <div className="bg-gradient-to-r from-green-500/10 to-emerald-500/10 border-2 border-green-500/30 rounded-lg p-3 mb-4 animate-fade-in">
                  <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                    <DollarSign className="h-4 w-4 animate-pulse" />
                    <span className="font-semibold text-sm">
                      💰 Break even in {breakEvenDays} days, then pure profit!
                    </span>
                  </div>
                </div>
              )}

              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-blue-500" />
                  <span className="text-sm">{plan.daily_task_limit} tasks/day</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span className="text-sm"><CurrencyDisplay amountUSD={plan.earning_per_task} /> per task</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-orange-500" />
                  <span className="text-sm">{plan.task_skip_limit_per_day} skips/day</span>
                </div>
                {plan.task_commission_rate > 0 && (
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-purple-500" />
                    <span className="text-sm">{(plan.task_commission_rate * 100).toFixed(1)}% task commission</span>
                  </div>
                )}
                {plan.deposit_commission_rate > 0 && (
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-purple-500" />
                    <span className="text-sm">{(plan.deposit_commission_rate * 100).toFixed(1)}% deposit commission</span>
                  </div>
                )}

                {/* Free Plan Specifics */}
                {plan.name === 'free' && (
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
                {plan.name === 'free' && (
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

            {/* Right Section - Earning Potential & CTA */}
            <div className="flex-shrink-0 lg:w-1/4 space-y-4">
              {earningPotential && (
                <div className="relative overflow-hidden backdrop-blur-lg bg-gradient-to-br from-primary/20 to-primary/5 border-2 border-primary/40 rounded-lg p-3 space-y-2 hover:shadow-lg transition-shadow duration-300">
                  <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent pointer-events-none"></div>
                  <div className="relative z-10">
                    <div className="flex items-center gap-2 text-primary mb-2">
                      <TrendingUp className="h-4 w-4 animate-pulse" />
                      <span className="font-semibold text-xs">Earning Potential</span>
                    </div>
                    <div className="space-y-1 text-xs">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Monthly:</span>
                        <span className="font-bold"><CurrencyDisplay amountUSD={earningPotential.monthly} /></span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Annually:</span>
                        <span className="font-bold"><CurrencyDisplay amountUSD={earningPotential.annually} /></span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Upgrade CTA for Free Trial - Prominent Button */}
              {plan.name === 'free' && (
                <Alert className="bg-gradient-to-r from-primary/10 to-primary/5 border-2 border-primary/30 mt-4">
                  <AlertDescription className="flex items-center justify-between gap-3">
                    <div className="flex-1">
                      <div className="font-semibold text-sm mb-1">🚀 Unlock Full Potential</div>
                      <div className="text-xs text-muted-foreground">
                        See how much more you could earn with premium plans
                      </div>
                    </div>
                    <ArrowRight className="h-5 w-5 text-primary animate-bounce" style={{ animationDirection: 'alternate' }} />
                  </AlertDescription>
                </Alert>
              )}

              <Button
                className="w-full transition-all duration-300 hover:scale-105 hover:shadow-xl"
                onClick={() => onUpgradeClick(plan)}
                disabled={
                  !hasProfile ||
                  isCurrentPlan || 
                  upgrading || 
                  isInsufficientBalance ||
                  plan.name === "free"
                }
              >
                {upgrading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Upgrading...
                  </>
                ) : isCurrentPlan ? (
                  "Current Plan"
                ) : plan.name === "free" ? (
                  "Cannot Downgrade"
                ) : !hasProfile ? (
                  "Loading..."
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
      
      <CardHeader>
        <CardTitle className="text-2xl">
          {plan.name !== 'free' && '👑 '}
          {plan.display_name}
        </CardTitle>
        <CardDescription className="space-y-1">
          <div className="text-4xl font-extrabold mt-2">
            <span className="bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
              <CurrencyDisplay amountUSD={plan.price} />
            </span>
            <span className="text-sm font-normal text-muted-foreground ml-2">
              /{plan.billing_period_days} days
            </span>
          </div>
          {/* Daily cost breakdown */}
          {dailyCost && plan.name !== 'free' && (
            <div className="text-xs text-muted-foreground animate-fade-in">
              Just <span className="font-semibold text-primary">${dailyCost}</span> per day
            </div>
          )}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4 flex-1">
        {/* Break Even Calculator for Paid Plans */}
        {breakEvenDays && plan.name !== 'free' && (
          <div className="bg-gradient-to-r from-green-500/10 to-emerald-500/10 border-2 border-green-500/30 rounded-lg p-3 animate-fade-in">
            <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
              <DollarSign className="h-4 w-4 animate-pulse" />
              <span className="font-semibold text-sm">
                💰 Break even in {breakEvenDays} days, then pure profit!
              </span>
            </div>
          </div>
        )}

        {/* Earning Potential with Glassmorphism */}
        {earningPotential && (
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
                  <span className="text-muted-foreground">Annually:</span>
                  <span className="font-bold"><CurrencyDisplay amountUSD={earningPotential.annually} /></span>
                </div>
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

        {/* Features */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Check className="h-4 w-4 text-blue-500" />
            <span className="text-sm">{plan.daily_task_limit} tasks/day</span>
          </div>
          <div className="flex items-center gap-2">
            <Check className="h-4 w-4 text-green-500" />
            <span className="text-sm"><CurrencyDisplay amountUSD={plan.earning_per_task} /> per task</span>
          </div>
          <div className="flex items-center gap-2">
            <Check className="h-4 w-4 text-orange-500" />
            <span className="text-sm">{plan.task_skip_limit_per_day} skips/day</span>
          </div>
          {plan.task_commission_rate > 0 && (
            <div className="flex items-center gap-2">
              <Check className="h-4 w-4 text-purple-500" />
              <span className="text-sm">{(plan.task_commission_rate * 100).toFixed(1)}% task commission</span>
            </div>
          )}
          {plan.deposit_commission_rate > 0 && (
            <div className="flex items-center gap-2">
              <Check className="h-4 w-4 text-purple-500" />
              <span className="text-sm">{(plan.deposit_commission_rate * 100).toFixed(1)}% deposit commission</span>
            </div>
          )}
        </div>

        {/* What Free Users DON'T Get - Strikethrough Features (Vertical) */}
        {plan.name === 'free' && (
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

      <CardFooter className="flex flex-col gap-2">
        {/* Upgrade CTA for Free Trial - Prominent Alert (Vertical) */}
        {plan.name === 'free' && (
          <Alert className="bg-gradient-to-r from-primary/10 to-primary/5 border-2 border-primary/30 w-full">
            <AlertDescription className="flex items-center justify-between gap-3">
              <div className="flex-1">
                <div className="font-semibold text-sm mb-1">🚀 Unlock Full Potential</div>
                <div className="text-xs text-muted-foreground">
                  See how much more you could earn below
                </div>
              </div>
              <ArrowRight className="h-5 w-5 text-primary animate-bounce" style={{ animationDirection: 'alternate' }} />
            </AlertDescription>
          </Alert>
        )}

        {isInsufficientBalance && (
          <div className="text-xs text-destructive text-center space-y-1">
            <p>Insufficient balance</p>
            <p>Need <strong><CurrencyDisplay amountUSD={plan.price - depositBalance} /></strong> more</p>
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
          className="w-full transition-all duration-300 hover:scale-105 hover:shadow-xl"
          onClick={() => onUpgradeClick(plan)}
          disabled={
            !hasProfile ||
            isCurrentPlan || 
            upgrading || 
            isInsufficientBalance ||
            plan.name === "free"
          }
        >
          {upgrading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Upgrading...
            </>
          ) : isCurrentPlan ? (
            "Current Plan"
          ) : plan.name === "free" ? (
            "Cannot Downgrade"
          ) : !hasProfile ? (
            "Loading..."
          ) : (
            "Upgrade Now"
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}
