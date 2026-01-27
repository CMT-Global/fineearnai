import { useState } from "react";
import { ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import OnboardingWizard from "./LandingOnboardingWizard";

export default function LandingCTASection() {
  const [wizardOpen, setWizardOpen] = useState(false);
  return (
    <section className="section-padding relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-background via-card to-background" />
      <div className="hero-glow top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-50" />
      
      {/* Decorative Elements */}
      <div className="absolute top-20 left-10 w-32 h-32 border border-primary/20 rounded-full animate-pulse-slow" />
      <div className="absolute bottom-20 right-10 w-24 h-24 border border-accent/20 rounded-full animate-pulse-slow delay-300" />

      <div className="container-custom relative z-10">
        <div className="glass-card p-8 md:p-16 text-center max-w-4xl mx-auto border-primary/20">
          <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-full px-4 py-2 mb-6">
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="text-sm text-foreground font-medium">Shape the Future of AI</span>
          </div>

          <h2 className="text-3xl md:text-5xl font-bold text-foreground mb-6">
            Ready to Start <span className="text-gradient">Earning</span>?
          </h2>
          
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto mb-10">
            Join our global community of 1M+ contributors and help create AI that is 
            relevant, trustworthy, and truthful — all while earning on your own terms.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button variant="hero" size="xl" onClick={() => setWizardOpen(true)}>
              Register As an Earner
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
            <Button variant="hero-outline" size="lg">
              Learn More
            </Button>
          </div>

          <OnboardingWizard open={wizardOpen} onOpenChange={setWizardOpen} />

          {/* Stats Row */}
          <div className="mt-12 pt-8 border-t border-border/30 flex justify-center">
            <div>
              <div className="text-2xl md:text-3xl font-bold text-gradient">Weekly</div>
              <div className="text-sm text-muted-foreground">Payments</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
