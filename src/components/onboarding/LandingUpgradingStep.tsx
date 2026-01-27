import { ArrowRight, Zap, RefreshCw } from "lucide-react";

export default function LandingUpgradingStep() {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-3">
          <span className="text-gradient">Upgrading</span> is Easy
        </h2>
        <p className="text-muted-foreground max-w-lg mx-auto">
          Want more tasks and higher earnings? You can upgrade your plan anytime with a simple top-up.
        </p>
      </div>

      {/* Upgrade Path Visual */}
      <div className="glass-card p-6">
        <div className="flex items-center justify-between overflow-x-auto gap-2">
          <div className="text-center flex-shrink-0">
            <div className="w-16 h-16 bg-muted/50 rounded-xl flex items-center justify-center mx-auto mb-2">
              <span className="text-sm font-bold text-muted-foreground">Basic</span>
            </div>
          </div>
          <ArrowRight className="w-5 h-5 text-primary flex-shrink-0" />
          <div className="text-center flex-shrink-0">
            <div className="w-16 h-16 bg-primary/20 rounded-xl flex items-center justify-center mx-auto mb-2 border border-primary/30">
              <span className="text-sm font-bold text-foreground">Premium</span>
            </div>
          </div>
          <ArrowRight className="w-5 h-5 text-primary flex-shrink-0" />
          <div className="text-center flex-shrink-0">
            <div className="w-16 h-16 bg-primary/30 rounded-xl flex items-center justify-center mx-auto mb-2 border border-primary/40">
              <span className="text-sm font-bold text-foreground">Pro</span>
            </div>
          </div>
          <ArrowRight className="w-5 h-5 text-primary flex-shrink-0" />
          <div className="text-center flex-shrink-0">
            <div className="w-16 h-16 bg-primary/40 rounded-xl flex items-center justify-center mx-auto mb-2 border border-primary/50">
              <span className="text-sm font-bold text-foreground">Elite</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4">
        <div className="glass-card p-4 flex items-start gap-4">
          <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
            <Zap className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground mb-1">Just Pay the Difference</h3>
            <p className="text-sm text-muted-foreground">
              Upgrading is as simple as topping up the price difference between your current plan and the new one. No complicated processes.
            </p>
          </div>
        </div>

        <div className="glass-card p-4 flex items-start gap-4">
          <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
            <RefreshCw className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground mb-1">Instant Activation</h3>
            <p className="text-sm text-muted-foreground">
              No waiting, no re-application. The moment you upgrade, you get immediate access to more tasks and better earning rates.
            </p>
          </div>
        </div>
      </div>

      <div className="text-center p-4 bg-primary/5 rounded-xl border border-primary/20">
        <p className="text-foreground">
          <span className="font-semibold">Start where you're comfortable</span> — you can always upgrade when you're ready to earn more.
        </p>
      </div>
    </div>
  );
}
