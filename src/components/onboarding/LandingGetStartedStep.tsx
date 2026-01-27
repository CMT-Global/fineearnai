import { CheckCircle2, ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

const highlights = [
  "Simple review analysis tasks",
  "Earn up to $300/week, $1,200/month",
  "4 subscription plans to fit your goals",
  "Invite friends for 10% commission",
  "Withdrawals every Friday from $20",
];

interface LandingGetStartedStepProps {
  onComplete: () => void;
}

export default function LandingGetStartedStep({ onComplete }: LandingGetStartedStepProps) {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-primary/20 rounded-full mb-4">
          <Sparkles className="w-8 h-8 text-primary" />
        </div>
        <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-3">
          You're <span className="text-gradient">Ready!</span>
        </h2>
        <p className="text-muted-foreground max-w-lg mx-auto">
          You now know everything you need to start your earning journey with ProfitChips.
        </p>
      </div>

      {/* Quick Recap */}
      <div className="glass-card p-5">
        <h3 className="font-semibold text-foreground mb-4 text-center">Quick Recap</h3>
        <ul className="space-y-3">
          {highlights.map((item, index) => (
            <li key={index} className="flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0" />
              <span className="text-sm text-foreground">{item}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Next Steps Info */}
      <div className="glass-card p-4 bg-primary/5 border-primary/20">
        <h3 className="font-semibold text-foreground mb-2 text-center">What's Next?</h3>
        <ol className="space-y-2 text-sm text-muted-foreground">
          <li className="flex items-start gap-2">
            <span className="w-5 h-5 bg-primary/20 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold text-primary">1</span>
            <span>Create your account in 2 minutes</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="w-5 h-5 bg-primary/20 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold text-primary">2</span>
            <span>Complete your profile setup</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="w-5 h-5 bg-primary/20 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold text-primary">3</span>
            <span>Choose a subscription plan</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="w-5 h-5 bg-primary/20 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold text-primary">4</span>
            <span>Start completing tasks and earning!</span>
          </li>
        </ol>
      </div>

      <div className="text-center pt-2">
        <Button variant="hero" size="xl" onClick={onComplete} className="w-full sm:w-auto">
          Create My Earner Account
          <ArrowRight className="w-5 h-5 ml-2" />
        </Button>
        <p className="text-xs text-muted-foreground mt-3">
          By clicking, you acknowledge this is a subscription-based platform
        </p>
      </div>
    </div>
  );
}
