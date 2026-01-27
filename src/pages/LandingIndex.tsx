import { Helmet } from "react-helmet-async";
import LandingNavbar from "@/components/LandingNavbar";
import LandingHeroSection from "@/components/LandingHeroSection";
import LandingProjectsSection from "@/components/LandingProjectsSection";
import LandingHowItsWorkSection from "@/components/LandingHowItsWorkSection";
import LandingBenefitsSection from "@/components/LandingBenefitsSection";
import LandingFAQSection from "@/components/LandingFAQSection";
import LandingCTASection from "@/components/LandingCTASection";
import LandingFooter from "@/components/LandingFooter";

const LandingIndex = () => {
  return (
    <>
      <Helmet>
        <title>ProfitChips - Get Paid to Train AI | Earn Online by Improving AI</title>
        <meta 
          name="description" 
          content="Join 1M+ people worldwide earning money by training AI. Flexible remote work, competitive pay, and no technical experience required. Start earning today with ProfitChips." 
        />
        <meta name="keywords" content="earn money online, AI training, remote work, side income, data labeling, AI jobs" />
        <link rel="canonical" href="https://profitchips.com" />
      </Helmet>
      
      <div className="min-h-screen bg-background">
        <LandingNavbar />
        <main>
          <LandingHeroSection />
          <LandingProjectsSection />
          <LandingHowItsWorkSection />
          <LandingBenefitsSection />
          <LandingFAQSection />
          <LandingCTASection />
        </main>
        <LandingFooter />
      </div>
    </>
  );
};

export default LandingIndex;
