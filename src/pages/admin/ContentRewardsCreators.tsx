import { useState, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Search, Eye, RefreshCw, UserPlus, UserMinus, Shield, Video } from "lucide-react";
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

interface Creator {
  id: string;
  username: string;
  email: string;
  content_rewards_enabled: boolean;
  content_rewards_status: string;
  content_rewards_onboarded_at: string | null;
  clicks: number;
  signups: number;
  upgrades: number;
  earnings: number;
  upgrade_earnings: number;
  task_earnings: number;
}

export default function ContentRewardsCreators() {
  const { t } = useTranslation();
  useLanguageSync();
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdmin();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [actionUserId, setActionUserId] = useState<string | null>(null);
  const [actionType, setActionType] = useState<"enable" | "disable" | "suspend" | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  // Fetch creators
  const { data: creatorsData, isLoading, refetch } = useQuery({
    queryKey: ["content-rewards-creators", searchTerm, statusFilter],
    queryFn: async () => {
      let query = supabase
        .from("profiles")
        .select(`
          id,
          username,
          email,
          content_rewards_enabled,
          content_rewards_status,
          content_rewards_onboarded_at
        `);

      // Filter by status
      if (statusFilter === "enabled") {
        query = query.eq("content_rewards_enabled", true);
      } else if (statusFilter === "approved") {
        query = query.eq("content_rewards_status", "approved");
      } else if (statusFilter === "suspended") {
        query = query.eq("content_rewards_status", "suspended");
      } else if (statusFilter === "pending") {
        query = query.eq("content_rewards_status", "pending");
      }

      // Search by username
      if (searchTerm) {
        query = query.ilike("username", `%${searchTerm}%`);
      }

      const { data: profiles, error } = await query.order("content_rewards_onboarded_at", {
        ascending: false,
      });

      if (error) throw error;

      // Get stats for each creator
      const creatorsWithStats = await Promise.all(
        (profiles || []).map(async (profile) => {
          // Get clicks count
          const { count: clicksCount } = await supabase
            .from("referral_clicks")
            .select("*", { count: "exact", head: true })
            .eq("referrer_id", profile.id);

          // Get signups count
          const { count: signupsCount } = await supabase
            .from("referrals")
            .select("*", { count: "exact", head: true })
            .eq("referrer_id", profile.id);

          // Get upgrades count (users who upgraded after being referred)
          const { data: referrals } = await supabase
            .from("referrals")
            .select("referred_id")
            .eq("referrer_id", profile.id);

          const referredIds = referrals?.map((r) => r.referred_id) || [];
          const { count: upgradesCount } = referredIds.length > 0
            ? await supabase
                .from("transactions")
                .select("*", { count: "exact", head: true })
                .in("user_id", referredIds)
                .eq("type", "plan_upgrade")
            : { count: 0 };

          // Get total earnings with breakdown
          const { data: earnings } = await supabase
            .from("referral_earnings")
            .select("commission_amount, earning_type")
            .eq("referrer_id", profile.id);

          const totalEarnings =
            earnings?.reduce((sum, e) => sum + (Number(e.commission_amount) || 0), 0) || 0;
          
          const upgradeEarnings =
            earnings
              ?.filter((e) => e.earning_type === "deposit_commission" || e.earning_type?.includes("upgrade") || e.earning_type?.includes("deposit"))
              .reduce((sum, e) => sum + (Number(e.commission_amount) || 0), 0) || 0;
          
          const taskEarnings =
            earnings
              ?.filter((e) => e.earning_type === "task_commission" || e.earning_type?.includes("task"))
              .reduce((sum, e) => sum + (Number(e.commission_amount) || 0), 0) || 0;

          return {
            id: profile.id,
            username: profile.username,
            email: profile.email,
            content_rewards_enabled: profile.content_rewards_enabled || false,
            content_rewards_status: profile.content_rewards_status || "pending",
            content_rewards_onboarded_at: profile.content_rewards_onboarded_at,
            clicks: clicksCount || 0,
            signups: signupsCount || 0,
            upgrades: upgradesCount || 0,
            earnings: totalEarnings,
            upgrade_earnings: upgradeEarnings,
            task_earnings: taskEarnings,
          } as Creator;
        })
      );

      return creatorsWithStats;
    },
  });

  const creators = creatorsData || [];

  // Enable/Disable/Suspend mutations
  const enableMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { data, error } = await supabase.rpc("admin_enable_content_rewards", {
        p_user_id: userId,
        p_skip_onboarding: false,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["content-rewards-creators"] });
      toast.success("Content Rewards access enabled successfully");
      setShowConfirmDialog(false);
      setActionUserId(null);
      setActionType(null);
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to enable access");
    },
  });

  const disableMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { data, error } = await supabase.rpc("admin_disable_content_rewards", {
        p_user_id: userId,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["content-rewards-creators"] });
      toast.success("Content Rewards access disabled successfully");
      setShowConfirmDialog(false);
      setActionUserId(null);
      setActionType(null);
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to disable access");
    },
  });

  const suspendMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { data, error } = await supabase.rpc("admin_suspend_content_rewards", {
        p_user_id: userId,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["content-rewards-creators"] });
      toast.success("Creator suspended successfully");
      setShowConfirmDialog(false);
      setActionUserId(null);
      setActionType(null);
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to suspend creator");
    },
  });

  const handleAction = (userId: string, type: "enable" | "disable" | "suspend") => {
    setActionUserId(userId);
    setActionType(type);
    setShowConfirmDialog(true);
  };

  const confirmAction = () => {
    if (!actionUserId || !actionType) return;

    if (actionType === "enable") {
      enableMutation.mutate(actionUserId);
    } else if (actionType === "disable") {
      disableMutation.mutate(actionUserId);
    } else if (actionType === "suspend") {
      suspendMutation.mutate(actionUserId);
    }
  };

  const getStatusBadge = (status: string, enabled: boolean) => {
    if (!enabled) {
      return <Badge variant="secondary">Disabled</Badge>;
    }
    switch (status) {
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

  if (authLoading || adminLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <LoadingSpinner size="lg" text="Loading..." />
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="container mx-auto p-4 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Video className="h-8 w-8 text-primary" />
            Content Rewards Creators
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage creators and their Content Rewards access
          </p>
        </div>
        <Button variant="outline" onClick={() => navigate("/admin")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Admin
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <div className="flex-1">
              <Input
                placeholder="Search by username..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="max-w-sm"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="enabled">Enabled</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="suspended">Suspended</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Creators Table */}
      <Card>
        <CardHeader>
          <CardTitle>Creators ({creators.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <LoadingSpinner size="lg" />
            </div>
          ) : creators.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No creators found
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Username</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Onboarded</TableHead>
                    <TableHead>Clicks</TableHead>
                    <TableHead>Signups</TableHead>
                    <TableHead>Upgrades</TableHead>
                    <TableHead>Total Earnings</TableHead>
                    <TableHead>Breakdown</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {creators.map((creator) => (
                    <TableRow
                      key={creator.id}
                      className="cursor-pointer"
                      onClick={() => navigate(`/admin/content-rewards/creators/${creator.id}`)}
                    >
                      <TableCell className="font-medium">{creator.username}</TableCell>
                      <TableCell>{creator.email}</TableCell>
                      <TableCell>
                        {getStatusBadge(creator.content_rewards_status, creator.content_rewards_enabled)}
                      </TableCell>
                      <TableCell>
                        {creator.content_rewards_onboarded_at
                          ? new Date(creator.content_rewards_onboarded_at).toLocaleDateString()
                          : "-"}
                      </TableCell>
                      <TableCell>{creator.clicks}</TableCell>
                      <TableCell>{creator.signups}</TableCell>
                      <TableCell>{creator.upgrades}</TableCell>
                      <TableCell className="font-medium">
                        {formatCurrency(creator.earnings)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        <div className="space-y-1">
                          <div>Upgrades: {formatCurrency(creator.upgrade_earnings || 0)}</div>
                          <div>Tasks: {formatCurrency(creator.task_earnings || 0)}</div>
                        </div>
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <div className="flex gap-2">
                          {!creator.content_rewards_enabled ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleAction(creator.id, "enable")}
                            >
                              <UserPlus className="h-4 w-4" />
                            </Button>
                          ) : (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleAction(creator.id, "disable")}
                              >
                                <UserMinus className="h-4 w-4" />
                              </Button>
                              {creator.content_rewards_status !== "suspended" && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleAction(creator.id, "suspend")}
                                >
                                  <Shield className="h-4 w-4" />
                                </Button>
                              )}
                            </>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/admin/content-rewards/creators/${creator.id}`);
                            }}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

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
                "This will grant the user access to the Content Rewards dashboard. They can start sharing their referral link immediately."}
              {actionType === "disable" &&
                "This will remove the user's access to the Content Rewards dashboard. Their existing commissions will remain."}
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
