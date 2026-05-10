import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

export default function CookiePolicy() {
  return (
    <>
      <Helmet>
        <title>Cookie Policy | ProfitChips</title>
        <meta name="description" content="Learn how ProfitChips uses cookies and similar technologies on our platform." />
      </Helmet>

      <div className="min-h-screen bg-background">
        <div className="max-w-3xl mx-auto px-4 py-12">
          <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors mb-8">
            <ArrowLeft className="h-4 w-4" /> Back to Home
          </Link>

          <h1 className="text-3xl font-bold mb-2">Cookie Policy</h1>
          <p className="text-muted-foreground text-sm mb-8">Last updated: May 2026</p>

          <div className="prose prose-invert max-w-none space-y-6 text-muted-foreground text-sm leading-relaxed">

            <section>
              <h2 className="text-base font-semibold text-foreground mb-2">1. What Are Cookies?</h2>
              <p>Cookies are small text files placed on your device when you visit a website. They help the website remember your actions and preferences over time, so you don't have to re-enter settings each time you return.</p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-foreground mb-2">2. How We Use Cookies</h2>
              <p>ProfitChips uses cookies for the following purposes:</p>
              <ul className="list-disc list-inside space-y-1 mt-2 pl-2">
                <li><strong className="text-foreground">Essential cookies:</strong> Required for core Platform functionality such as authentication and session management.</li>
                <li><strong className="text-foreground">Preference cookies:</strong> Remember your settings such as language and currency preferences.</li>
                <li><strong className="text-foreground">Analytics cookies:</strong> Help us understand how users interact with the Platform so we can improve it.</li>
                <li><strong className="text-foreground">Security cookies:</strong> Help detect fraud, protect your account, and maintain Platform security.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-base font-semibold text-foreground mb-2">3. Types of Cookies We Use</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-xs border border-border/30 rounded-lg overflow-hidden mt-2">
                  <thead>
                    <tr className="bg-muted/30">
                      <th className="text-left p-3 text-foreground font-medium">Cookie Name</th>
                      <th className="text-left p-3 text-foreground font-medium">Purpose</th>
                      <th className="text-left p-3 text-foreground font-medium">Duration</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-t border-border/20">
                      <td className="p-3">sb-access-token</td>
                      <td className="p-3">Authentication session</td>
                      <td className="p-3">Session</td>
                    </tr>
                    <tr className="border-t border-border/20">
                      <td className="p-3">sb-refresh-token</td>
                      <td className="p-3">Session refresh</td>
                      <td className="p-3">7 days</td>
                    </tr>
                    <tr className="border-t border-border/20">
                      <td className="p-3">i18n-language</td>
                      <td className="p-3">Language preference</td>
                      <td className="p-3">1 year</td>
                    </tr>
                    <tr className="border-t border-border/20">
                      <td className="p-3">currency-preference</td>
                      <td className="p-3">Currency display preference</td>
                      <td className="p-3">1 year</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            <section>
              <h2 className="text-base font-semibold text-foreground mb-2">4. Third-Party Cookies</h2>
              <p>Some features on the Platform may use third-party services (such as analytics and payment processors) that place their own cookies. We do not control these cookies. Please review the respective privacy policies of those services.</p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-foreground mb-2">5. Managing Cookies</h2>
              <p>You can control cookies through your browser settings. Disabling essential cookies may prevent you from logging in or using core Platform features. Most browsers allow you to view, delete, and block cookies through their settings menu.</p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-foreground mb-2">6. Contact Us</h2>
              <p>For questions about our Cookie Policy, contact us at <a href="mailto:support@profitchips.com" className="text-primary hover:underline">support@profitchips.com</a>.</p>
            </section>
          </div>
        </div>
      </div>
    </>
  );
}
