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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────────────────────
type Platform = "youtube" | "tiktok" | "instagram" | "facebook" | "twitter" | "other";
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
const PLATFORMS: { value: Platform; label: string; emoji: string }[] = [
  { value: "youtube",   label: "YouTube",     emoji: "🎬" },
  { value: "tiktok",    label: "TikTok",      emoji: "🎵" },
  { value: "instagram", label: "Instagram",   emoji: "📸" },
  { value: "facebook",  label: "Facebook",    emoji: "👥" },
  { value: "twitter",   label: "Twitter / X", emoji: "🐦" },
  { value: "other",     label: "Other",       emoji: "🔗" },
];

const PAYOUT_MILESTONES = [
  { label: "Starter",   reach: "1,000 views",    reward: "$5",   color: "hsl(145 50% 30%)" },
  { label: "Rising",    reach: "10,000 views",   reward: "$15",  color: "hsl(145 55% 35%)" },
  { label: "Popular",   reach: "50,000 views",   reward: "$30",  color: "hsl(145 60% 38%)" },
  { label: "Viral",     reach: "100,000 views",  reward: "$50",  color: "hsl(145 65% 40%)" },
  { label: "Mega",      reach: "500,000+ views", reward: "$100", color: "hsl(145 70% 43%)" },
];

const HOW_IT_WORKS = [
  {
    step: "1",
    title: "Create your content",
    desc: "Record a video, post, or story featuring ProfitChips — your experience, earnings, or walkthrough.",
  },
  {
    step: "2",
    title: "Submit your link",
    desc: "Paste your video or post URL below along with your platform and any details that help us review it.",
  },
  {
    step: "3",
    title: "We review within 48h",
    desc: "Our team verifies the content genuinely features ProfitChips and checks your reach/views.",
  },
  {
    step: "4",
    title: "Reward credited",
    desc: "Approved submissions receive a cash reward directly to your Earnings Wallet — no minimum required.",
  },
];

// ─── Status display helper ────────────────────────────────────────────────────
const STATUS_CONFIG: Record<Status, { label: string; icon: React.ElementType; color: string; bg: string }> = {
  pending:  { label: "Under Review",  icon: Clock,        color: "text-amber-300",  bg: "bg-amber-500/15 border-amber-500/30" },
  approved: { label: "Approved",      icon: CheckCircle,  color: "text-green-300",  bg: "bg-green-500/15 border-green-500/30" },
  rejected: { label: "Rejected",      icon: XCircle,      color: "text-red-300",    bg: "bg-red-500/15 border-red-500/30" },
};

const platformLabel = (p: Platform) => PLATFORMS.find((x) => x.value === p)?.label ?? p;
const platformEmoji = (p: Platform) => PLATFORMS.find((x) => x.value === p)?.emoji ?? "🔗";

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });

// ─── Component ────────────────────────────────────────────────────────────────
export default function GetPaidToPost() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Form state
  const [platform, setPlatform] = useState<Platform>("youtube");
  const [videoUrl, setVideoUrl] = useState("");
  const [videoTitle, setVideoTitle] = useState("");
  const [followerCount, setFollowerCount] = useState("");
  const [notes, setNotes] = useState("");
  const [urlError, setUrlError] = useState("");

  // ── Fetch user's past submissions ─────────────────────────────────────────
  const { data: submissions = [], isLoading: loadingSubs } = useQuery<Submission[]>({
    queryKey: ["content-reward-submissions", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("content_reward_submissions")
        .select("id, video_url, platform, video_title, follower_count, additional_notes, status, rejection_reason, reward_amount, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Submission[];
    },
    enabled: !!user?.id,
    staleTime: 60 * 1000,
  });

  // ── Submit mutation ───────────────────────────────────────────────────────
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

  // ── Validation ────────────────────────────────────────────────────────────
  const validateAndSubmit = () => {
    const trimmed = videoUrl.trim();
    if (!trimmed) { setUrlError("Please enter your video or post URL."); return; }
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
        <title>Get Paid To Post | ProfitChips Content Rewards</title>
        <meta
          name="description"
          content="Earn cash rewards by posting content about ProfitChips. Submit your video link and get paid based on your reach."
        />
      </Helmet>

      <div className="min-h-screen pb-24 lg:pb-12">

        {/* ── Hero ──────────────────────────────────────────────────────────── */}
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

            <h1 className="text-4xl md:text-5xl font-extrabold text-white leading-tight mb-3">
              Get{" "}
              <span
                className="text-transparent bg-clip-text"
                style={{
                  backgroundImage: "linear-gradient(90deg, hsl(145 70% 55%), hsl(145 60% 72%))",
                }}
              >
                Paid To Post
              </span>
            </h1>
            <p className="text-white/60 text-base md:text-lg max-w-xl mx-auto leading-relaxed">
              Create content about ProfitChips on YouTube, TikTok, Instagram, or any platform —
              and earn real cash rewards based on your reach.
            </p>
          </div>
        </div>

        <div className="max-w-3xl mx-auto px-4 -mt-2 space-y-6">

          {/* ── How It Works ────────────────────────────────────────────────── */}
          <div
            className="rounded-2xl border border-white/10 p-6 md:p-8"
            style={{ background: "linear-gradient(135deg, hsl(145 55% 10%), hsl(145 45% 13%))" }}
          >
            <h2 className="text-white font-bold text-xl mb-6 flex items-center gap-2">
              <Play className="h-5 w-5 text-green-400" />
              How It Works
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {HOW_IT_WORKS.map((step) => (
                <div key={step.step} className="flex gap-3">
                  <div
                    className="flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center text-sm font-bold text-white"
                    style={{ background: "hsl(145 65% 33%)" }}
                  >
                    {step.step}
                  </div>
                  <div>
                    <div className="text-white font-semibold text-sm">{step.title}</div>
                    <div className="text-white/50 text-sm leading-relaxed">{step.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Payout Milestones ────────────────────────────────────────────── */}
          <div
            className="rounded-2xl border border-white/10 p-6 md:p-8"
            style={{ background: "hsl(145 50% 10%)" }}
          >
            <h2 className="text-white font-bold text-xl mb-2 flex items-center gap-2">
              <Star className="h-5 w-5 text-green-400" />
              Payout Milestones
            </h2>
            <p className="text-white/40 text-sm mb-5">
              Rewards are based on verified views at the time of review. Submit once you hit a milestone.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {PAYOUT_MILESTONES.map((m) => (
                <div
                  key={m.label}
                  className="rounded-xl border border-white/10 p-3 text-center flex flex-col items-center gap-1"
                  style={{ background: `${m.color}22` }}
                >
                  <div className="text-white/40 text-[10px] uppercase tracking-widest">{m.label}</div>
                  <div className="text-white text-xs font-medium">{m.reach}</div>
                  <div
                    className="text-2xl font-extrabold mt-0.5"
                    style={{ color: m.color.replace("hsl", "hsl").replace(")", " / 1)") }}
                  >
                    {m.reward}
                  </div>
                </div>
              ))}
            </div>
            <p className="text-white/25 text-xs mt-3">
              * Rewards are per submission. You may submit multiple videos at different milestone levels.
            </p>
          </div>

          {/* ── Submission Form ──────────────────────────────────────────────── */}
          <div
            className="rounded-2xl border border-white/10 p-6 md:p-8"
            style={{ background: "hsl(145 50% 10%)" }}
          >
            <h2 className="text-white font-bold text-xl mb-1 flex items-center gap-2">
              <Upload className="h-5 w-5 text-green-400" />
              Submit Your Content
            </h2>
            <p className="text-white/50 text-sm mb-6">
              Fill in the details below and our team will review your submission within 48 hours.
            </p>

            <div className="space-y-4">
              {/* Platform selector */}
              <div>
                <label className="block text-white/60 text-xs font-semibold uppercase tracking-widest mb-2">
                  Platform <span className="text-red-400">*</span>
                </label>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                  {PLATFORMS.map((p) => (
                    <button
                      key={p.value}
                      type="button"
                      onClick={() => setPlatform(p.value)}
                      className={`flex flex-col items-center gap-1 rounded-xl border py-2.5 px-1 text-xs font-medium transition-all duration-150 ${
                        platform === p.value
                          ? "border-green-500/60 bg-green-500/20 text-green-300"
                          : "border-white/10 bg-white/5 text-white/50 hover:border-white/20 hover:bg-white/10"
                      }`}
                    >
                      <span className="text-xl leading-none">{p.emoji}</span>
                      <span>{p.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Video URL */}
              <div>
                <label htmlFor="video-url" className="block text-white/60 text-xs font-semibold uppercase tracking-widest mb-2">
                  Video / Post URL <span className="text-red-400">*</span>
                </label>
                <input
                  id="video-url"
                  type="url"
                  placeholder="https://youtube.com/watch?v=..."
                  value={videoUrl}
                  onChange={(e) => { setVideoUrl(e.target.value); setUrlError(""); }}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white text-sm placeholder-white/25 focus:outline-none focus:border-green-500/50 focus:bg-white/8 transition-all"
                />
                {urlError && (
                  <p className="text-red-400 text-xs mt-1">{urlError}</p>
                )}
              </div>

              {/* Video Title (optional) */}
              <div>
                <label htmlFor="video-title" className="block text-white/60 text-xs font-semibold uppercase tracking-widest mb-2">
                  Video / Post Title <span className="text-white/25 font-normal normal-case tracking-normal">(optional)</span>
                </label>
                <input
                  id="video-title"
                  type="text"
                  placeholder="e.g. How I earn $300/month with ProfitChips"
                  value={videoTitle}
                  onChange={(e) => setVideoTitle(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white text-sm placeholder-white/25 focus:outline-none focus:border-green-500/50 transition-all"
                />
              </div>

              {/* Follower / Subscriber Count (optional) */}
              <div>
                <label htmlFor="follower-count" className="block text-white/60 text-xs font-semibold uppercase tracking-widest mb-2">
                  Your Followers / Subscribers <span className="text-white/25 font-normal normal-case tracking-normal">(optional, self-reported)</span>
                </label>
                <input
                  id="follower-count"
                  type="text"
                  placeholder="e.g. 5.2K, 50K, 1.2M"
                  value={followerCount}
                  onChange={(e) => setFollowerCount(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white text-sm placeholder-white/25 focus:outline-none focus:border-green-500/50 transition-all"
                />
              </div>

              {/* Additional Notes (optional) */}
              <div>
                <label htmlFor="notes" className="block text-white/60 text-xs font-semibold uppercase tracking-widest mb-2">
                  Additional Notes <span className="text-white/25 font-normal normal-case tracking-normal">(optional)</span>
                </label>
                <textarea
                  id="notes"
                  rows={3}
                  placeholder="Tell us anything else about your content that might help us review it..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white text-sm placeholder-white/25 focus:outline-none focus:border-green-500/50 transition-all resize-none"
                />
              </div>

              {/* Submit */}
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

          {/* ── Past Submissions ─────────────────────────────────────────────── */}
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
                    return (
                      <div
                        key={sub.id}
                        className="rounded-xl border border-white/10 bg-white/5 p-4 flex flex-col sm:flex-row sm:items-center gap-3"
                      >
                        {/* Platform + URL */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-base">{platformEmoji(sub.platform)}</span>
                            <span className="text-white text-sm font-medium">
                              {platformLabel(sub.platform)}
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

                        {/* Right side */}
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

          {/* ── Disclaimer ────────────────────────────────────────────────────── */}
          <div className="flex gap-3 rounded-xl border border-white/5 bg-white/3 p-4">
            <Info className="h-4 w-4 text-white/30 flex-shrink-0 mt-0.5" />
            <p className="text-white/35 text-xs leading-relaxed">
              <strong className="text-white/50">Program Rules:</strong>{" "}
              Submitted content must genuinely feature ProfitChips (your account, earnings, or honest review).
              Misleading, fake, or spam content will be rejected and may result in account review.
              Payout milestones are based on verified views at the time of review, not at time of submission.
              Rewards are credited to your Earnings Wallet and are subject to standard withdrawal policies.
              This program is subject to change without notice.
            </p>
          </div>

        </div>
      </div>
    </>
  );
}
