import { useState, useEffect } from "react";
import { Helmet } from "react-helmet-async";
import Navbar from "@/components/LandingNavbar";
import HeroSection from "@/components/LandingHeroSection";
import ProjectsSection from "@/components/LandingProjectsSection";
import HowItWorksSection from "@/components/LandingHowItsWorkSection";
import BenefitsSection from "@/components/LandingBenefitsSection";
import FAQSection from "@/components/LandingFAQSection";
import CTASection from "@/components/LandingCTASection";
import Footer from "@/components/LandingFooter";
import OnboardingWizard from "@/components/LandingOnboardingWizard";

const Index = () => {
  const [wizardOpen, setWizardOpen] = useState(false);

  // Hide Chat Support (Reamaze) when registration wizard is open so it's not visible-but-unclickable on mobile,
  // and to avoid accidental closes on desktop when clicking the widget
  useEffect(() => {
    if (wizardOpen) {
      document.body.setAttribute("data-landing-wizard-open", "true");
    } else {
      document.body.removeAttribute("data-landing-wizard-open");
    }
    return () => document.body.removeAttribute("data-landing-wizard-open");
  }, [wizardOpen]);

  return (
    <>
      <Helmet>
        <title>ProfitChips - Get Paid To Analyse Reviews | Earn Online by Analysing Reviews</title>
        <meta 
          name="description" 
          content="Join 1M+ people worldwide earning money by analysing reviews. Flexible remote work, competitive pay, and no technical experience required. Start earning today with ProfitChips." 
        />
        <meta name="keywords" content="earn money online, AI training, remote work, side income, data labeling, AI jobs" />
        <link rel="canonical" href="https://profitchips.com" />
      </Helmet>
      
      <div className="min-h-screen bg-background">
        <Navbar />
        <main>
          <HeroSection onRegisterAsEarnerClick={() => setWizardOpen(true)} />
          <ProjectsSection />
          <HowItWorksSection />
          <BenefitsSection />
          <FAQSection />
          <CTASection onRegisterAsEarnerClick={() => setWizardOpen(true)} />
        </main>
        <Footer />
      </div>
      <OnboardingWizard open={wizardOpen} onOpenChange={setWizardOpen} />
    </>
  );
};

export default Index;
