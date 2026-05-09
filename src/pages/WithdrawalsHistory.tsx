import { useState, useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import LandingNavbar from "@/components/LandingNavbar";
import LandingFooter from "@/components/LandingFooter";
import { getPaymentMethodDisplayName } from "@/lib/payment-processor-utils";
import {
  CheckCircle2,
  Globe2,
  Loader2,
  TrendingUp,
  Users,
  AlertCircle,
  ChevronDown,
} from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────────────────

interface PublicWithdrawal {
  id: string;
  net_amount: number;
  payment_method: string;
  processed_at: string;
  created_at: string;
  profiles: {
    username: string;
    country: string | null;
    registration_country_name: string | null;
  } | null;
}

interface StatsRow {
  count: number;
}

// ─── Utilities ───────────────────────────────────────────────────────────────

const maskUsername = (username: string): string => {
  if (!username) return "**";
  return username.length <= 2
    ? username[0] + "***"
    : username.slice(0, 2) + "***";
};

const countryCodeToFlag = (code: string | null): string => {
  if (!code || code.length !== 2) return "🌍";
  return String.fromCodePoint(
    ...[...code.toUpperCase()].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65)
  );
};

const formatDate = (dateStr: string): string => {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const formatTime = (dateStr: string): string => {
  const d = new Date(dateStr);
  return d.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
};

const formatAmount = (amount: number): string => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(amount);
};



const PAGE_SIZE = 20;

// ─── Component ───────────────────────────────────────────────────────────────

export default function WithdrawalsHistory() {
  const [enabled, setEnabled] = useState<boolean | null>(null); // null = loading
  const [withdrawals, setWithdrawals] = useState<PublicWithdrawal[]>([]);
  const [stats, setStats] = useState<StatsRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  // ── Check if page is enabled ────────────────────────────────────────────
  useEffect(() => {
    const checkEnabled = async () => {
      try {
        const { data, error } = await supabase
          .from("platform_config")
          .select("value")
          .eq("key", "public_pages")
          .maybeSingle();

        if (error) throw error;

        const isEnabled = data?.value?.withdrawalsHistoryEnabled === true;
        setEnabled(isEnabled);
      } catch {
        setEnabled(false);
      }
    };
    checkEnabled();
  }, []);

  // ── Fetch stats (count only) ────────────────────────────────────────────
  useEffect(() => {
    if (!enabled) return;

    const fetchStats = async () => {
      try {
        const { count, error } = await supabase
          .from("withdrawal_requests")
          .select("id", { count: "exact", head: true })
          .eq("status", "completed");

        if (error) throw error;
        setStats({ count: count ?? 0 });
      } catch {
        // Non-fatal — stat is supplementary
        setStats(null);
      }
    };

    fetchStats();
  }, [enabled]);

  // ── Fetch paginated withdrawals ─────────────────────────────────────────
  useEffect(() => {
    if (!enabled) return;
    fetchWithdrawals(0, true);
  }, [enabled]);

  const fetchWithdrawals = async (pageIndex: number, reset = false) => {
    if (reset) setLoading(true);
    else setLoadingMore(true);
    setError(null);

    try {
      const from = pageIndex * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      // NEVER use SELECT * — explicitly name safe columns only
      const { data: wData, error: wError } = await supabase
        .from("withdrawal_requests")
        .select("id, net_amount, payment_method, processed_at, created_at")
        .eq("status", "completed")
        .order("processed_at", { ascending: false })
        .range(from, to);

      if (wError) throw wError;

      const rows = wData || [];

      // Fetch profiles separately to avoid relationship ambiguity
      // Only select username and country — never email, phone, payout_address
      if (rows.length > 0) {
        // Get user_ids via a separate query scoped to withdrawal IDs
        const { data: fullRows, error: fullError } = await supabase
          .from("withdrawal_requests")
          .select("id, user_id")
          .in("id", rows.map((r) => r.id));

        if (fullError) throw fullError;

        const userIdMap = new Map(
          (fullRows || []).map((r) => [r.id, r.user_id])
        );
        const userIds = [...new Set([...userIdMap.values()].filter(Boolean))];

        let profileMap = new Map<string, PublicWithdrawal["profiles"]>();

        if (userIds.length > 0) {
          const { data: pData, error: pError } = await supabase
            .from("profiles")
            .select("id, username, country, registration_country_name")
            .in("id", userIds);

          if (pError) throw pError;

          profileMap = new Map(
            (pData || []).map((p) => [
              p.id,
              {
                username: p.username || "User",
                country: p.country || null,
                registration_country_name: p.registration_country_name || null,
              },
            ])
          );
        }

        const merged: PublicWithdrawal[] = rows.map((r) => ({
          id: r.id,
          net_amount: Number(r.net_amount),
          payment_method: r.payment_method,
          processed_at: r.processed_at || r.created_at,
          created_at: r.created_at,
          profiles: profileMap.get(userIdMap.get(r.id) || "") || null,
        }));

        setWithdrawals((prev) => (reset ? merged : [...prev, ...merged]));
        setHasMore(rows.length === PAGE_SIZE);
      } else {
        if (reset) setWithdrawals([]);
        setHasMore(false);
      }

      setPage(pageIndex);
    } catch (err: any) {
      setError(
        err?.message ||
          "Failed to load withdrawals. Please refresh and try again."
      );
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const handleLoadMore = () => {
    if (!loadingMore && hasMore) {
      fetchWithdrawals(page + 1);
    }
  };

  // ── Render: loading config ─────────────────────────────────────────────
  if (enabled === null) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // ── Render: disabled / not found ───────────────────────────────────────
  if (!enabled) {
    return (
      <div className="min-h-screen bg-background">
        <LandingNavbar />
        <div className="flex flex-col items-center justify-center min-h-[80vh] text-center px-4">
          <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-6">
            <AlertCircle className="h-10 w-10 text-primary" />
          </div>
          <h1 className="text-3xl font-bold text-foreground mb-3">
            Page Not Available
          </h1>
          <p className="text-muted-foreground text-lg max-w-md mb-8">
            This page is not currently available. Please check back later.
          </p>
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-colors"
          >
            ← Back to Home
          </Link>
        </div>
        <LandingFooter />
      </div>
    );
  }

  // ── Render: main page ─────────────────────────────────────────────────
  return (
    <>
      <Helmet>
        <title>Withdrawals History — ProfitChips | Proof of Real Earnings</title>
        <meta
          name="description"
          content="See real completed payouts made to ProfitChips members worldwide. Transparent withdrawal records showing real earnings from AI training tasks."
        />
        <link
          rel="canonical"
          href="https://profitchips.com/withdrawals-history"
        />
      </Helmet>

      <div className="min-h-screen bg-background">
        <LandingNavbar />

        {/* ── Hero ──────────────────────────────────────────────────────── */}
        <section
          style={{
            background:
              "linear-gradient(135deg, hsl(145 60% 10%) 0%, hsl(145 50% 15%) 50%, hsl(145 40% 12%) 100%)",
          }}
          className="pt-32 pb-16 px-4 relative overflow-hidden"
        >
          {/* Decorative glow */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] rounded-full opacity-10 blur-3xl pointer-events-none"
            style={{ background: "radial-gradient(circle, hsl(145 70% 50%), transparent)" }}
          />

          <div className="container mx-auto max-w-4xl text-center relative z-10">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-white/10 bg-white/5 text-green-300 text-sm font-medium mb-6 backdrop-blur-sm">
              <CheckCircle2 className="h-4 w-4" />
              Verified Completed Payouts
            </div>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-4 leading-tight">
              Real Money.{" "}
              <span className="text-green-400">Real People.</span>
            </h1>
            <p className="text-xl text-white/70 max-w-2xl mx-auto leading-relaxed">
              Every record below is a verified withdrawal paid to a ProfitChips
              member. Your earnings are real — and so are theirs.
            </p>

            {/* Stats — count only */}
            {stats && (
              <div className="flex justify-center mt-10">
                <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm px-10 py-5 inline-flex flex-col items-center gap-1">
                  <div className="flex items-center gap-2 text-green-400">
                    <Users className="h-5 w-5" />
                    <span className="text-sm font-medium">Completed Payouts</span>
                  </div>
                  <div className="text-4xl font-bold text-white">
                    {stats.count.toLocaleString()}
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* ── Feed ──────────────────────────────────────────────────────── */}
        <section className="py-12 px-4">
          <div className="container mx-auto max-w-4xl">

            {/* Loading */}
            {loading && (
              <div className="flex flex-col items-center justify-center py-24 gap-4">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <p className="text-muted-foreground">Loading withdrawals…</p>
              </div>
            )}

            {/* Error */}
            {!loading && error && (
              <div className="rounded-2xl border border-red-500/30 bg-red-500/5 p-8 text-center">
                <AlertCircle className="h-10 w-10 text-red-500 mx-auto mb-3" />
                <p className="text-red-400 font-medium mb-4">{error}</p>
                <button
                  onClick={() => fetchWithdrawals(0, true)}
                  className="px-5 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
                >
                  Try Again
                </button>
              </div>
            )}

            {/* Empty state */}
            {!loading && !error && withdrawals.length === 0 && (
              <div className="flex flex-col items-center justify-center py-24 gap-4">
                <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
                  <TrendingUp className="h-10 w-10 text-primary" />
                </div>
                <h2 className="text-xl font-semibold text-foreground">
                  No withdrawals yet
                </h2>
                <p className="text-muted-foreground text-center max-w-sm">
                  Completed payouts will appear here as members withdraw their
                  earnings.
                </p>
              </div>
            )}

            {/* Feed list */}
            {!loading && !error && withdrawals.length > 0 && (
              <>
                <div className="space-y-3">
                  {withdrawals.map((w) => {
                    const masked = maskUsername(w.profiles?.username || "User");
                    const flag = countryCodeToFlag(w.profiles?.country || null);
                    const countryName =
                      w.profiles?.registration_country_name ||
                      w.profiles?.country ||
                      "Unknown";
                    const method = getPaymentMethodDisplayName(
                      w.payment_method,
                      false
                    );
                    const dateStr = formatDate(w.processed_at);
                    const timeStr = formatTime(w.processed_at);

                    return (
                      <div
                        key={w.id}
                        className="group relative rounded-2xl border border-border/60 bg-card hover:border-primary/30 hover:bg-card/80 transition-all duration-200 overflow-hidden"
                      >
                        {/* Left accent bar */}
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-green-500 to-green-700 rounded-l-2xl" />

                        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 px-5 py-4 pl-6">
                          {/* Avatar + identity */}
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            {/* Flag avatar */}
                            <div className="flex-shrink-0 w-11 h-11 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-2xl">
                              {flag}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-foreground truncate">
                                <span className="text-primary font-bold">{masked}</span>
                                {" "}
                                <span className="text-muted-foreground font-normal">from</span>
                                {" "}
                                <span className="inline-flex items-center gap-1">
                                  {flag} {countryName}
                                </span>
                                {" "}
                                <span className="text-muted-foreground font-normal">withdrew</span>
                              </p>
                              <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5">
                                <Globe2 className="h-3 w-3 inline" />
                                {method}
                                <span className="opacity-40">·</span>
                                {dateStr}
                                <span className="opacity-40">·</span>
                                {timeStr}
                              </p>
                            </div>
                          </div>

                          {/* Amount + badge */}
                          <div className="flex items-center gap-3 sm:flex-shrink-0 justify-between sm:justify-end">
                            <span className="text-xl font-bold text-green-500">
                              {formatAmount(w.net_amount)}
                            </span>
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-500/10 border border-green-500/20 text-green-500 text-xs font-semibold">
                              <CheckCircle2 className="h-3 w-3" />
                              Completed
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Load More */}
                {hasMore && (
                  <div className="flex justify-center mt-8">
                    <button
                      id="load-more-withdrawals"
                      onClick={handleLoadMore}
                      disabled={loadingMore}
                      className="inline-flex items-center gap-2 px-8 py-3 rounded-xl border border-border bg-card hover:bg-card/80 hover:border-primary/30 text-foreground font-medium transition-all duration-200 disabled:opacity-60"
                    >
                      {loadingMore ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Loading…
                        </>
                      ) : (
                        <>
                          <ChevronDown className="h-4 w-4" />
                          Load More
                        </>
                      )}
                    </button>
                  </div>
                )}

                {/* End of list */}
                {!hasMore && withdrawals.length > 0 && (
                  <p className="text-center text-muted-foreground text-sm mt-8">
                    Showing all {withdrawals.length.toLocaleString()} completed withdrawals
                  </p>
                )}
              </>
            )}
          </div>
        </section>

        {/* ── Trust CTA ─────────────────────────────────────────────────── */}
        <section className="py-16 px-4 border-t border-border/50">
          <div className="container mx-auto max-w-2xl text-center">
            <h2 className="text-2xl font-bold text-foreground mb-3">
              Ready to start earning?
            </h2>
            <p className="text-muted-foreground mb-6">
              Join thousands of members already getting paid for AI training
              tasks — from anywhere in the world.
            </p>
            <Link
              to="/signup"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-primary text-primary-foreground font-semibold text-lg hover:bg-primary/90 transition-colors"
            >
              Get Started Free →
            </Link>
          </div>
        </section>

        <LandingFooter />
      </div>
    </>
  );
}
