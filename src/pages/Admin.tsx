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
  Shield,
  RefreshCw,
  ArrowRight
} from "lucide-react";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/wallet-utils";

const Admin = () => {
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
      toast.error("Access denied. Admin privileges required.");
      navigate("/dashboard");
    }
  }, [isAdmin, adminLoading, navigate]);

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
        acc[profile.membership_plan] = (acc[profile.membership_plan] || 0) + 1;
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
      toast.error("Failed to load statistics");
    } finally {
      setLoading(false);
    }
  };

  if (authLoading || adminLoading || loading) {
    return (
      <div className="min-h-screen bg-[hsl(0,0%,98%)] flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Loading admin panel...</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <Shield className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold">Admin Dashboard</h1>
        </div>
        <p className="text-muted-foreground">
          Platform overview and management
        </p>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Users
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-2xl font-bold">{stats?.totalUsers || 0}</div>
              <Users className="h-8 w-8 text-blue-500" />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {stats?.activeUsers || 0} active today
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Deposits
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
              {stats?.totalDepositCount || 0} completed deposits
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Withdrawals
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
              {stats?.totalWithdrawalCount || 0} completed payouts
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Pending Withdrawals
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-2xl font-bold">{stats?.pendingWithdrawals || 0}</div>
              <AlertCircle className="h-8 w-8 text-orange-500" />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Requires approval
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Access Cards */}
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold mb-4">Quick Access</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate("/admin/users")}>
              <CardHeader>
                <CardTitle className="text-lg">User Management</CardTitle>
                <CardDescription>View and manage all users</CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="ghost" className="w-full justify-between">
                  Manage Users
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </CardContent>
            </Card>

            <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate("/admin/tasks/generate")}>
              <CardHeader>
                <CardTitle className="text-lg">AI Tasks</CardTitle>
                <CardDescription>Generate and manage tasks</CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="ghost" className="w-full justify-between">
                  Generate Tasks
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </CardContent>
            </Card>

            <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate("/admin/withdrawals")}>
              <CardHeader>
                <CardTitle className="text-lg">Withdrawals</CardTitle>
                <CardDescription>Process withdrawal requests</CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="ghost" className="w-full justify-between">
                  View Withdrawals
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </CardContent>
            </Card>

            <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate("/admin/transactions")}>
              <CardHeader>
                <CardTitle className="text-lg">Transactions</CardTitle>
                <CardDescription>View all transactions</CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="ghost" className="w-full justify-between">
                  View Transactions
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </CardContent>
            </Card>

            <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate("/admin/plans/manage")}>
              <CardHeader>
                <CardTitle className="text-lg">Membership Plans</CardTitle>
                <CardDescription>Configure plans and pricing</CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="ghost" className="w-full justify-between">
                  Manage Plans
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </CardContent>
            </Card>

            <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate("/admin/analytics/tasks")}>
              <CardHeader>
                <CardTitle className="text-lg">Analytics</CardTitle>
                <CardDescription>View platform analytics</CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="ghost" className="w-full justify-between">
                  View Analytics
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </CardContent>
            </Card>

            <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate("/admin/settings/cpay-checkouts")}>
              <CardHeader>
                <CardTitle className="text-lg">CPAY Checkouts</CardTitle>
                <CardDescription>Manage deposit checkout pages</CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="ghost" className="w-full justify-between">
                  Manage Checkouts
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Membership Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Membership Distribution</CardTitle>
            <CardDescription>Overview of user membership tiers</CardDescription>
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
      </div>
    </div>
  );
};

export default Admin;
