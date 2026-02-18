import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Users, 
  DollarSign, 
  Crown,
  TrendingUp,
  AlertCircle,
  Shield
} from "lucide-react";
import { PageLoading } from "@/components/shared/PageLoading";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/wallet-utils";
import { Last7DaysActivityTable } from "@/components/admin/Last7DaysActivityTable";
import { useTranslation } from "react-i18next";

const Admin = () => {
  const { t } = useTranslation();
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdmin();
  const navigate = useNavigate();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/login");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!adminLoading && !isAdmin) {
      toast.error(t("admin.accessDenied"));
      navigate("/dashboard");
    }
  }, [isAdmin, adminLoading, navigate, t]);

  useEffect(() => {
    if (isAdmin) {
      loadStats();
    }
  }, [isAdmin]);

  const loadStats = async () => {
    try {
      setLoading(true);

      // Get total users
      const { count: totalUsers } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true });

      // Get active users (completed tasks today)
      const { count: activeUsers } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .gt("tasks_completed_today", 0);

      // Get pending withdrawals
      const { count: pendingWithdrawals } = await supabase
        .from("transactions")
        .select("*", { count: "exact", head: true })
        .eq("type", "withdrawal")
        .eq("status", "pending");

      // Get total completed deposits (regular deposits only)
      const { data: depositsData } = await supabase
        .from("transactions")
        .select("amount")
        .eq("type", "deposit")
        .eq("status", "completed");

      const totalDeposits = depositsData?.reduce(
        (sum, tx) => sum + parseFloat(String(tx.amount || 0)),
        0
      ) || 0;

      const totalDepositCount = depositsData?.length || 0;

      // Get total completed withdrawals
      const { data: withdrawalsData } = await supabase
        .from("withdrawal_requests")
        .select("net_amount")
        .eq("status", "completed");

      const totalWithdrawals = withdrawalsData?.reduce(
        (sum, wr) => sum + parseFloat(String(wr.net_amount || 0)),
        0
      ) || 0;

      const totalWithdrawalCount = withdrawalsData?.length || 0;

      // Get membership distribution
      const { data: membershipData } = await supabase
        .from("profiles")
        .select("membership_plan");

      const membershipDistribution = membershipData?.reduce((acc: any, profile) => {
        const raw = profile.membership_plan ?? "";
        const key = raw.trim() ? raw.trim().charAt(0).toUpperCase() + raw.trim().slice(1).toLowerCase() : "Unknown";
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {});

      setStats({
        totalUsers: totalUsers || 0,
        activeUsers: activeUsers || 0,
        pendingWithdrawals: pendingWithdrawals || 0,
        totalDeposits,
        totalDepositCount,
        totalWithdrawals,
        totalWithdrawalCount,
        membershipDistribution: membershipDistribution || {},
      });
    } catch (error: any) {
      console.error("Error loading stats:", error);
      toast.error(t("admin.failedToLoadStats"));
    } finally {
      setLoading(false);
    }
  };

  if (authLoading || adminLoading || loading) {
    return <PageLoading text={t("admin.loadingDashboard")} />;
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <Shield className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold">{t("admin.dashboard")}</h1>
        </div>
        <p className="text-muted-foreground">
          {t("admin.subtitle")}
        </p>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("admin.totalUsers")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-2xl font-bold">{stats?.totalUsers || 0}</div>
              <Users className="h-8 w-8 text-blue-500" />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {stats?.activeUsers || 0} {t("admin.activeToday")}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("admin.totalDeposits")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-2xl font-bold">
                {formatCurrency(stats?.totalDeposits || 0)}
              </div>
              <TrendingUp className="h-8 w-8 text-green-500" />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {stats?.totalDepositCount || 0} {t("admin.completedDeposits")}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("admin.totalWithdrawals")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-2xl font-bold">
                {formatCurrency(stats?.totalWithdrawals || 0)}
              </div>
              <DollarSign className="h-8 w-8 text-red-500" />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {stats?.totalWithdrawalCount || 0} {t("admin.completedPayouts")}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("admin.pendingWithdrawals")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-2xl font-bold">{stats?.pendingWithdrawals || 0}</div>
              <AlertCircle className="h-8 w-8 text-orange-500" />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {t("admin.requiresApproval")}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Membership Distribution */}
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>{t("admin.membershipDistribution")}</CardTitle>
            <CardDescription>{t("admin.membershipDistributionDescription")}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {stats?.membershipDistribution &&
                Object.entries(stats.membershipDistribution).map(
                  ([plan, count]: [string, any]) => (
                    <div key={plan} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Crown className="h-5 w-5 text-primary" />
                        <span className="font-medium capitalize">{plan}</span>
                      </div>
                      <span className="text-2xl font-bold">{count}</span>
                    </div>
                  )
                )}
            </div>
          </CardContent>
        </Card>

        {/* Last 7 Days Activity */}
        <Card>
          <CardHeader>
            <CardTitle>{t("admin.last7DaysActivity")}</CardTitle>
            <CardDescription>{t("admin.last7DaysActivityDescription")}</CardDescription>
          </CardHeader>
          <CardContent>
            <Last7DaysActivityTable />
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Admin;
