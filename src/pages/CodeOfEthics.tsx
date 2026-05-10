import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

export default function CodeOfEthics() {
  return (
    <>
      <Helmet>
        <title>Code of Ethics | ProfitChips</title>
        <meta name="description" content="ProfitChips Code of Ethics — the values and standards that guide our platform and community." />
      </Helmet>

      <div className="min-h-screen bg-background">
        <div className="max-w-3xl mx-auto px-4 py-12">
          <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors mb-8">
            <ArrowLeft className="h-4 w-4" /> Back to Home
          </Link>

          <h1 className="text-3xl font-bold mb-2">Code of Ethics</h1>
          <p className="text-muted-foreground text-sm mb-8">Last updated: May 2026</p>

          <div className="prose prose-invert max-w-none space-y-6 text-muted-foreground text-sm leading-relaxed">

            <p>At ProfitChips, we believe that a fair, honest, and transparent community is the foundation of a sustainable earning platform. This Code of Ethics outlines the values and standards we expect from every member of our community — users, partners, and our team.</p>

            <section>
              <h2 className="text-base font-semibold text-foreground mb-2">1. Honesty & Transparency</h2>
              <p>We are committed to being honest with our users about how the Platform works, how earnings are calculated, and what is required to participate. We expect users to be truthful when providing information, submitting content, and participating in tasks.</p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-foreground mb-2">2. Fair Play</h2>
              <p>ProfitChips is built on the principle that every user earns through genuine effort. Using bots, automation, fake accounts, or any method to artificially inflate earnings is a fundamental violation of this principle and will not be tolerated.</p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-foreground mb-2">3. Respect for Others</h2>
              <p>All members of the ProfitChips community are expected to treat others with respect. Harassment, discrimination, or abusive behavior of any kind — toward other users, support staff, or our team — will result in immediate account termination.</p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-foreground mb-2">4. Content Integrity</h2>
              <p>Users who participate in our Content Rewards Program must create original, honest, and educational content. Misleading, plagiarized, or deceptive content — including content that misrepresents ProfitChips or makes false earning claims — is strictly prohibited.</p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-foreground mb-2">5. Responsible Referrals</h2>
              <p>Referral activities must be conducted ethically. Do not make false promises about earnings to recruit referrals. Present ProfitChips accurately and let people make informed decisions about joining. Self-referrals and coordinated fake sign-ups are prohibited.</p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-foreground mb-2">6. Privacy & Data Respect</h2>
              <p>Users must not collect, share, or misuse other users' personal information. We take privacy seriously and expect all members to do the same.</p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-foreground mb-2">7. Compliance with Laws</h2>
              <p>Users are responsible for complying with all applicable laws in their jurisdiction, including tax obligations on earnings. ProfitChips does not provide tax advice, and it is your responsibility to report your earnings as required by your local law.</p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-foreground mb-2">8. Our Commitment to You</h2>
              <p>In return, ProfitChips commits to: (a) paying verified earnings promptly; (b) communicating platform changes clearly; (c) treating all users fairly regardless of country, language, or membership plan; (d) maintaining a secure and reliable platform; and (e) responding to support requests professionally and in a timely manner.</p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-foreground mb-2">9. Reporting Violations</h2>
              <p>If you witness behavior that violates this Code of Ethics, please report it to us at <a href="mailto:support@profitchips.com" className="text-primary hover:underline">support@profitchips.com</a>. We take all reports seriously and investigate them confidentially.</p>
            </section>
          </div>
        </div>
      </div>
    </>
  );
}
