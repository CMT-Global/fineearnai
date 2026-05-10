import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

export default function PrivacyPolicy() {
  return (
    <>
      <Helmet>
        <title>Privacy Policy | ProfitChips</title>
        <meta name="description" content="Learn how ProfitChips collects, uses, and protects your personal information." />
      </Helmet>

      <div className="min-h-screen bg-background">
        <div className="max-w-3xl mx-auto px-4 py-12">
          <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors mb-8">
            <ArrowLeft className="h-4 w-4" /> Back to Home
          </Link>

          <h1 className="text-3xl font-bold mb-2">Privacy Policy</h1>
          <p className="text-muted-foreground text-sm mb-8">Last updated: May 2026</p>

          <div className="prose prose-invert max-w-none space-y-6 text-muted-foreground text-sm leading-relaxed">

            <section>
              <h2 className="text-base font-semibold text-foreground mb-2">1. Information We Collect</h2>
              <p>We collect information you provide when registering (name, email, username), payment and withdrawal details, task completion data, referral activity, content submissions, and technical data such as IP address, browser type, and device information.</p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-foreground mb-2">2. How We Use Your Information</h2>
              <p>We use your information to: (a) operate and improve the Platform; (b) process earnings and withdrawals; (c) communicate platform updates and support; (d) prevent fraud and ensure platform integrity; (e) comply with legal obligations.</p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-foreground mb-2">3. Data Sharing</h2>
              <p>We do not sell your personal data. We may share data with: (a) payment processors to complete transactions; (b) service providers who help us operate the Platform; (c) law enforcement when required by law. All third parties are contractually required to protect your data.</p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-foreground mb-2">4. Data Retention</h2>
              <p>We retain your personal data for as long as your account is active, plus a reasonable period thereafter for legal and business purposes. You may request deletion of your account and associated data by contacting us.</p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-foreground mb-2">5. Cookies</h2>
              <p>We use cookies and similar technologies to maintain sessions, remember preferences, and analyze usage. You can manage cookie preferences in your browser settings. See our <Link to="/cookie-policy" className="text-primary hover:underline">Cookie Policy</Link> for more details.</p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-foreground mb-2">6. Security</h2>
              <p>We implement industry-standard security measures including encryption, secure authentication, and regular security audits. However, no method of transmission over the internet is 100% secure.</p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-foreground mb-2">7. Your Rights</h2>
              <p>Depending on your location, you may have rights to access, correct, delete, or port your personal data, and to object to certain processing. To exercise these rights, contact us at <a href="mailto:support@profitchips.com" className="text-primary hover:underline">support@profitchips.com</a>.</p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-foreground mb-2">8. International Transfers</h2>
              <p>Your data may be processed in countries other than your own. We ensure appropriate safeguards are in place for any international data transfers.</p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-foreground mb-2">9. Changes to This Policy</h2>
              <p>We may update this Privacy Policy periodically. We will notify you of significant changes by email or prominent notice on the Platform.</p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-foreground mb-2">10. Contact Us</h2>
              <p>For privacy-related questions or requests, contact us at <a href="mailto:support@profitchips.com" className="text-primary hover:underline">support@profitchips.com</a>.</p>
            </section>
          </div>
        </div>
      </div>
    </>
  );
}
