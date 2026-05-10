import { useState, useMemo } from "react";
import { Helmet } from "react-helmet-async";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  Gift,
  Copy,
  Check,
  Users,
  TrendingUp,
  DollarSign,
  ChevronRight,
  Info,
  Star,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

// ─── Constants (fallback if DB fetch fails) ───────────────────────────────────
const FALLBACK_TASKS_PER_DAY = 10;
const FALLBACK_EARN_PER_TASK = 0.38;
const FALLBACK_COMMISSION_RATE = 0.10;

// ─── Helpers ─────────────────────────────────────────────────────────────────
const formatUSD = (amount: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);

// ─── Component ───────────────────────────────────────────────────────────────
export default function InviteEarn() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [friendsPerDay, setFriendsPerDay] = useState(5);
  const [copied, setCopied] = useState(false);

  // ── Fetch Junior plan rates live from DB ───────────────────────────────────
  const { data: juniorPlan } = useQuery({
    queryKey: ["junior-plan-rates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("membership_plans")
        .select("daily_task_limit, earning_per_task, task_commission_rate, display_name")
        .eq("account_type", "personal")
        .order("price", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    staleTime: 10 * 60 * 1000,
  });

  // ── Fetch user profile (referral code) ────────────────────────────────────
  const { data: profile } = useQuery({
    queryKey: ["invite-earn-profile", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("referral_code, username")
        .eq("id", user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
  });

  // ── Fetch user's real referral stats ──────────────────────────────────────
  const { data: stats } = useQuery({
    queryKey: ["invite-earn-stats", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase.rpc("get_referral_stats", {
        user_uuid: user.id,
      });
      if (error) return null;
      return data?.[0] ?? null;
    },
    enabled: !!user?.id,
    staleTime: 2 * 60 * 1000,
  });

  // ── Live plan values (with fallback) ──────────────────────────────────────
  const tasksPerDay = juniorPlan?.daily_task_limit ?? FALLBACK_TASKS_PER_DAY;
  const earnPerTask = Number(juniorPlan?.earning_per_task ?? FALLBACK_EARN_PER_TASK);
  const commissionRate = Number(juniorPlan?.task_commission_rate ?? FALLBACK_COMMISSION_RATE);
  const planName = juniorPlan?.display_name ?? "Junior Account";
  const commissionPerDay = earnPerTask * tasksPerDay * commissionRate;

  // ── Calculator (recalculates on slider move only — no network) ────────────
  const calc = useMemo(() => {
    const totalReferrals = friendsPerDay * 30;
    // Sum of days 1..30 for friends invited each day = n × 465
    const month1ReferralDays = friendsPerDay * 465;
    const month1Income = month1ReferralDays * commissionPerDay;
    const month2Income = totalReferrals * 30 * commissionPerDay;
    return { totalReferrals, month1Income, month2Income };
  }, [friendsPerDay, commissionPerDay]);

  // ── Referral link ─────────────────────────────────────────────────────────
  const referralLink = profile?.referral_code
    ? `${window.location.origin}/signup?ref=${profile.referral_code}`
    : null;

  const handleCopy = async () => {
    const text = referralLink ?? "";
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success("Referral link copied!");
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.error("Could not copy. Please copy manually.");
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <>
      <Helmet>
        <title>Invite & Earn US$800+ | ProfitChips</title>
        <meta
          name="description"
          content="Earn over US$800 in your first month by inviting friends to ProfitChips. Use our interactive calculator to see your potential."
        />
      </Helmet>

      <div className="min-h-screen pb-24 lg:pb-12">

        {/* ── Hero ─────────────────────────────────────────────────────────── */}
        <div
          className="relative overflow-hidden px-4 pt-10 pb-12"
          style={{
            background:
              "linear-gradient(135deg, hsl(145 60% 8%) 0%, hsl(145 55% 13%) 50%, hsl(145 45% 10%) 100%)",
          }}
        >
          {/* Glow */}
          <div
            className="absolute -top-20 left-1/2 -translate-x-1/2 w-[500px] h-[300px] rounded-full opacity-15 blur-3xl pointer-events-none"
            style={{ background: "radial-gradient(circle, hsl(145 80% 45%), transparent)" }}
          />

          <div className="relative z-10 max-w-2xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-green-500/30 bg-green-500/10 text-green-300 text-xs font-semibold mb-5 tracking-wide uppercase">
              <Gift className="h-3.5 w-3.5" />
              Referral Income Calculator
            </div>

            <h1 className="text-4xl md:text-5xl font-extrabold text-white leading-tight mb-3">
              Invite Friends.{" "}
              <span
                className="text-transparent bg-clip-text"
                style={{
                  backgroundImage:
                    "linear-gradient(90deg, hsl(145 70% 55%), hsl(145 60% 70%))",
                }}
              >
                Earn US$800+
              </span>
            </h1>

            <p className="text-white/65 text-base md:text-lg max-w-xl mx-auto leading-relaxed">
              Every friend you refer who completes tasks earns you a daily
              commission — automatically. The more you invite, the more you earn.
            </p>
          </div>
        </div>

        <div className="max-w-3xl mx-auto px-4 -mt-4 space-y-6">

          {/* ── Calculator Card ───────────────────────────────────────────── */}
          <div
            className="rounded-2xl border border-white/10 p-6 md:p-8 shadow-2xl"
            style={{
              background:
                "linear-gradient(135deg, hsl(145 55% 11%) 0%, hsl(145 45% 14%) 100%)",
            }}
          >
            {/* Slider */}
            <div className="mb-8">
              <div className="flex items-center justify-between mb-2">
                <span className="text-white/70 text-sm font-medium">
                  Friends invited per day
                </span>
                <span
                  className="text-2xl font-bold"
                  style={{ color: "hsl(145 70% 55%)" }}
                >
                  {friendsPerDay}
                </span>
              </div>
              <input
                id="friends-slider"
                type="range"
                min={1}
                max={20}
                step={1}
                value={friendsPerDay}
                onChange={(e) => setFriendsPerDay(Number(e.target.value))}
                className="w-full h-2 rounded-full appearance-none cursor-pointer"
                style={{
                  background: `linear-gradient(to right, hsl(145 70% 45%) 0%, hsl(145 70% 45%) ${((friendsPerDay - 1) / 19) * 100}%, hsl(145 20% 25%) ${((friendsPerDay - 1) / 19) * 100}%, hsl(145 20% 25%) 100%)`,
                }}
              />
              <div className="flex justify-between text-white/30 text-xs mt-1">
                <span>1</span>
                <span>5</span>
                <span>10</span>
                <span>15</span>
                <span>20</span>
              </div>
            </div>

            {/* Results — 3 metric cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              {/* Total Referrals */}
              <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-center">
                <div className="flex items-center justify-center gap-1.5 text-white/50 text-xs mb-1">
                  <Users className="h-3.5 w-3.5" />
                  Total referrals (30 days)
                </div>
                <div className="text-3xl font-bold text-white">
                  {calc.totalReferrals.toLocaleString()}
                </div>
              </div>

              {/* Month 1 */}
              <div
                className="rounded-xl border p-4 text-center relative overflow-hidden"
                style={{
                  borderColor: "hsl(145 70% 40% / 0.5)",
                  background:
                    "linear-gradient(135deg, hsl(145 60% 14%), hsl(145 50% 17%))",
                }}
              >
                <div className="flex items-center justify-center gap-1.5 text-green-300/70 text-xs mb-1">
                  <TrendingUp className="h-3.5 w-3.5" />
                  Month 1 income
                </div>
                <div
                  className="text-3xl font-bold"
                  style={{ color: "hsl(145 70% 60%)" }}
                >
                  {formatUSD(calc.month1Income)}
                </div>
                <div className="absolute top-1.5 right-1.5">
                  <Star className="h-3 w-3 text-green-400/40" />
                </div>
              </div>

              {/* Month 2+ */}
              <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-center">
                <div className="flex items-center justify-center gap-1.5 text-white/50 text-xs mb-1">
                  <DollarSign className="h-3.5 w-3.5" />
                  Month 2+ potential
                </div>
                <div className="text-3xl font-bold text-white">
                  {formatUSD(calc.month2Income)}
                  <span className="text-base text-white/40">/mo</span>
                </div>
              </div>
            </div>

            {/* Formula Breakdown */}
            <div className="rounded-xl border border-white/10 bg-black/20 p-4 text-sm font-mono text-white/60 space-y-1.5">
              <div className="text-white/30 text-xs uppercase tracking-widest mb-2">
                How it's calculated
              </div>
              <div>
                <span className="text-green-400">commission/day</span>
                {" = "}
                {tasksPerDay} tasks × ${earnPerTask.toFixed(2)}/task ×{" "}
                {(commissionRate * 100).toFixed(0)}% ={" "}
                <span className="text-white">${commissionPerDay.toFixed(2)}/referral/day</span>
              </div>
              <div>
                <span className="text-green-400">month 1 referral-days</span>
                {" = "}
                {friendsPerDay} × (30+29+…+1) ={" "}
                <span className="text-white">
                  {(friendsPerDay * 465).toLocaleString()}
                </span>
              </div>
              <div>
                <span className="text-green-400">month 1 income</span>
                {" = "}
                {(friendsPerDay * 465).toLocaleString()} ×{" "}
                ${commissionPerDay.toFixed(2)} ={" "}
                <span className="text-white font-bold">
                  {formatUSD(calc.month1Income)}
                </span>
              </div>
              <div className="pt-1 text-white/30 text-xs">
                Assumes referrals use <span className="text-white/50">{planName}</span> ({tasksPerDay} tasks/day, ${earnPerTask.toFixed(2)}/task, {(commissionRate * 100).toFixed(0)}% commission)
              </div>
            </div>
          </div>

          {/* ── Your Referral Link ────────────────────────────────────────── */}
          <div
            className="rounded-2xl border border-white/10 p-6"
            style={{ background: "hsl(145 50% 10%)" }}
          >
            <h2 className="text-white font-bold text-lg mb-1 flex items-center gap-2">
              <Gift className="h-5 w-5 text-green-400" />
              Your Referral Link
            </h2>
            <p className="text-white/50 text-sm mb-4">
              Share this link — anyone who signs up through it becomes your referral.
            </p>

            {referralLink ? (
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="flex-1 flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3 overflow-hidden">
                  <span className="text-green-300 font-mono text-sm truncate">
                    {referralLink}
                  </span>
                </div>
                <button
                  onClick={handleCopy}
                  className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-semibold text-sm transition-all duration-200"
                  style={{
                    background: copied
                      ? "hsl(145 60% 30%)"
                      : "hsl(145 70% 40%)",
                    color: "#fff",
                  }}
                >
                  {copied ? (
                    <>
                      <Check className="h-4 w-4" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4" />
                      Copy Link
                    </>
                  )}
                </button>
              </div>
            ) : (
              <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white/30 text-sm">
                Loading your referral link…
              </div>
            )}

            {profile?.referral_code && (
              <p className="text-white/30 text-xs mt-2">
                Your referral code:{" "}
                <span className="text-white/60 font-mono font-bold">
                  {profile.referral_code}
                </span>
              </p>
            )}
          </div>

          {/* ── Your Real Stats ───────────────────────────────────────────── */}
          {stats && (
            <div
              className="rounded-2xl border border-white/10 p-6"
              style={{ background: "hsl(145 50% 10%)" }}
            >
              <h2 className="text-white font-bold text-lg mb-4 flex items-center gap-2">
                <Zap className="h-5 w-5 text-green-400" />
                Your Progress So Far
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: "Total Referrals", value: stats.total_referrals ?? 0 },
                  { label: "Active Referrals", value: stats.active_referrals ?? 0 },
                  {
                    label: "Task Commissions",
                    value: formatUSD(Number(stats.task_commission_earnings ?? 0)),
                  },
                  {
                    label: "Total Earned",
                    value: formatUSD(Number(stats.total_earnings ?? 0)),
                  },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="rounded-xl border border-white/10 bg-white/5 p-3 text-center"
                  >
                    <div className="text-white/40 text-xs mb-1">{item.label}</div>
                    <div className="text-xl font-bold text-white">
                      {item.value}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── How It Works ──────────────────────────────────────────────── */}
          <div
            className="rounded-2xl border border-white/10 p-6"
            style={{ background: "hsl(145 50% 10%)" }}
          >
            <h2 className="text-white font-bold text-lg mb-5">How It Works</h2>
            <div className="space-y-4">
              {[
                {
                  step: "1",
                  title: "Share your referral link",
                  desc: "Copy your unique link above and share it with friends on WhatsApp, social media, or anywhere.",
                },
                {
                  step: "2",
                  title: "They join & activate an account",
                  desc: `When your friend signs up and gets an active plan (e.g. ${planName}), they start completing tasks.`,
                },
                {
                  step: "3",
                  title: "You earn every day they work",
                  desc: `For every task your referral completes, you earn ${(commissionRate * 100).toFixed(0)}% commission — automatically credited to your earnings wallet.`,
                },
              ].map((item) => (
                <div key={item.step} className="flex gap-4">
                  <div
                    className="flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center text-sm font-bold text-white"
                    style={{ background: "hsl(145 65% 35%)" }}
                  >
                    {item.step}
                  </div>
                  <div>
                    <div className="text-white font-semibold text-sm">
                      {item.title}
                    </div>
                    <div className="text-white/50 text-sm leading-relaxed">
                      {item.desc}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── CTA ───────────────────────────────────────────────────────── */}
          <Button
            onClick={() => navigate("/referrals")}
            size="lg"
            className="w-full py-6 text-base font-bold rounded-xl text-white transition-all duration-200 hover:opacity-90 flex items-center justify-center gap-2"
            style={{
              background:
                "linear-gradient(135deg, hsl(145 70% 38%), hsl(145 65% 30%))",
            }}
          >
            View My Referrals
            <ChevronRight className="h-5 w-5" />
          </Button>

          {/* ── Disclaimer ────────────────────────────────────────────────── */}
          <div className="flex gap-3 rounded-xl border border-white/5 bg-white/3 p-4">
            <Info className="h-4 w-4 text-white/30 flex-shrink-0 mt-0.5" />
            <p className="text-white/35 text-xs leading-relaxed">
              <strong className="text-white/50">Earnings Disclaimer:</strong>{" "}
              The figures above are estimates based on the assumption that each
              referred friend holds an active {planName} and completes{" "}
              {tasksPerDay} tasks every day. Actual earnings depend entirely on
              your referrals' activity and account status. Income is not
              guaranteed. ProfitChips does not promise any specific level of
              earnings from referrals.
            </p>
          </div>

        </div>
      </div>

      {/* Slider thumb styling */}
      <style>{`
        input[type="range"]::-webkit-slider-thumb {
          -webkit-appearance: none;
          height: 20px;
          width: 20px;
          border-radius: 50%;
          background: hsl(145 70% 55%);
          cursor: pointer;
          border: 3px solid hsl(145 60% 10%);
          box-shadow: 0 0 0 2px hsl(145 70% 45%);
        }
        input[type="range"]::-moz-range-thumb {
          height: 20px;
          width: 20px;
          border-radius: 50%;
          background: hsl(145 70% 55%);
          cursor: pointer;
          border: 3px solid hsl(145 60% 10%);
          box-shadow: 0 0 0 2px hsl(145 70% 45%);
        }
      `}</style>
    </>
  );
}
