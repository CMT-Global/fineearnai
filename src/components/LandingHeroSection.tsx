import { useState } from "react";
import { ArrowRight, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import OnboardingWizard from "./LandingOnboardingWizard";
import heroBg from "@/assets/hero-bg.jpeg";

export default function LandingHeroSection() {
  const [wizardOpen, setWizardOpen] = useState(false);
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-20">
      {/* Background image */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${heroBg})` }}
        aria-hidden
      />
      {/* Dark overlay for legibility */}
      <div className="absolute inset-0 bg-background/70" aria-hidden />
      {/* Background Effects */}
      <div className="absolute inset-0 bg-hero-pattern opacity-50" />
      <div 
        className="absolute inset-0 opacity-30 bg-gradient-to-br from-primary/10 via-background to-accent/10"
        aria-hidden
      />
      <div className="hero-glow top-1/4 left-1/4 animate-pulse-slow" />
      <div className="hero-glow bottom-1/4 right-1/4 animate-pulse-slow delay-500" />
      
      {/* Floating Elements */}
      <div className="absolute top-1/3 left-[10%] w-20 h-20 bg-primary/10 rounded-2xl rotate-12 animate-float hidden lg:block" />
      <div className="absolute top-1/2 right-[15%] w-16 h-16 bg-accent/10 rounded-xl -rotate-12 animate-float delay-300 hidden lg:block" />
      <div className="absolute bottom-1/4 left-[20%] w-12 h-12 bg-primary/15 rounded-lg rotate-45 animate-float delay-500 hidden lg:block" />

      <div className="container-custom relative z-10 px-4 md:px-8">
        <div className="max-w-4xl mx-auto text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-full px-4 py-2 mb-8 animate-fade-up">
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="text-sm text-foreground font-medium">Join Thousands of AI Trainers Worldwide</span>
          </div>

          {/* Main Headline */}
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-extrabold leading-tight mb-6 animate-fade-up delay-100">
            <span className="text-foreground">Get Paid to</span>
            <br />
            <span className="text-gradient">Train AI</span>
          </h1>

          {/* Subheadline */}
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 animate-fade-up delay-200">
            Earn remotely by completing online tasks that help improve AI. 
            Work at your preferred time and gain real-world, hands-on experience in shaping the future of technology.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-fade-up delay-300">
            <Button variant="hero" size="xl" onClick={() => setWizardOpen(true)}>
              Register As an Earner
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
            <Button variant="hero-outline" size="xl" asChild>
              <Link to="/login">Login</Link>
            </Button>
          </div>

          <OnboardingWizard open={wizardOpen} onOpenChange={setWizardOpen} />

        </div>
      </div>

      {/* Bottom Gradient */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background to-transparent" />
    </section>
  );
}
