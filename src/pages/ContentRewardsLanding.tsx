import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Button } from "@/components/ui/button";
import { Video, CheckCircle2, AlertCircle } from "lucide-react";
import { fetchContentRewardsConfig, CONTENT_REWARDS_QUERY_KEY } from "@/lib/content-rewards-config";
import Navbar from "@/components/LandingNavbar";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useEffect } from "react";

export default function ContentRewardsLanding() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const refCode = searchParams.get("ref");

  useEffect(() => {
    if (refCode && refCode.trim()) {
      const code = refCode.trim().toUpperCase();
      const utmSource = searchParams.get("utm_source") ?? null;
      const utmCampaign = searchParams.get("utm_campaign") ?? null;
      const utmContent = searchParams.get("utm_content") ?? null;
      const utmMedium = searchParams.get("utm_medium") ?? null;
      const utmTerm = searchParams.get("utm_term") ?? null;
      const userAgent = typeof navigator !== "undefined" ? navigator.userAgent : null;
      supabase
        .rpc("record_referral_click", {
          p_referral_code: code,
          p_utm_source: utmSource,
          p_utm_campaign: utmCampaign,
          p_utm_content: utmContent,
          p_utm_medium: utmMedium,
          p_utm_term: utmTerm,
          p_user_agent: userAgent,
        })
        .then(() => {})
        .catch(() => {});
    }
  }, [refCode, searchParams]);

  const { data: config, isLoading } = useQuery({
    queryKey: CONTENT_REWARDS_QUERY_KEY,
    queryFn: fetchContentRewardsConfig,
  });

  const handleApply = () => {
    if (user) {
      navigate("/content-rewards/apply");
    } else {
      const returnUrl = "/content-rewards/apply";
      navigate(`/login?redirect=${encodeURIComponent(returnUrl)}`);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <LoadingSpinner size="lg" text="Loading..." />
      </div>
    );
  }

  const lp = config?.landing_page ?? {
    title: "Get Paid to Post About ProfitChips",
    description: "Create tutorials, share your link, and earn commissions when your referrals upgrade their subscription.",
    hero_text: "Turn your content into earnings",
    cta_text: "Apply & Start Posting",
  };
  const goal = config?.goal_messaging ?? "Many creators set a goal of $250/week (~$1,000/month) depending on performance and referrals.";
  const disclaimer = config?.disclaimer ?? "Earnings vary based on referrals, upgrades, and plan settings. No guaranteed earnings.";
  const enabled = config?.enabled ?? false;

  return (
    <>
      <Helmet>
        <title>{lp.title} | ProfitChips</title>
        <meta name="description" content={lp.description} />
      </Helmet>
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="pt-24 pb-16 px-4 md:px-8">
          <div className="container max-w-3xl mx-auto space-y-10">
            {/* Hero */}
            <section className="text-center space-y-4">
              <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 text-primary px-4 py-1.5 text-sm font-medium">
                <Video className="h-4 w-4" />
                Content Rewards
              </div>
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight">{lp.hero_text}</h1>
              <p className="text-lg text-muted-foreground max-w-xl mx-auto">{lp.description}</p>
              {!enabled && (
                <p className="text-sm text-amber-600 dark:text-amber-500 flex items-center justify-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  Applications are currently closed.
                </p>
              )}
              <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
                <Button size="lg" onClick={handleApply} disabled={!enabled}>
                  {lp.cta_text}
                </Button>
                <Button size="lg" variant="outline" asChild>
                  <Link to="/login">Login</Link>
                </Button>
              </div>
            </section>

            {/* What creators do */}
            <section>
              <h2 className="text-xl font-semibold mb-3">What to post</h2>
              <ul className="space-y-2 text-muted-foreground">
                {["Tutorials", "How-to guides", "Explainers: “how to earn online doing AI tasks”", "Encouraging people to sign up"].map((item, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <CheckCircle2 className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </section>

            {/* How they earn */}
            <section>
              <h2 className="text-xl font-semibold mb-3">How you earn</h2>
              <p className="text-muted-foreground">
                Commissions when your referrals upgrade their subscription. (If enabled for your plan, you can also earn from referral task earnings.)
              </p>
            </section>

            {/* Goal (motivational) */}
            <section className="rounded-lg border bg-muted/30 p-4">
              <p className="text-sm font-medium text-foreground">{goal}</p>
            </section>

            {/* Disclaimer */}
            <p className="text-xs text-muted-foreground border-t pt-6">{disclaimer}</p>
          </div>
        </main>
      </div>
    </>
  );
}
