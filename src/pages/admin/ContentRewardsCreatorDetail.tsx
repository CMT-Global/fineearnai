import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, UserPlus, UserMinus, Shield, RefreshCw, Video, TrendingUp, Users, DollarSign, MousePointerClick, RotateCcw } from "lucide-react";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { useTranslation } from "react-i18next";
import { useLanguageSync } from "@/hooks/useLanguageSync";
import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/wallet-utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function ContentRewardsCreatorDetail() {
  const { t } = useTranslation();
  useLanguageSync();
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdmin();
  const navigate = useNavigate();
  const { userId } = useParams<{ userId: string }>();
  const queryClient = useQueryClient();
  const [timeRange, setTimeRange] = useState<"today" | "7days" | "30days" | "lifetime">("30days");
  const [actionType, setActionType] = useState<"enable" | "disable" | "suspend" | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  // Fetch creator profile
  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ["creator-profile", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!userId,
  });

  // Calculate date range
  const getDateRange = () => {
    const now = new Date();
    switch (timeRange) {
      case "today":
        return { from: new Date(now.setHours(0, 0, 0, 0)), to: new Date() };
      case "7days":
        return { from: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000), to: new Date() };
      case "30days":
        return { from: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000), to: new Date() };
      default:
        return { from: null, to: null };
    }
  };

  // Fetch stats
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["creator-stats", userId, timeRange],
    queryFn: async () => {
      const dateRange = getDateRange();
      const { data, error } = await supabase.rpc("get_content_rewards_stats", {
        p_user_id: userId,
        p_date_from: dateRange.from?.toISOString() || null,
        p_date_to: dateRange.to?.toISOString() || null,
      });

      if (error) throw error;
      return data;
    },
    enabled: !!userId,
  });

  // Fetch commission history (select * then resolve usernames to avoid FK join 400)
  const { data: commissions, isLoading: commissionsLoading } = useQuery({
    queryKey: ["creator-commissions", userId],
    queryFn: async () => {
      const { data: rows, error } = await supabase
        .from("referral_earnings")
        .select("*")
        .eq("referrer_id", userId)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      if (!rows?.length) return [];

      const referredIds = [...new Set(rows.map((r: { referred_user_id: string }) => r.referred_user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, username")
        .in("id", referredIds);
      const userMap = new Map((profiles || []).map((p: { id: string; username: string }) => [p.id, p.username]));

      return rows.map((r: { referred_user_id: string; [k: string]: unknown }) => ({
        ...r,
        referred: { username: userMap.get(r.referred_user_id) ?? "N/A" },
      }));
    },
    enabled: !!userId,
  });

  // Fetch referred users
  const { data: referredUsers, isLoading: referredLoading } = useQuery({
    queryKey: ["creator-referred", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("referrals")
        .select(`
          *,
          referred:profiles!referrals_referred_id_fkey(
            username,
            email,
            membership_plan,
            created_at
          )
        `)
        .eq("referrer_id", userId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!userId,
  });

  // Mutations
  const enableMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("admin_enable_content_rewards", {
        p_user_id: userId,
        p_skip_onboarding: false,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["creator-profile", userId] });
      toast.success("Content Rewards access enabled");
      setShowConfirmDialog(false);
      setActionType(null);
    },
  });

  const disableMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("admin_disable_content_rewards", {
        p_user_id: userId,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["creator-profile", userId] });
      toast.success("Content Rewards access disabled");
      setShowConfirmDialog(false);
      setActionType(null);
    },
  });

  const suspendMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("admin_suspend_content_rewards", {
        p_user_id: userId,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["creator-profile", userId] });
      toast.success("Creator suspended");
      setShowConfirmDialog(false);
      setActionType(null);
    },
  });

  const handleAction = (type: "enable" | "disable" | "suspend") => {
    setActionType(type);
    setShowConfirmDialog(true);
  };

  const confirmAction = () => {
    if (!actionType) return;
    if (actionType === "enable") enableMutation.mutate();
    else if (actionType === "disable") disableMutation.mutate();
    else if (actionType === "suspend") suspendMutation.mutate();
  };

  const getStatusBadge = () => {
    if (!profile?.content_rewards_enabled) {
      return <Badge variant="secondary">Disabled</Badge>;
    }
    switch (profile.content_rewards_status) {
      case "approved":
        return <Badge className="bg-green-500">Approved</Badge>;
      case "suspended":
        return <Badge variant="destructive">Suspended</Badge>;
      default:
        return <Badge variant="outline">Pending</Badge>;
    }
  };

  useEffect(() => {
    if (!authLoading && !adminLoading && !isAdmin) {
      navigate("/dashboard");
    }
  }, [authLoading, adminLoading, isAdmin, navigate]);

  if (authLoading || adminLoading || profileLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <LoadingSpinner size="lg" text="Loading..." />
      </div>
    );
  }

  if (!isAdmin || !profile) {
    return null;
  }

  const conversionRate =
    (stats?.total_signups || 0) > 0
      ? ((stats?.total_upgrades || 0) / (stats?.total_signups || 1)) * 100
      : 0;

  return (
    <div className="container mx-auto p-4 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={() => navigate("/admin/content-rewards/creators")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Creators
          </Button>
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Video className="h-8 w-8 text-primary" />
              {profile.username}
            </h1>
            <p className="text-muted-foreground mt-1">{profile.email}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {getStatusBadge()}
          {!profile.content_rewards_enabled ? (
            <Button onClick={() => handleAction("enable")}>
              <UserPlus className="mr-2 h-4 w-4" />
              Enable Access
            </Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => handleAction("disable")}>
                <UserMinus className="mr-2 h-4 w-4" />
                Disable
              </Button>
              {profile.content_rewards_status !== "suspended" && (
                <Button variant="outline" onClick={() => handleAction("suspend")}>
                  <Shield className="mr-2 h-4 w-4" />
                  Suspend
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Link Clicks</CardTitle>
            <MousePointerClick className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.total_clicks || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Signups</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.total_signups || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Upgrades</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.total_upgrades || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {conversionRate.toFixed(1)}% conversion rate
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Earnings</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats?.total_earnings || 0)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {formatCurrency(stats?.upgrade_earnings || 0)} from upgrades
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="commissions">Commissions</TabsTrigger>
            <TabsTrigger value="referred">Referred Users</TabsTrigger>
          </TabsList>
          <Select value={timeRange} onValueChange={(v: any) => setTimeRange(v)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="7days">Last 7 Days</SelectItem>
              <SelectItem value="30days">Last 30 Days</SelectItem>
              <SelectItem value="lifetime">Lifetime</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <TabsContent value="overview">
          <Card>
            <CardHeader>
              <CardTitle>Creator Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <div className="font-medium">{getStatusBadge()}</div>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Onboarded</p>
                  <p className="font-medium">
                    {profile.content_rewards_onboarded_at
                      ? new Date(profile.content_rewards_onboarded_at).toLocaleString()
                      : "Not onboarded"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Membership Plan</p>
                  <p className="font-medium capitalize">{profile.membership_plan}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Referral Code</p>
                  <p className="font-medium font-mono">{profile.referral_code}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="commissions">
          <Card>
            <CardHeader>
              <CardTitle>Commission History</CardTitle>
              <CardDescription>All commissions earned by this creator</CardDescription>
            </CardHeader>
            <CardContent>
              {commissionsLoading ? (
                <div className="flex justify-center py-8">
                  <LoadingSpinner />
                </div>
              ) : !commissions || commissions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No commissions yet
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Referred User</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {commissions.map((commission: any) => (
                      <TableRow key={commission.id}>
                        <TableCell>
                          {new Date(commission.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{commission.earning_type}</Badge>
                        </TableCell>
                        <TableCell>{commission.referred?.username || "N/A"}</TableCell>
                        <TableCell className="font-medium">
                          {formatCurrency(commission.commission_amount)}
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={async () => {
                              if (!confirm("Are you sure you want to reverse this commission? This action cannot be undone.")) {
                                return;
                              }
                              const reason = prompt("Enter reason for reversal (required):");
                              if (!reason || reason.trim() === "") {
                                toast.error("Reason is required");
                                return;
                              }
                              try {
                                // Get current balance
                                const { data: profile } = await supabase
                                  .from("profiles")
                                  .select("earnings_wallet_balance")
                                  .eq("id", userId)
                                  .single();

                                if (!profile) {
                                  throw new Error("Creator profile not found");
                                }

                                const currentBalance = Number(profile.earnings_wallet_balance);
                                const reversalAmount = Number(commission.commission_amount);
                                const newBalance = currentBalance - reversalAmount;

                                if (newBalance < 0) {
                                  throw new Error("Insufficient balance to reverse commission");
                                }

                                // Create reversal transaction
                                const { error: txnError } = await supabase.from("transactions").insert({
                                  user_id: userId,
                                  type: "adjustment",
                                  amount: -reversalAmount,
                                  wallet_type: "earnings",
                                  status: "completed",
                                  description: `Commission reversal: ${reason}`,
                                  new_balance: newBalance,
                                  metadata: {
                                    source: "content_rewards",
                                    reversal_of: commission.id,
                                    original_commission: commission.commission_amount,
                                    reason: reason.trim(),
                                    reversed_by: user?.id,
                                    reversed_at: new Date().toISOString(),
                                  },
                                });

                                if (txnError) throw txnError;

                                // Update balance
                                const { error: balanceError } = await supabase
                                  .from("profiles")
                                  .update({
                                    earnings_wallet_balance: newBalance,
                                    total_earned: Math.max(0, (profile.total_earned || 0) - reversalAmount),
                                  })
                                  .eq("id", userId);

                                if (balanceError) throw balanceError;

                                // Create audit log
                                const { error: auditError } = await supabase.from("audit_logs").insert({
                                  admin_id: user?.id || "",
                                  action_type: "commission_reversal",
                                  target_user_id: userId,
                                  details: {
                                    commission_id: commission.id,
                                    amount: reversalAmount,
                                    reason: reason.trim(),
                                    original_commission: commission.commission_amount,
                                  } as any,
                                });

                                if (auditError) {
                                  console.error("Failed to create audit log:", auditError);
                                  // Don't fail the reversal if audit log fails
                                }

                                toast.success("Commission reversed successfully");
                                queryClient.invalidateQueries({ queryKey: ["creator-commissions", userId] });
                                queryClient.invalidateQueries({ queryKey: ["creator-profile", userId] });
                                queryClient.invalidateQueries({ queryKey: ["creator-stats", userId] });
                              } catch (error: any) {
                                toast.error(error.message || "Failed to reverse commission");
                              }
                            }}
                          >
                            <RotateCcw className="h-4 w-4 mr-1" />
                            Reverse
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="referred">
          <Card>
            <CardHeader>
              <CardTitle>Referred Users</CardTitle>
              <CardDescription>Users who signed up via this creator's link</CardDescription>
            </CardHeader>
            <CardContent>
              {referredLoading ? (
                <div className="flex justify-center py-8">
                  <LoadingSpinner />
                </div>
              ) : !referredUsers || referredUsers.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No referred users yet
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Username</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Plan</TableHead>
                      <TableHead>Joined</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {referredUsers.map((ref: any) => (
                      <TableRow
                        key={ref.id}
                        className="cursor-pointer"
                        onClick={() => navigate(`/admin/users/${ref.referred_id}`)}
                      >
                        <TableCell className="font-medium">
                          {ref.referred?.username || "N/A"}
                        </TableCell>
                        <TableCell>{ref.referred?.email || "N/A"}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">
                            {ref.referred?.membership_plan || "free"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {ref.referred?.created_at
                            ? new Date(ref.referred.created_at).toLocaleDateString()
                            : "N/A"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Confirm Dialog */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {actionType === "enable" && "Enable Content Rewards Access"}
              {actionType === "disable" && "Disable Content Rewards Access"}
              {actionType === "suspend" && "Suspend Creator"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {actionType === "enable" &&
                "This will grant the user access to the Content Rewards dashboard."}
              {actionType === "disable" &&
                "This will remove the user's access to the Content Rewards dashboard."}
              {actionType === "suspend" &&
                "This will temporarily suspend the creator. They can be re-enabled later."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmAction}>
              {actionType === "enable" && "Enable"}
              {actionType === "disable" && "Disable"}
              {actionType === "suspend" && "Suspend"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
