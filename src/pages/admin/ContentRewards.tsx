import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  CheckCircle,
  XCircle,
  Clock,
  Film,
  ExternalLink,
  Search,
  DollarSign,
  Users,
  TrendingUp,
  Loader2,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { PageLoading } from "@/components/shared/PageLoading";

// ─── Types ────────────────────────────────────────────────────────────────────
type Platform = "tiktok" | "youtube_shorts" | "youtube_longform";
type Status = "pending" | "approved" | "rejected";

interface Submission {
  id: string;
  user_id: string;
  platform: Platform;
  video_url: string;
  video_title: string | null;
  follower_count: string | null;
  additional_notes: string | null;
  status: Status;
  rejection_reason: string | null;
  reward_amount: number;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  profiles: {
    id: string;
    username: string;
    email: string;
    earnings_wallet_balance: number;
  };
}

// ─── Constants ────────────────────────────────────────────────────────────────
const PLATFORM_LABELS: Record<Platform, { label: string; emoji: string }> = {
  tiktok:           { label: "TikTok",           emoji: "🎵" },
  youtube_shorts:   { label: "YouTube Shorts",   emoji: "▶️" },
  youtube_longform: { label: "YouTube Longform", emoji: "🎬" },
};

const SUGGESTED_REWARDS = [30, 60, 100, 150];

const STATUS_CONFIG: Record<Status, { label: string; icon: React.ElementType; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending:  { label: "Pending",  icon: Clock,       variant: "secondary" },
  approved: { label: "Approved", icon: CheckCircle, variant: "default" },
  rejected: { label: "Rejected", icon: XCircle,     variant: "destructive" },
};

const formatDate = (iso: string) =>
  formatDistanceToNow(new Date(iso), { addSuffix: true });

// ─── Component ────────────────────────────────────────────────────────────────
const ContentRewards = () => {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<string>("pending");
  const [search, setSearch] = useState("");

  // Dialog state
  const [selected, setSelected] = useState<Submission | null>(null);
  const [dialogAction, setDialogAction] = useState<"approve" | "reject">("approve");
  const [rewardAmount, setRewardAmount] = useState("30");
  const [rejectionReason, setRejectionReason] = useState("");

  // ── Fetch all submissions ───────────────────────────────────────────────
  const { data: allSubmissions = [], isLoading } = useQuery<Submission[]>({
    queryKey: ["admin-content-reward-submissions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("content_reward_submissions")
        .select("*, profiles:user_id(id, username, email, earnings_wallet_balance)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Submission[];
    },
    staleTime: 30 * 1000,
  });

  // ── Review mutation ─────────────────────────────────────────────────────
  const reviewMutation = useMutation({
    mutationFn: async (payload: {
      submissionId: string;
      action: "approve" | "reject";
      rewardAmount?: number;
      rejectionReason?: string;
    }) => {
      const { data, error } = await supabase.functions.invoke("review-content-submission", {
        body: payload,
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (_, vars) => {
      toast.success(vars.action === "approve" ? "Submission approved and wallet credited!" : "Submission rejected.");
      setSelected(null);
      setRewardAmount("30");
      setRejectionReason("");
      queryClient.invalidateQueries({ queryKey: ["admin-content-reward-submissions"] });
    },
    onError: (err: any) => {
      toast.error(err.message || "Action failed. Please try again.");
    },
  });

  // ── Open dialogs ────────────────────────────────────────────────────────
  const openApprove = (sub: Submission) => {
    setSelected(sub);
    setDialogAction("approve");
    setRewardAmount("30");
    setRejectionReason("");
  };

  const openReject = (sub: Submission) => {
    setSelected(sub);
    setDialogAction("reject");
    setRewardAmount("30");
    setRejectionReason("");
  };

  const handleConfirm = () => {
    if (!selected) return;
    reviewMutation.mutate({
      submissionId: selected.id,
      action: dialogAction,
      rewardAmount: dialogAction === "approve" ? parseFloat(rewardAmount) : undefined,
      rejectionReason: dialogAction === "reject" ? rejectionReason : undefined,
    });
  };

  // ── Derived stats ───────────────────────────────────────────────────────
  const pendingCount   = allSubmissions.filter(s => s.status === "pending").length;
  const totalCount     = allSubmissions.length;
  const totalRewarded  = allSubmissions.filter(s => s.status === "approved").reduce((sum, s) => sum + (s.reward_amount ?? 0), 0);

  // ── Filtered list ───────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let items = activeTab === "all" ? allSubmissions : allSubmissions.filter(s => s.status === activeTab);
    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter(s =>
        s.profiles?.username?.toLowerCase().includes(q) ||
        s.profiles?.email?.toLowerCase().includes(q) ||
        s.video_url.toLowerCase().includes(q) ||
        (s.video_title ?? "").toLowerCase().includes(q)
      );
    }
    return items;
  }, [allSubmissions, activeTab, search]);

  if (isLoading) return <PageLoading text="Loading submissions…" />;

  const pInfo = (p: Platform) => PLATFORM_LABELS[p] ?? { label: p, emoji: "🎬" };

  return (
    <div className="container mx-auto px-4 py-6 max-w-6xl">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <Film className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold">Content Rewards</h1>
        </div>
        <p className="text-muted-foreground">
          Review and approve user video submissions for the Get Paid To Post program.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Clock className="h-4 w-4" /> Pending Review
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{pendingCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Users className="h-4 w-4" /> Total Submissions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{totalCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <DollarSign className="h-4 w-4" /> Total Rewards Paid
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">
              US${totalRewarded.toFixed(2)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          id="content-rewards-search"
          className="pl-9"
          placeholder="Search by username, email, video URL or title…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="pending">
            Pending
            {pendingCount > 0 && (
              <Badge variant="destructive" className="ml-2">{pendingCount}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="approved">Approved</TabsTrigger>
          <TabsTrigger value="rejected">Rejected</TabsTrigger>
          <TabsTrigger value="all">All ({totalCount})</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-0">
          {filtered.length === 0 ? (
            <Card>
              <CardContent className="py-16 text-center">
                <Film className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-40" />
                <p className="text-muted-foreground">No submissions found.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {filtered.map(sub => {
                const pi = pInfo(sub.platform);
                const sc = STATUS_CONFIG[sub.status];
                const Icon = sc.icon;
                return (
                  <Card key={sub.id}>
                    <CardHeader>
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-0.5">
                          <CardTitle className="text-base">
                            @{sub.profiles?.username ?? "unknown"}
                          </CardTitle>
                          <CardDescription>
                            {sub.profiles?.email} · submitted {formatDate(sub.created_at)}
                          </CardDescription>
                        </div>
                        <Badge variant={sc.variant} className="gap-1 flex-shrink-0">
                          <Icon className="h-3 w-3" />
                          {sc.label}
                        </Badge>
                      </div>
                    </CardHeader>

                    <CardContent className="space-y-4">
                      {/* Platform + URL */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                        <div>
                          <p className="text-muted-foreground text-xs mb-1">Platform</p>
                          <p className="font-medium flex items-center gap-1.5">
                            <span>{pi.emoji}</span>
                            {pi.label}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground text-xs mb-1">Video Link</p>
                          <a
                            href={sub.video_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline flex items-center gap-1 truncate text-sm"
                          >
                            <ExternalLink className="h-3 w-3 flex-shrink-0" />
                            <span className="truncate">{sub.video_url}</span>
                          </a>
                        </div>
                        {sub.video_title && (
                          <div>
                            <p className="text-muted-foreground text-xs mb-1">Title</p>
                            <p className="font-medium">{sub.video_title}</p>
                          </div>
                        )}
                        {sub.follower_count && (
                          <div>
                            <p className="text-muted-foreground text-xs mb-1">Followers / Subscribers</p>
                            <p className="font-medium flex items-center gap-1">
                              <TrendingUp className="h-3 w-3 text-muted-foreground" />
                              {sub.follower_count}
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Notes */}
                      {sub.additional_notes && (
                        <div className="text-sm">
                          <p className="text-muted-foreground text-xs mb-1">Notes from user</p>
                          <p className="p-3 bg-muted/50 rounded-lg text-sm">{sub.additional_notes}</p>
                        </div>
                      )}

                      {/* Rejection reason */}
                      {sub.status === "rejected" && sub.rejection_reason && (
                        <div className="p-3 rounded-lg border border-destructive/20 bg-destructive/5 text-sm">
                          <span className="text-muted-foreground text-xs">Rejection reason: </span>
                          <p className="mt-0.5">{sub.rejection_reason}</p>
                        </div>
                      )}

                      {/* Reward */}
                      {sub.status === "approved" && sub.reward_amount > 0 && (
                        <div className="p-3 rounded-lg border border-green-500/20 bg-green-500/5 text-sm">
                          <span className="text-muted-foreground text-xs">Reward paid: </span>
                          <span className="font-bold text-green-600 ml-1">US${sub.reward_amount.toFixed(2)}</span>
                        </div>
                      )}

                      {/* Actions */}
                      {sub.status === "pending" && (
                        <div className="flex gap-2 pt-2 border-t">
                          <Button
                            id={`approve-btn-${sub.id}`}
                            onClick={() => openApprove(sub)}
                            className="flex-1"
                            disabled={reviewMutation.isPending}
                          >
                            <CheckCircle className="h-4 w-4 mr-2" />
                            Approve & Credit Wallet
                          </Button>
                          <Button
                            id={`reject-btn-${sub.id}`}
                            onClick={() => openReject(sub)}
                            variant="destructive"
                            className="flex-1"
                            disabled={reviewMutation.isPending}
                          >
                            <XCircle className="h-4 w-4 mr-2" />
                            Reject
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ── Approve/Reject Dialog ─────────────────────────────────────────── */}
      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {dialogAction === "approve" ? "Approve Submission" : "Reject Submission"}
            </DialogTitle>
            <DialogDescription>
              {dialogAction === "approve"
                ? `Set the reward amount for @${selected?.profiles?.username}'s ${selected?.platform} video. The amount will be credited to their Earnings Wallet immediately.`
                : `Provide a reason for rejecting @${selected?.profiles?.username}'s submission. They will be notified.`}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {dialogAction === "approve" && (
              <div className="space-y-3">
                <Label htmlFor="reward-amount">Reward Amount (US$) *</Label>

                {/* Quick-pick buttons */}
                <div className="grid grid-cols-4 gap-2">
                  {SUGGESTED_REWARDS.map(amount => (
                    <button
                      key={amount}
                      type="button"
                      onClick={() => setRewardAmount(String(amount))}
                      className={`rounded-lg border py-2 text-sm font-semibold transition-all ${
                        rewardAmount === String(amount)
                          ? "border-primary bg-primary/15 text-primary"
                          : "border-border bg-muted/50 text-muted-foreground hover:border-primary/50"
                      }`}
                    >
                      ${amount}
                    </button>
                  ))}
                </div>

                <Input
                  id="reward-amount"
                  type="number"
                  min="1"
                  step="0.01"
                  placeholder="30.00"
                  value={rewardAmount}
                  onChange={e => setRewardAmount(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Current earnings wallet: US${(selected?.profiles?.earnings_wallet_balance ?? 0).toFixed(2)}
                  {" → "}
                  <strong>
                    US${((selected?.profiles?.earnings_wallet_balance ?? 0) + parseFloat(rewardAmount || "0")).toFixed(2)}
                  </strong>
                  {" after credit"}
                </p>
              </div>
            )}

            {dialogAction === "reject" && (
              <div className="space-y-2">
                <Label htmlFor="rejection-reason">Rejection Reason *</Label>
                <Textarea
                  id="rejection-reason"
                  placeholder="e.g. Content does not clearly feature ProfitChips. Please re-record and resubmit."
                  value={rejectionReason}
                  onChange={e => setRejectionReason(e.target.value)}
                  rows={4}
                />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelected(null)}>
              Cancel
            </Button>
            <Button
              id="confirm-review-btn"
              onClick={handleConfirm}
              variant={dialogAction === "approve" ? "default" : "destructive"}
              disabled={
                reviewMutation.isPending ||
                (dialogAction === "approve" && (!rewardAmount || parseFloat(rewardAmount) <= 0)) ||
                (dialogAction === "reject" && !rejectionReason.trim())
              }
            >
              {reviewMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {dialogAction === "approve" ? "Confirm & Credit Wallet" : "Confirm Rejection"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ContentRewards;
