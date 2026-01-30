import { Helmet } from "react-helmet-async";
import Navbar from "@/components/LandingNavbar";
import HeroSection from "@/components/LandingHeroSection";
import ProjectsSection from "@/components/LandingProjectsSection";
import HowItWorksSection from "@/components/LandingHowItsWorkSection";
import BenefitsSection from "@/components/LandingBenefitsSection";
import FAQSection from "@/components/LandingFAQSection";
import CTASection from "@/components/LandingCTASection";
import Footer from "@/components/LandingFooter";

const Index = () => {
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
          <HeroSection />
          <ProjectsSection />
          <HowItWorksSection />
          <BenefitsSection />
          <FAQSection />
          <CTASection />
        </main>
        <Footer />
      </div>
    </>
  );
};

export default Index;
