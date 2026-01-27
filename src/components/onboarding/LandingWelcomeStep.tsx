import { Sparkles, Users, Globe } from "lucide-react";

export default function LandingWelcomeStep() {
  return (
    <div className="text-center space-y-8">
      <div className="inline-flex items-center justify-center w-20 h-20 bg-primary/10 rounded-full mb-4">
        <Sparkles className="w-10 h-10 text-primary" />
      </div>
      
      <div>
        <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
          Welcome to <span className="text-gradient">ProfitChips</span>
        </h2>
        <p className="text-lg text-muted-foreground max-w-lg mx-auto">
          You're about to discover how thousands of people around the world are earning real money from home — just by sharing their opinions.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-6">
        <div className="glass-card p-4 text-center">
          <Users className="w-6 h-6 text-primary mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Join thousands of earners</p>
        </div>
        <div className="glass-card p-4 text-center">
          <Globe className="w-6 h-6 text-primary mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Work from anywhere</p>
        </div>
        <div className="glass-card p-4 text-center">
          <Sparkles className="w-6 h-6 text-primary mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No experience needed</p>
        </div>
      </div>

      <p className="text-sm text-muted-foreground italic">
        Let us show you how it all works in the next few steps.
      </p>
    </div>
  );
}
