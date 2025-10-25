import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Loader2, Clock, TrendingUp, DollarSign } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { CurrencyDisplay } from "@/components/ui/CurrencyDisplay";

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
}

export function PlanCard({
  plan,
  isCurrentPlan,
  earningPotential,
  depositBalance,
  upgrading,
  onUpgradeClick,
  hasProfile
}: PlanCardProps) {
  const navigate = useNavigate();
  const isInsufficientBalance = depositBalance < plan.price && plan.name !== 'free' && !isCurrentPlan && plan.price > 0;

  // Plan-specific gradient border colors
  const getBorderColorClass = () => {
    if (isCurrentPlan) return "border-primary shadow-lg";
    
    const planNameLower = plan.name.toLowerCase();
    if (planNameLower === 'free') return "border-border";
    if (planNameLower.includes('basic')) return "border-blue-500 shadow-blue-100 dark:shadow-blue-900/20";
    if (planNameLower.includes('premium')) return "border-purple-500 shadow-purple-100 dark:shadow-purple-900/20";
    if (planNameLower.includes('pro')) return "border-amber-500 shadow-amber-100 dark:shadow-amber-900/20";
    
    return "border-border";
  };

  return (
    <Card className={`relative flex flex-col ${getBorderColorClass()}`}>
      {isCurrentPlan && (
        <Badge className="absolute -top-3 left-1/2 -translate-x-1/2">
          Current Plan
        </Badge>
      )}
      
      <CardHeader>
        <CardTitle className="text-2xl">
          {plan.name !== 'free' && '👑 '}
          {plan.display_name}
        </CardTitle>
        <CardDescription className="text-4xl font-extrabold mt-2">
          <span className="bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
            <CurrencyDisplay amountUSD={plan.price} />
          </span>
          <span className="text-sm font-normal text-muted-foreground ml-2">
            /{plan.billing_period_days} days
          </span>
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4 flex-1">
        {/* Earning Potential */}
        {earningPotential && (
          <div className="bg-gradient-to-br from-primary/10 to-primary/5 border-2 border-primary/30 rounded-lg p-3 space-y-2">
            <div className="flex items-center gap-2 text-primary mb-2">
              <TrendingUp className="h-4 w-4" />
              <span className="font-semibold text-sm">Earning Potential</span>
            </div>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Weekly:</span>
                <span className="font-bold"><CurrencyDisplay amountUSD={earningPotential.weekly} /></span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Monthly:</span>
                <span className="font-bold"><CurrencyDisplay amountUSD={earningPotential.monthly} /></span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Quarterly:</span>
                <span className="font-bold"><CurrencyDisplay amountUSD={earningPotential.quarterly} /></span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Annually:</span>
                <span className="font-bold"><CurrencyDisplay amountUSD={earningPotential.annually} /></span>
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
      </CardContent>

      <CardFooter className="flex flex-col gap-2">
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
          className="w-full"
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
