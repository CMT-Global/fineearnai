import { Check, X, Star } from "lucide-react";

const plans = [
  {
    name: "Basic",
    dailyTasks: "10-15",
    bonus: "Standard rate",
    priorityTasks: false,
    referralCommission: false,
    weeklyPotential: "~$50",
    popular: false,
  },
  {
    name: "Premium",
    dailyTasks: "25-40",
    bonus: "+10% bonus",
    priorityTasks: true,
    referralCommission: true,
    weeklyPotential: "~$120",
    popular: true,
  },
  {
    name: "Pro",
    dailyTasks: "50-75",
    bonus: "+20% bonus",
    priorityTasks: true,
    referralCommission: true,
    weeklyPotential: "~$200",
    popular: false,
  },
  {
    name: "Elite",
    dailyTasks: "100+",
    bonus: "+30% bonus",
    priorityTasks: true,
    referralCommission: true,
    weeklyPotential: "~$300+",
    popular: false,
  },
];

export default function LandingSubscriptionPlansStep() {
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
            {plans.map((plan) => (
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
            {plans.map((plan) => (
              <div 
                key={plan.name} 
                className={`p-3 text-center ${plan.popular ? 'bg-primary/10 border-x border-primary/30' : 'bg-muted/10'}`}
              >
                <span className="font-semibold text-foreground">{plan.dailyTasks}</span>
              </div>
            ))}

            {/* Earning Bonus */}
            <div className="p-3 bg-muted/20 text-muted-foreground">Earning Rate</div>
            {plans.map((plan) => (
              <div 
                key={plan.name} 
                className={`p-3 text-center text-foreground ${plan.popular ? 'bg-primary/10 border-x border-primary/30' : 'bg-muted/10'}`}
              >
                {plan.bonus}
              </div>
            ))}

            {/* Priority Tasks */}
            <div className="p-3 bg-muted/20 text-muted-foreground">Priority Tasks</div>
            {plans.map((plan) => (
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
            <div className="p-3 bg-muted/20 text-muted-foreground">Referral Income</div>
            {plans.map((plan) => (
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
            {plans.map((plan, index) => (
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
