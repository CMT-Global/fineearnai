import { DollarSign, TrendingUp, Calendar, AlertCircle } from "lucide-react";

export default function LandingEarningPotentialStep() {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-3">
          Your <span className="text-gradient">Earning Potential</span>
        </h2>
        <p className="text-muted-foreground max-w-lg mx-auto">
          Here's what you can realistically earn based on your subscription plan and effort.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="glass-card p-5 text-center">
          <DollarSign className="w-8 h-8 text-primary mx-auto mb-2" />
          <p className="text-2xl font-bold text-gradient">KES 5-50+</p>
          <p className="text-sm text-muted-foreground">Per task completed</p>
        </div>
        <div className="glass-card p-5 text-center">
          <TrendingUp className="w-8 h-8 text-primary mx-auto mb-2" />
          <p className="text-2xl font-bold text-gradient">$300</p>
          <p className="text-sm text-muted-foreground">Weekly potential</p>
        </div>
      </div>

      <div className="glass-card p-5 text-center border-primary/30">
        <Calendar className="w-8 h-8 text-primary mx-auto mb-2" />
        <p className="text-3xl font-bold text-gradient">Up to $1,200</p>
        <p className="text-muted-foreground">Monthly earning potential</p>
      </div>

      <div className="space-y-3">
        <h3 className="font-semibold text-foreground">What affects your earnings:</h3>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li className="flex items-start gap-2">
            <span className="text-primary">•</span>
            <span><strong className="text-foreground">Your subscription plan</strong> — Higher plans get more daily tasks and better rates</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary">•</span>
            <span><strong className="text-foreground">Task complexity</strong> — More detailed tasks pay more per completion</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary">•</span>
            <span><strong className="text-foreground">Your consistency</strong> — Complete more tasks, earn more money</span>
          </li>
        </ul>
      </div>

      <div className="flex items-start gap-2 p-3 bg-muted/30 rounded-lg text-xs text-muted-foreground">
        <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
        <p>Actual earnings vary based on task availability, completion accuracy, and your chosen subscription plan.</p>
      </div>
    </div>
  );
}
