import { useState } from "react";
import { ClipboardList, Gift, TrendingUp, Wallet, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import OnboardingWizard from "./LandingOnboardingWizard";

const steps = [
  {
    number: "01",
    title: "Complete Simple AI Training Tasks",
    description: "Pick up available tasks from your dashboard — no experience needed. Tasks are clear, quick, and designed for everyday people.",
    icon: ClipboardList,
  },
  {
    number: "02",
    title: "Earn Rewards for Each Task",
    description: "Every completed task adds to your balance. The more tasks you complete, the faster your earnings grow.",
    icon: Gift,
  },
  {
    number: "03",
    title: "Grow Your Earnings Daily",
    description: "Stay active and watch your income compound. Daily tasks mean daily opportunities to increase your balance.",
    icon: TrendingUp,
  },
  {
    number: "04",
    title: "Withdraw Your Income Weekly",
    description: "Request a withdrawal every week and get paid reliably. Your earnings, your schedule, your control.",
    icon: Wallet,
  },
];

const HowItWorksSection = () => {
  const [wizardOpen, setWizardOpen] = useState(false);

  return (
    <section id="how-it-works" className="section-padding relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-background via-card/50 to-background" />
      <div className="hero-glow top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />

      <div className="container-custom relative z-10">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-full px-4 py-1.5 mb-6">
            <span className="text-xs font-semibold text-primary uppercase tracking-wider">💰 How You Earn</span>
          </div>
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            How You <span className="text-gradient">Earn</span>
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Four simple steps — from completing tasks to withdrawing your income every week.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
          {steps.map((step, index) => (
            <div key={step.number} className="relative group">
              {/* Connector Line */}
              {index < steps.length - 1 && (
                <div className="hidden lg:block absolute top-12 left-[60%] w-full h-0.5 bg-gradient-to-r from-primary/50 to-primary/10" />
              )}
              
              <div className="glass-card p-6 h-full relative overflow-hidden group-hover:border-primary/50 transition-all duration-300">
                {/* Step Number */}
                <div className="text-5xl font-bold text-primary/10 absolute -top-2 -right-2">
                  {step.number}
                </div>
                
                {/* Step Icon */}
                <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                  <step.icon className="w-6 h-6 text-primary" />
                </div>

                <h3 className="text-xl font-bold text-foreground mb-3">
                  {step.title}
                </h3>
                
                <p className="text-muted-foreground text-sm leading-relaxed">
                  {step.description}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="text-center mt-12">
          <Button variant="hero" size="lg" className="w-full sm:w-auto" onClick={() => setWizardOpen(true)}>
            <span className="font-bold">Register As an Earner</span>
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
          <OnboardingWizard open={wizardOpen} onOpenChange={setWizardOpen} />
        </div>
      </div>
    </section>
  );
};

export default HowItWorksSection;
