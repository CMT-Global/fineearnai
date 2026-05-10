import { useState } from "react";
import { Helmet } from "react-helmet-async";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  Video,
  CheckCircle,
  Clock,
  XCircle,
  ChevronRight,
  ExternalLink,
  Info,
  Star,
  Upload,
  Play,
  AlertCircle,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────────────────────
type Platform = "tiktok" | "youtube_shorts" | "youtube_longform";
type Status = "pending" | "approved" | "rejected";

interface Submission {
  id: string;
  video_url: string;
  platform: Platform;
  video_title: string | null;
  follower_count: string | null;
  additional_notes: string | null;
  status: Status;
  rejection_reason: string | null;
  reward_amount: number;
  created_at: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const PLATFORMS: { value: Platform; label: string; emoji: string; hint: string }[] = [
  { value: "tiktok",           label: "TikTok",           emoji: "🎵", hint: "Short-form video" },
  { value: "youtube_shorts",   label: "YouTube Shorts",   emoji: "▶️", hint: "Under 60 seconds" },
  { value: "youtube_longform", label: "YouTube Longform", emoji: "🎬", hint: "Over 60 seconds" },
];

const PAYOUT_MILESTONES = [
  {
    label: "Starter",
    reach: "5,000 views",
    reward: "US$30",
    color: "hsl(145 55% 32%)",
    glow: "hsl(145 55% 32% / 0.25)",
  },
  {
    label: "Growing",
    reach: "10,000 views",
    reward: "US$60",
    color: "hsl(145 58% 36%)",
    glow: "hsl(145 58% 36% / 0.25)",
  },
  {
    label: "Popular",
    reach: "20,000 views",
    reward: "US$100",
    color: "hsl(145 62% 40%)",
    glow: "hsl(145 62% 40% / 0.25)",
  },
  {
    label: "Viral",
    reach: "30,000+ views",
    reward: "US$150",
    color: "hsl(145 70% 45%)",
    glow: "hsl(145 70% 45% / 0.30)",
    highlight: true,
  },
];

const HOW_IT_WORKS = [
  {
    step: "1",
    title: "Create your video",
    desc: "Record an authentic TikTok or YouTube video in any language, teaching people about ProfitChips, Earning Online, AI Training Jobs, and much more — be creative!",
    icon: "🎬",
  },
  {
    step: "2",
    title: "Submit for review",
    desc: "Send us your draft or private video link before posting publicly so our team can check the content.",
    icon: "📤",
  },
  {
    step: "3",
    title: "Get approved",
    desc: "Our support team reviews your video. Approved videos can then be published on your TikTok or YouTube account.",
    icon: "✅",
  },
  {
    step: "4",
    title: "Publish your video",
    desc: "Post the approved video publicly and make sure your ProfitChips message is clear, honest, and educational.",
    icon: "🌍",
  },
  {
    step: "5",
    title: "We verify views",
    desc: "Keep your public link active while our team checks your views and confirms the milestone reached.",
    icon: "👁️",
  },
  {
    step: "6",
    title: "Reward is credited",
    desc: "Once verified, your reward is added to your ProfitChips wallet and can be withdrawn through the normal withdrawal process.",
    icon: "💰",
  },
];

const PROGRAM_RULES = [
  "1 video submission per day (maximum 5 per week)",
  "Videos must be authentic and educational — not promotional ads",
  "Submit for review before publishing publicly",
  "Rewards are paid after our team verifies view counts",
  "Views must be genuine — artificially inflated views will be rejected",
  "Content must clearly feature and explain ProfitChips",
];

// ─── Status display ───────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<Status, { label: string; icon: React.ElementType; color: string; bg: string }> = {
  pending:  { label: "Under Review",  icon: Clock,       color: "text-amber-300", bg: "bg-amber-500/15 border-amber-500/30" },
  approved: { label: "Approved",      icon: CheckCircle, color: "text-green-300", bg: "bg-green-500/15 border-green-500/30" },
  rejected: { label: "Rejected",      icon: XCircle,     color: "text-red-300",   bg: "bg-red-500/15 border-red-500/30" },
};

const getPlatformInfo = (p: Platform) => PLATFORMS.find((x) => x.value === p);
const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });

// ─── Component ────────────────────────────────────────────────────────────────
export default function GetPaidToPost() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [platform, setPlatform] = useState<Platform>("tiktok");
  const [videoUrl, setVideoUrl] = useState("");
  const [videoTitle, setVideoTitle] = useState("");
  const [followerCount, setFollowerCount] = useState("");
  const [notes, setNotes] = useState("");
  const [urlError, setUrlError] = useState("");

  // ── Past submissions ───────────────────────────────────────────────────────
  const { data: submissions = [], isLoading: loadingSubs } = useQuery<Submission[]>({
    queryKey: ["content-reward-submissions", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("content_reward_submissions")
        .select("id,video_url,platform,video_title,follower_count,additional_notes,status,rejection_reason,reward_amount,created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Submission[];
    },
    enabled: !!user?.id,
    staleTime: 60 * 1000,
  });

  // ── Submit mutation ────────────────────────────────────────────────────────
  const { mutate: submitVideo, isPending: submitting } = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error("Not authenticated");
      const { error } = await supabase.from("content_reward_submissions").insert({
        user_id:          user.id,
        platform,
        video_url:        videoUrl.trim(),
        video_title:      videoTitle.trim() || null,
        follower_count:   followerCount.trim() || null,
        additional_notes: notes.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Submission received! We'll review it within 48 hours.");
      setVideoUrl("");
      setVideoTitle("");
      setFollowerCount("");
      setNotes("");
      setUrlError("");
      queryClient.invalidateQueries({ queryKey: ["content-reward-submissions", user?.id] });
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to submit. Please try again.");
    },
  });

  // ── Validate ───────────────────────────────────────────────────────────────
  const validateAndSubmit = () => {
    const trimmed = videoUrl.trim();
    if (!trimmed) { setUrlError("Please enter your video link."); return; }
    try { new URL(trimmed); } catch {
      setUrlError("Please enter a valid URL (must start with https://).");
      return;
    }
    setUrlError("");
    submitVideo();
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      <Helmet>
        <title>Get Paid To Post $150+ | ProfitChips Content Rewards</title>
        <meta
          name="description"
          content="Earn over US$150 weekly by creating TikTok or YouTube content about ProfitChips. Submit your video for review and get paid at verified view milestones."
        />
      </Helmet>

      <div className="min-h-screen pb-24 lg:pb-12">

        {/* ── Hero ─────────────────────────────────────────────────────────── */}
        <div
          className="relative overflow-hidden px-4 pt-10 pb-14"
          style={{
            background:
              "linear-gradient(135deg, hsl(145 60% 7%) 0%, hsl(145 55% 13%) 55%, hsl(145 45% 9%) 100%)",
          }}
        >
          <div
            className="absolute -top-16 left-1/2 -translate-x-1/2 w-[550px] h-[280px] rounded-full opacity-10 blur-3xl pointer-events-none"
            style={{ background: "radial-gradient(circle, hsl(145 80% 50%), transparent)" }}
          />
          <div className="relative z-10 max-w-2xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-green-500/30 bg-green-500/10 text-green-300 text-xs font-semibold mb-5 tracking-wide uppercase">
              <Video className="h-3.5 w-3.5" />
              Content Rewards Program
            </div>

            <h1 className="text-4xl md:text-5xl font-extrabold text-white leading-tight mb-4">
              Earn Over{" "}
              <span
                className="text-transparent bg-clip-text"
                style={{
                  backgroundImage: "linear-gradient(90deg, hsl(145 70% 55%), hsl(145 60% 72%))",
                }}
              >
                US$150 Weekly
              </span>
              <br />
              Creating ProfitChips Content
            </h1>

            <p className="text-white/60 text-base md:text-lg max-w-xl mx-auto leading-relaxed">
              Create authentic TikTok or YouTube videos that educate people about ProfitChips and
              earn rewards when your content reaches verified view milestones.
            </p>

            {/* Platform badges */}
            <div className="flex items-center justify-center gap-3 mt-5 flex-wrap">
              {PLATFORMS.map((p) => (
                <span
                  key={p.value}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-white/15 bg-white/8 text-white/60 text-xs"
                >
                  <span>{p.emoji}</span>
                  {p.label}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="max-w-3xl mx-auto px-4 -mt-2 space-y-6">

          {/* ── How It Works ─────────────────────────────────────────────── */}
          <div
            className="rounded-2xl border border-white/10 p-6 md:p-8"
            style={{ background: "linear-gradient(135deg, hsl(145 55% 10%), hsl(145 45% 13%))" }}
          >
            <h2 className="text-white font-bold text-xl mb-6 flex items-center gap-2">
              <Play className="h-5 w-5 text-green-400" />
              How It Works
            </h2>

            {/* Mobile: stacked list | Desktop: 2-col grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {HOW_IT_WORKS.map((step, idx) => (
                <div
                  key={step.step}
                  className="relative flex gap-3 rounded-xl border border-white/8 bg-white/4 p-4"
                >
                  {/* Step number + emoji */}
                  <div className="flex flex-col items-center gap-1 flex-shrink-0">
                    <div
                      className="h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold text-white"
                      style={{ background: "hsl(145 65% 33%)" }}
                    >
                      {step.step}
                    </div>
                    <span className="text-xl leading-none">{step.icon}</span>
                  </div>

                  {/* Content */}
                  <div className="min-w-0">
                    <div className="text-white font-semibold text-sm leading-snug mb-1">
                      {step.title}
                    </div>
                    <div className="text-white/50 text-xs leading-relaxed">{step.desc}</div>
                  </div>

                  {/* Arrow connector — right edge on even pairs (desktop only) */}
                  {idx % 2 === 0 && idx < HOW_IT_WORKS.length - 1 && (
                    <ChevronRight className="hidden sm:block absolute -right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-green-500/40 z-10" />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* ── Payout Milestones ─────────────────────────────────────────── */}
          <div
            className="rounded-2xl border border-white/10 p-6 md:p-8"
            style={{ background: "hsl(145 50% 10%)" }}
          >
            <h2 className="text-white font-bold text-xl mb-2 flex items-center gap-2">
              <Star className="h-5 w-5 text-green-400" />
              Payout Milestones
            </h2>
            <p className="text-white/40 text-sm mb-6">
              Rewards are based on verified views. You can submit for multiple milestones as your video grows.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {PAYOUT_MILESTONES.map((m) => (
                <div
                  key={m.label}
                  className={`rounded-xl border p-4 text-center relative overflow-hidden transition-all ${
                    m.highlight ? "border-green-500/40" : "border-white/10"
                  }`}
                  style={{
                    background: m.highlight
                      ? `linear-gradient(135deg, ${m.glow}, hsl(145 55% 12%))`
                      : `linear-gradient(135deg, ${m.glow}, hsl(145 50% 10%))`,
                  }}
                >
                  {m.highlight && (
                    <div className="absolute top-1.5 right-1.5 text-[10px] font-bold text-green-300 bg-green-500/20 border border-green-500/30 px-1.5 py-0.5 rounded-full">
                      TOP
                    </div>
                  )}
                  <div className="text-white/35 text-[10px] uppercase tracking-widest mb-1">{m.label}</div>
                  <div className="text-white/70 text-xs font-medium mb-2">{m.reach}</div>
                  <div
                    className="text-2xl md:text-3xl font-extrabold"
                    style={{ color: m.color }}
                  >
                    {m.reward}
                  </div>
                </div>
              ))}
            </div>
            <p className="text-white/25 text-xs mt-4">
              * You may submit separate milestone claims as your video reaches new view thresholds.
            </p>
          </div>

          {/* ── Program Rules ─────────────────────────────────────────────── */}
          <div
            className="rounded-2xl border border-amber-500/20 p-5"
            style={{ background: "hsl(38 60% 10%)" }}
          >
            <h2 className="text-amber-200 font-bold text-base mb-3 flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-amber-400" />
              Program Rules
            </h2>
            <ul className="space-y-2">
              {PROGRAM_RULES.map((rule, i) => (
                <li key={i} className="flex items-start gap-2 text-amber-100/60 text-sm">
                  <AlertCircle className="h-3.5 w-3.5 text-amber-500/60 flex-shrink-0 mt-0.5" />
                  {rule}
                </li>
              ))}
            </ul>
          </div>

          {/* ── Submission Form ──────────────────────────────────────────── */}
          <div
            className="rounded-2xl border border-white/10 p-6 md:p-8"
            style={{ background: "hsl(145 50% 10%)" }}
          >
            <h2 className="text-white font-bold text-xl mb-1 flex items-center gap-2">
              <Upload className="h-5 w-5 text-green-400" />
              Submit Your Content
            </h2>
            <p className="text-white/50 text-sm mb-6">
              Submit your video <strong className="text-white/70">before publishing</strong>. We review within 48 hours and let you know if it's approved.
            </p>

            <div className="space-y-4">
              {/* Platform selector */}
              <div>
                <label className="block text-white/60 text-xs font-semibold uppercase tracking-widest mb-2">
                  Platform <span className="text-red-400">*</span>
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {PLATFORMS.map((p) => (
                    <button
                      key={p.value}
                      type="button"
                      onClick={() => setPlatform(p.value)}
                      className={`flex flex-col items-center gap-1.5 rounded-xl border py-3 px-2 text-xs font-medium transition-all duration-150 ${
                        platform === p.value
                          ? "border-green-500/60 bg-green-500/20 text-green-200"
                          : "border-white/10 bg-white/5 text-white/50 hover:border-white/20 hover:bg-white/8"
                      }`}
                    >
                      <span className="text-2xl leading-none">{p.emoji}</span>
                      <span className="font-semibold">{p.label}</span>
                      <span className="text-[10px] opacity-60">{p.hint}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Video URL */}
              <div>
                <label htmlFor="video-url" className="block text-white/60 text-xs font-semibold uppercase tracking-widest mb-2">
                  Video / Draft Link <span className="text-red-400">*</span>
                </label>
                <input
                  id="video-url"
                  type="url"
                  placeholder={
                    platform === "tiktok"
                      ? "https://www.tiktok.com/@yourhandle/video/..."
                      : "https://youtube.com/watch?v=... or unlisted link"
                  }
                  value={videoUrl}
                  onChange={(e) => { setVideoUrl(e.target.value); setUrlError(""); }}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white text-sm placeholder-white/25 focus:outline-none focus:border-green-500/50 focus:bg-white/8 transition-all"
                />
                {urlError && (
                  <p className="text-red-400 text-xs mt-1.5 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {urlError}
                  </p>
                )}
                <p className="text-white/30 text-xs mt-1.5">
                  You can submit an unlisted YouTube link or a TikTok draft link before publishing.
                </p>
              </div>

              {/* Video Title */}
              <div>
                <label htmlFor="video-title" className="block text-white/60 text-xs font-semibold uppercase tracking-widest mb-2">
                  Video Title{" "}
                  <span className="text-white/25 font-normal normal-case tracking-normal">(optional)</span>
                </label>
                <input
                  id="video-title"
                  type="text"
                  placeholder="e.g. How I earn $300/month on ProfitChips (honest review)"
                  value={videoTitle}
                  onChange={(e) => setVideoTitle(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white text-sm placeholder-white/25 focus:outline-none focus:border-green-500/50 transition-all"
                />
              </div>

              {/* Follower count */}
              <div>
                <label htmlFor="follower-count" className="block text-white/60 text-xs font-semibold uppercase tracking-widest mb-2">
                  Your Followers / Subscribers{" "}
                  <span className="text-white/25 font-normal normal-case tracking-normal">(optional, self-reported)</span>
                </label>
                <input
                  id="follower-count"
                  type="text"
                  placeholder="e.g. 1.2K, 50K, 200K"
                  value={followerCount}
                  onChange={(e) => setFollowerCount(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white text-sm placeholder-white/25 focus:outline-none focus:border-green-500/50 transition-all"
                />
              </div>

              {/* Notes */}
              <div>
                <label htmlFor="notes" className="block text-white/60 text-xs font-semibold uppercase tracking-widest mb-2">
                  Additional Notes{" "}
                  <span className="text-white/25 font-normal normal-case tracking-normal">(optional)</span>
                </label>
                <textarea
                  id="notes"
                  rows={3}
                  placeholder="Tell us anything else about your video that might help us review it..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white text-sm placeholder-white/25 focus:outline-none focus:border-green-500/50 transition-all resize-none"
                />
              </div>

              <Button
                onClick={validateAndSubmit}
                disabled={submitting}
                size="lg"
                className="w-full py-5 text-base font-bold rounded-xl text-white transition-all duration-200 hover:opacity-90 flex items-center justify-center gap-2"
                style={{
                  background: submitting
                    ? "hsl(145 50% 25%)"
                    : "linear-gradient(135deg, hsl(145 70% 38%), hsl(145 65% 30%))",
                }}
              >
                {submitting ? (
                  <>
                    <div className="h-4 w-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    Submitting…
                  </>
                ) : (
                  <>
                    <Upload className="h-5 w-5" />
                    Submit for Review
                    <ChevronRight className="h-5 w-5 ml-1" />
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* ── Past Submissions ──────────────────────────────────────────── */}
          {(loadingSubs || submissions.length > 0) && (
            <div
              className="rounded-2xl border border-white/10 p-6"
              style={{ background: "hsl(145 50% 10%)" }}
            >
              <h2 className="text-white font-bold text-xl mb-4">Your Submissions</h2>

              {loadingSubs ? (
                <div className="space-y-3">
                  {[1, 2].map((i) => (
                    <div key={i} className="h-16 rounded-xl bg-white/5 animate-pulse" />
                  ))}
                </div>
              ) : (
                <div className="space-y-3">
                  {submissions.map((sub) => {
                    const sc = STATUS_CONFIG[sub.status];
                    const Icon = sc.icon;
                    const pInfo = getPlatformInfo(sub.platform);
                    return (
                      <div
                        key={sub.id}
                        className="rounded-xl border border-white/10 bg-white/5 p-4 flex flex-col sm:flex-row sm:items-center gap-3"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-base">{pInfo?.emoji ?? "🎬"}</span>
                            <span className="text-white text-sm font-medium">
                              {pInfo?.label ?? sub.platform}
                            </span>
                            {sub.video_title && (
                              <span className="text-white/40 text-sm truncate">
                                — {sub.video_title}
                              </span>
                            )}
                          </div>
                          <a
                            href={sub.video_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-green-400/70 text-xs hover:text-green-400 flex items-center gap-1 truncate"
                          >
                            <ExternalLink className="h-3 w-3 flex-shrink-0" />
                            <span className="truncate">{sub.video_url}</span>
                          </a>
                          {sub.status === "rejected" && sub.rejection_reason && (
                            <p className="text-red-400/80 text-xs mt-1">
                              Reason: {sub.rejection_reason}
                            </p>
                          )}
                          {sub.status === "approved" && sub.reward_amount > 0 && (
                            <p className="text-green-400 text-xs mt-1 font-semibold">
                              Reward: US${sub.reward_amount.toFixed(2)} credited ✓
                            </p>
                          )}
                        </div>
                        <div className="flex flex-row sm:flex-col items-center sm:items-end gap-3 sm:gap-1 flex-shrink-0">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-semibold ${sc.bg} ${sc.color}`}
                          >
                            <Icon className="h-3 w-3" />
                            {sc.label}
                          </span>
                          <span className="text-white/25 text-xs">{formatDate(sub.created_at)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── Disclaimer ────────────────────────────────────────────────── */}
          <div className="flex gap-3 rounded-xl border border-white/5 bg-white/3 p-4">
            <Info className="h-4 w-4 text-white/30 flex-shrink-0 mt-0.5" />
            <p className="text-white/35 text-xs leading-relaxed">
              <strong className="text-white/50">Program Disclaimer:</strong>{" "}
              Rewards are based on verified view counts at the time of review, not self-reported numbers.
              Content must authentically feature and explain ProfitChips — promotional-style ads will be rejected.
              Rewards are credited to your Earnings Wallet and are subject to standard withdrawal policies.
              ProfitChips reserves the right to modify or discontinue this program at any time.
            </p>
          </div>

        </div>
      </div>
    </>
  );
}
