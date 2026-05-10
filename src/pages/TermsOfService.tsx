import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

export default function TermsOfService() {
  return (
    <>
      <Helmet>
        <title>Terms of Service | ProfitChips</title>
        <meta name="description" content="Read the ProfitChips Terms of Service — the rules and agreements that govern your use of our platform." />
      </Helmet>

      <div className="min-h-screen bg-background">
        <div className="max-w-3xl mx-auto px-4 py-12">
          <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors mb-8">
            <ArrowLeft className="h-4 w-4" /> Back to Home
          </Link>

          <h1 className="text-3xl font-bold mb-2">Terms of Service</h1>
          <p className="text-muted-foreground text-sm mb-8">Last updated: May 2026</p>

          <div className="prose prose-invert max-w-none space-y-6 text-muted-foreground text-sm leading-relaxed">

            <section>
              <h2 className="text-base font-semibold text-foreground mb-2">1. Acceptance of Terms</h2>
              <p>By accessing or using ProfitChips ("Platform"), you agree to be bound by these Terms of Service. If you do not agree, you may not use the Platform.</p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-foreground mb-2">2. Eligibility</h2>
              <p>You must be at least 18 years old to register and use ProfitChips. By creating an account, you confirm that you meet this requirement and that the information you provide is accurate.</p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-foreground mb-2">3. Account Registration</h2>
              <p>You are responsible for maintaining the confidentiality of your login credentials. You agree to notify us immediately at <a href="mailto:support@profitchips.com" className="text-primary hover:underline">support@profitchips.com</a> if you suspect unauthorized use of your account.</p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-foreground mb-2">4. Earning & Tasks</h2>
              <p>ProfitChips provides users with AI training tasks that may generate earnings. Earnings are credited to your Earnings Wallet and may be withdrawn subject to minimum withdrawal thresholds and verification requirements. We reserve the right to modify task availability, pay rates, and earning structures at any time.</p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-foreground mb-2">5. Membership Plans</h2>
              <p>Certain features require a paid membership plan. Membership fees are non-refundable unless otherwise stated. Plan details, pricing, and benefits may change with reasonable notice to users.</p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-foreground mb-2">6. Content Rewards Program</h2>
              <p>Users who participate in the Get Paid To Post program agree that submitted content must be original, educational, and authentic. ProfitChips reserves the right to approve or reject any submission at its sole discretion. Rewards are paid to the Earnings Wallet upon verified milestone achievement.</p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-foreground mb-2">7. Referral Program</h2>
              <p>Referral commissions are earned when referred users activate their accounts and engage with the Platform. Referral abuse, including self-referrals or fraudulent sign-ups, will result in immediate account termination and forfeiture of earnings.</p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-foreground mb-2">8. Prohibited Conduct</h2>
              <p>You agree not to: (a) use bots, scripts, or automation to complete tasks; (b) create multiple accounts; (c) misrepresent your identity; (d) attempt to manipulate the referral or rewards system; or (e) violate any applicable law. Violations will result in account suspension and forfeiture of all balances.</p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-foreground mb-2">9. Withdrawals</h2>
              <p>Withdrawals are subject to identity verification, minimum balance requirements, and processing times. ProfitChips reserves the right to delay or withhold withdrawals pending fraud review.</p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-foreground mb-2">10. Limitation of Liability</h2>
              <p>ProfitChips is not liable for indirect, incidental, or consequential damages arising from your use of the Platform. Our total liability to you shall not exceed the amount you have withdrawn from the Platform in the 30 days preceding the claim.</p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-foreground mb-2">11. Termination</h2>
              <p>We reserve the right to suspend or terminate any account at any time for any violation of these Terms. Upon termination, your access to the Platform will cease and pending earnings may be forfeited.</p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-foreground mb-2">12. Changes to Terms</h2>
              <p>We may update these Terms at any time. Continued use of the Platform after changes constitutes your acceptance of the updated Terms.</p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-foreground mb-2">13. Contact</h2>
              <p>For questions about these Terms, contact us at <a href="mailto:support@profitchips.com" className="text-primary hover:underline">support@profitchips.com</a>.</p>
            </section>
          </div>
        </div>
      </div>
    </>
  );
}
