import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";
import { fetchContentRewardsConfig, CONTENT_REWARDS_QUERY_KEY } from "@/lib/content-rewards-config";
import { supabase } from "@/integrations/supabase/client";
import { useReferralData } from "@/hooks/useReferralData";
import { PageLayout } from "@/components/layout/PageLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ReferralStatsCard } from "@/components/referrals/ReferralStatsCard";
import { ReferralCodeCard } from "@/components/referrals/ReferralCodeCard";
import { CommissionHistoryList } from "@/components/referrals/CommissionHistoryList";
import { Video, Copy, CheckCircle2, ExternalLink, MessageCircle, Send, Twitter, Facebook } from "lucide-react";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { toast } from "sonner";
import { useState } from "react";

export default function ContentRewardsDashboard() {
  const { user, loading: authLoading, signOut } = useAuth();
  const { isAdmin } = useAdmin();
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);

  const { data: config } = useQuery({
    queryKey: CONTENT_REWARDS_QUERY_KEY,
    queryFn: fetchContentRewardsConfig,
  });

  const RPC_404_KEY = "content_rewards_rpc_unavailable";
  const defaultStatus = { content_rewards_enabled: false, content_rewards_status: "pending" } as const;

  // Server-side status: always reflects DB (avoids RLS/cache issues after admin enable).
  // If RPC is missing (404), skip calling it for the rest of the session to avoid console noise.
  const { data: creatorStatus, isLoading: isStatusLoading, isError: isStatusError } = useQuery({
    queryKey: ["creator-status", user?.id],
    queryFn: async () => {
      if (typeof sessionStorage !== "undefined" && sessionStorage.getItem(RPC_404_KEY)) {
        return defaultStatus;
      }
      const { data, error } = await supabase.rpc("get_my_content_rewards_status");
      if (error) {
        const is404 =
          error.code === "PGRST116" ||
          (error as { status?: number }).status === 404 ||
          /404|not found/i.test(String(error.message));
        if (is404) {
          try {
            sessionStorage.setItem(RPC_404_KEY, "1");
          } catch {
            /* ignore */
          }
          return defaultStatus;
        }
        throw error;
      }
      return data as { content_rewards_enabled?: boolean; content_rewards_status?: string };
    },
    enabled: !!user?.id,
    staleTime: 0,
    retry: false,
  });

  const { data: profileRow, isLoading: isProfileLoading, isError: isProfileError } = useQuery({
    queryKey: ["profile-content-rewards", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, username, full_name, referral_code, content_rewards_enabled, content_rewards_status, membership_plan, account_status")
        .eq("id", user!.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
    staleTime: 0,
  });

  const { data: referralData, isLoading: isReferralDataLoading } = useReferralData(user?.id);
  const { profile: fullProfile, stats } = referralData || {};
  const profile = fullProfile ?? profileRow;

  // Prefer server-side status (always up to date); fallback to profile if RPC missing/fails
  const status = creatorStatus ?? profileRow;
  const isApprovedCreator =
    status?.content_rewards_enabled === true &&
    (status?.content_rewards_status === "approved" || !status?.content_rewards_status);

  const { data: clicksCount } = useQuery({
    queryKey: ["referral-clicks-count", user?.id],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("referral_clicks")
        .select("*", { count: "exact", head: true })
        .eq("referrer_id", user!.id);
      if (error) throw error;
      return count ?? 0;
    },
    enabled: !!user?.id,
  });

  useEffect(() => {
    const s = creatorStatus ?? profileRow;
    if (authLoading || !user || (s == null && !isStatusError) || (creatorStatus == null && isStatusLoading && !profileRow)) return;
    if (s?.content_rewards_status === "suspended") {
      navigate("/content-rewards", { replace: true });
      return;
    }
    if (!s?.content_rewards_enabled || s?.content_rewards_status === "pending") {
      navigate("/content-rewards/apply", { replace: true });
    }
  }, [authLoading, user, isStatusLoading, creatorStatus, profileRow, isStatusError, navigate]);

  const referralUrl =
    typeof window !== "undefined" && profile?.referral_code
      ? `${window.location.origin}/signup?ref=${profile.referral_code}`
      : "";

  const shareCaptions = config?.share_captions ?? {
    tiktok: "Check out ProfitChips! Earn money by training AI. Use my link: {link}",
    youtube: "Learn how to earn online doing AI tasks with ProfitChips. Sign up using my referral link: {link}",
    instagram: "Discover ProfitChips - earn by training AI! Use my link: {link}",
    whatsapp: "Hey! Check out ProfitChips - you can earn money by training AI. Sign up here: {link}",
    telegram: "Join ProfitChips and start earning! Use my link: {link}",
    facebook: "Learn about ProfitChips - a platform where you earn by training AI. Sign up: {link}",
    twitter: "Earn money training AI with ProfitChips! Sign up using my link: {link}",
  };

  const fillLink = (template: string) => (template || "").replace(/\{link\}/g, referralUrl);

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" text="Loading..." />
      </div>
    );
  }

  const hasStatus = creatorStatus != null || profileRow != null;
  if (!hasStatus && (isStatusLoading || isProfileLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" text="Loading..." />
      </div>
    );
  }

  if (isStatusError && !profileRow) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center space-y-2">
          <p className="text-destructive font-medium">Could not verify creator status.</p>
          <p className="text-sm text-muted-foreground">Try refreshing the page or log in again.</p>
        </div>
      </div>
    );
  }

  if (isProfileError) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center space-y-2">
          <p className="text-destructive font-medium">Could not load your profile.</p>
          <p className="text-sm text-muted-foreground">Try refreshing the page or log in again.</p>
        </div>
      </div>
    );
  }

  if (!isApprovedCreator) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background">
        <div className="max-w-md w-full space-y-4 text-center">
          <p className="text-muted-foreground">
            Creator access is not enabled for this account.
          </p>
          <p className="text-sm text-muted-foreground">
            If an admin just enabled you, click <strong>Refresh</strong> to load the latest status.
            Otherwise, complete the application below or ask an admin to enable access for{" "}
            <strong>this</strong> account (the one you’re logged in as).
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
            <Button
              variant="default"
              onClick={() => window.location.reload()}
            >
              Refresh
            </Button>
            <Button variant="outline" onClick={() => navigate("/content-rewards/apply")}>
              Open application
            </Button>
          </div>
          <p className="text-xs text-muted-foreground pt-4">
            Status: {status?.content_rewards_enabled ? "Enabled" : "Not enabled"} •{" "}
            {status?.content_rewards_status || "pending"}
          </p>
        </div>
      </div>
    );
  }

  return (
    <PageLayout
      profile={profile}
      isAdmin={isAdmin}
      onSignOut={signOut}
      isLoading={isReferralDataLoading && !profile}
      loadingText="Loading dashboard..."
    >
      <div className="p-4 lg:p-8 space-y-8">
        <header className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Video className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Creator Dashboard</h1>
            <p className="text-muted-foreground">Content Rewards program</p>
          </div>
        </header>

        {/* Metrics */}
        <section className="flex flex-wrap gap-4">
          <ReferralStatsCard
            totalReferrals={stats?.total_referrals ?? 0}
            activeReferrals={stats?.active_referrals ?? 0}
            totalEarnings={Number(stats?.total_earnings ?? 0)}
            taskCommissionEarnings={Number(stats?.task_commission_earnings ?? 0)}
          />
          <Card className="p-4 min-w-[180px]">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <ExternalLink className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Link Clicks</p>
                <p className="text-2xl font-bold">{clicksCount ?? 0}</p>
              </div>
            </div>
          </Card>
        </section>

        {/* Creator guide */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-primary" />
              Creator guide
            </CardTitle>
            <CardDescription>
              Share your link in tutorials, how-to videos, and posts. You earn when your referrals upgrade or complete tasks.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>• Post tutorials and how-to content; avoid misleading or guaranteed-earnings claims.</p>
            <p>• Use your unique referral link everywhere so we can attribute signups and upgrades to you.</p>
            <p>• Earnings depend on referrals and plan settings; amounts vary.</p>
          </CardContent>
        </Card>

        {/* Share tools */}
        <Card>
          <CardHeader>
            <CardTitle>Your referral link</CardTitle>
            <CardDescription>Copy and share this link in your content</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ReferralCodeCard
              referralCode={profile?.referral_code ?? ""}
              username={profile?.username ?? ""}
              platformName="ProfitChips"
            />
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  navigator.clipboard.writeText(referralUrl);
                  setCopied(true);
                  toast.success("Link copied");
                  setTimeout(() => setCopied(false), 2000);
                }}
              >
                {copied ? <CheckCircle2 className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
                {copied ? "Copied" : "Copy link"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(fillLink(shareCaptions.whatsapp))}`, "_blank")}
              >
                <MessageCircle className="h-4 w-4 mr-2 text-green-600" />
                WhatsApp
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  window.open(
                    `https://t.me/share/url?url=${encodeURIComponent(referralUrl)}&text=${encodeURIComponent(fillLink(shareCaptions.telegram))}`,
                    "_blank"
                  )
                }
              >
                <Send className="h-4 w-4 mr-2 text-blue-500" />
                Telegram
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(fillLink(shareCaptions.twitter))}`, "_blank")
                }
              >
                <Twitter className="h-4 w-4 mr-2" />
                Twitter
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(referralUrl)}`, "_blank")
                }
              >
                <Facebook className="h-4 w-4 mr-2" />
                Facebook
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Commission history */}
        <Card>
          <CardHeader>
            <CardTitle>Earnings history</CardTitle>
            <CardDescription>Commissions from your referrals</CardDescription>
          </CardHeader>
          <CardContent>
            <CommissionHistoryList userId={user!.id} />
          </CardContent>
        </Card>
      </div>
    </PageLayout>
  );
}
