import { Shield, Globe, Eye, Users, Clock, Award } from "lucide-react";

const trustPoints = [
  {
    icon: Shield,
    title: "Real AI Partnerships",
    description: "We work with legitimate AI research companies and institutions that need human feedback.",
  },
  {
    icon: Eye,
    title: "Full Transparency",
    description: "See exactly what each task pays before you start. No hidden conditions or surprise deductions.",
  },
  {
    icon: Clock,
    title: "Consistent Weekly Payouts",
    description: "Every Friday, without fail. No minimum thresholds that take months to reach.",
  },
  {
    icon: Globe,
    title: "Global Community",
    description: "Join thousands of earners across 50+ countries who trust ProfitChips for their income.",
  },
];

export default function LandingWhyTrustUsStep() {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-3">
          Why <span className="text-gradient">Trust</span> ProfitChips?
        </h2>
        <p className="text-muted-foreground max-w-lg mx-auto">
          We know there are many "earning" platforms out there. Here's what makes us different.
        </p>
      </div>

      <div className="grid gap-4">
        {trustPoints.map((point, index) => (
          <div key={index} className="glass-card p-4 flex items-start gap-4">
            <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
              <point.icon className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground mb-1">{point.title}</h3>
              <p className="text-sm text-muted-foreground">{point.description}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Social Proof */}
      <div className="glass-card p-5 bg-primary/5 border-primary/20">
        <div className="flex items-center justify-center gap-3 mb-3">
          <div className="flex -space-x-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="w-8 h-8 bg-gradient-to-br from-primary to-accent rounded-full border-2 border-background flex items-center justify-center">
                <Users className="w-3 h-3 text-primary-foreground" />
              </div>
            ))}
          </div>
          <Award className="w-6 h-6 text-primary" />
        </div>
        <p className="text-sm text-center text-foreground">
          <span className="font-semibold">Thousands of earners</span> trust ProfitChips every week to receive their payments on time.
        </p>
      </div>

      <p className="text-center text-sm text-muted-foreground">
        Your success is our success. We only grow when you earn.
      </p>
    </div>
  );
}
