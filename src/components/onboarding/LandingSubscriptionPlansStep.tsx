import { Check, X, Star } from "lucide-react";
import { useMembershipPlans } from "@/hooks/useMembershipPlans";
import { getHighestTierPlan } from "@/lib/plan-utils";

export default function LandingSubscriptionPlansStep() {
  const { plans, loading } = useMembershipPlans();
  const highestPlan = getHighestTierPlan(plans ?? []);

  const planRows = (plans ?? []).map((p) => ({
    name: p.display_name || p.name,
    dailyTasks: `${p.daily_task_limit}/day`,
    bonus: p.earning_per_task > 0 ? `$${p.earning_per_task}/task` : "Standard rate",
    priorityTasks: (p.task_skip_limit_per_day ?? 0) > 0,
    referralCommission: (p.task_commission_rate ?? 0) > 0,
    weeklyPotential: p.daily_task_limit && p.earning_per_task
      ? `~$${Math.round(p.daily_task_limit * p.earning_per_task * 7)}`
      : "—",
    popular: highestPlan?.id === p.id,
  }));

  if (loading || planRows.length === 0) {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-3">Choose Your Plan</h2>
          <p className="text-muted-foreground">Loading plans...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-3">
          Choose Your <span className="text-gradient">Plan</span>
        </h2>
        <p className="text-muted-foreground max-w-lg mx-auto">
          Your subscription determines how many tasks you receive daily. All plans are 1-year subscriptions.
        </p>
      </div>

      <div className="overflow-x-auto -mx-2">
        <div className="min-w-[600px] px-2">
          <div className="grid grid-cols-5 gap-2 text-sm">
            {/* Header */}
            <div className="p-3"></div>
            {planRows.map((plan) => (
              <div 
                key={plan.name} 
                className={`p-3 text-center rounded-t-lg ${plan.popular ? 'bg-primary/20 border-t border-x border-primary/30' : 'bg-muted/30'}`}
              >
                {plan.popular && (
                  <div className="flex items-center justify-center gap-1 text-primary text-xs mb-1">
                    <Star className="w-3 h-3 fill-primary" />
                    Popular
                  </div>
                )}
                <span className="font-bold text-foreground">{plan.name}</span>
              </div>
            ))}

            {/* Daily Tasks */}
            <div className="p-3 bg-muted/20 text-muted-foreground">Daily Tasks</div>
            {planRows.map((plan) => (
              <div 
                key={plan.name} 
                className={`p-3 text-center ${plan.popular ? 'bg-primary/10 border-x border-primary/30' : 'bg-muted/10'}`}
              >
                <span className="font-semibold text-foreground">{plan.dailyTasks}</span>
              </div>
            ))}

            {/* Earning Bonus */}
            <div className="p-3 bg-muted/20 text-muted-foreground">Earning Rate</div>
            {planRows.map((plan) => (
              <div 
                key={plan.name} 
                className={`p-3 text-center text-foreground ${plan.popular ? 'bg-primary/10 border-x border-primary/30' : 'bg-muted/10'}`}
              >
                {plan.bonus}
              </div>
            ))}

            {/* Priority Tasks */}
            <div className="p-3 bg-muted/20 text-muted-foreground">Priority Tasks</div>
            {planRows.map((plan) => (
              <div 
                key={plan.name} 
                className={`p-3 flex justify-center ${plan.popular ? 'bg-primary/10 border-x border-primary/30' : 'bg-muted/10'}`}
              >
                {plan.priorityTasks ? (
                  <Check className="w-5 h-5 text-green-400" />
                ) : (
                  <X className="w-5 h-5 text-muted-foreground/50" />
                )}
              </div>
            ))}

            {/* Referral Commission */}
            <div className="p-3 bg-muted/20 text-muted-foreground">Partner Commissions</div>
            {planRows.map((plan) => (
              <div 
                key={plan.name} 
                className={`p-3 flex justify-center ${plan.popular ? 'bg-primary/10 border-x border-primary/30' : 'bg-muted/10'}`}
              >
                {plan.referralCommission ? (
                  <span className="text-green-400 font-medium">10%</span>
                ) : (
                  <X className="w-5 h-5 text-muted-foreground/50" />
                )}
              </div>
            ))}

            {/* Weekly Potential */}
            <div className="p-3 bg-muted/20 text-muted-foreground rounded-bl-lg">Weekly Potential</div>
            {planRows.map((plan, index) => (
              <div 
                key={plan.name} 
                className={`p-3 text-center ${plan.popular ? 'bg-primary/10 border-x border-b border-primary/30 rounded-b-lg' : 'bg-muted/10'} ${index === plans.length - 1 && !plan.popular ? 'rounded-br-lg' : ''}`}
              >
                <span className="font-bold text-gradient">{plan.weeklyPotential}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <p className="text-sm text-center text-muted-foreground">
        Start with any plan and upgrade anytime. No lock-in period.
      </p>
    </div>
  );
}
