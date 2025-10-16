import React, { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";
import { useUserManagement } from "@/hooks/useUserManagement";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { toast } from "sonner";
import { ArrowLeft, Key, Activity } from "lucide-react";

// Import new tab components
import { OverviewTab } from "@/components/admin/user-detail/OverviewTab";
import { FinancialTab } from "@/components/admin/user-detail/FinancialTab";
import { TasksActivityTab } from "@/components/admin/user-detail/TasksActivityTab";
import { ReferralsTab } from "@/components/admin/user-detail/ReferralsTab";
import { TransactionsTab } from "@/components/admin/user-detail/TransactionsTab";

// Import dialog components
import { WalletAdjustmentDialog } from "@/components/admin/dialogs/WalletAdjustmentDialog";
import { ChangePlanDialog } from "@/components/admin/dialogs/ChangePlanDialog";
import { SuspendUserDialog } from "@/components/admin/dialogs/SuspendUserDialog";
import { BanUserDialog } from "@/components/admin/dialogs/BanUserDialog";

export default function UserDetail() {
  const navigate = useNavigate();
  const { userId } = useParams<{ userId: string }>();
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdmin();
  const { useUserDetail } = useUserManagement();

  // Dialog states
  const [walletDialogOpen, setWalletDialogOpen] = useState(false);
  const [changePlanDialogOpen, setChangePlanDialogOpen] = useState(false);
  const [suspendDialogOpen, setSuspendDialogOpen] = useState(false);
  const [banDialogOpen, setBanDialogOpen] = useState(false);

  // Fetch user detail using the new hook
  const { data: userDetail, isLoading: loadingDetail, refetch } = useUserDetail(userId || '');

  // Master login generation
  const handleGenerateMasterLogin = async () => {
    if (!userId) return;
    
    try {
      const { data, error } = await supabase.functions.invoke("generate-master-login", {
        body: { userId },
      });

      if (error) throw error;

      const loginUrl = `${window.location.origin}/master-login?token=${data.token}`;
      
      // Copy to clipboard
      await navigator.clipboard.writeText(loginUrl);
      toast.success("Master login URL copied to clipboard! Valid for 15 minutes.");
    } catch (error: any) {
      toast.error(error.message || "Failed to generate master login");
    }
  };

  // Redirect checks
  if (!authLoading && !user) {
    navigate("/login");
    return null;
  }

  if (!adminLoading && !isAdmin) {
    navigate("/dashboard");
    return null;
  }

  if (authLoading || adminLoading || loadingDetail) {
    return <LoadingSpinner />;
  }

  if (!userDetail) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-7xl mx-auto">
          <Button variant="ghost" onClick={() => navigate("/admin/users")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Users
          </Button>
          <Card className="mt-6">
            <CardContent className="p-6">
              <p className="text-muted-foreground">User not found</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const profile = userDetail.profile;

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => navigate("/admin/users")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Users
            </Button>
            <div>
              <h1 className="text-3xl font-bold">{profile.username}</h1>
              <p className="text-sm text-muted-foreground">{profile.email}</p>
            </div>
            <Badge
              variant={
                profile.account_status === "active"
                  ? "default"
                  : profile.account_status === "suspended"
                  ? "secondary"
                  : "destructive"
              }
            >
              {profile.account_status}
            </Badge>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleGenerateMasterLogin}
            >
              <Key className="h-4 w-4 mr-2" />
              Master Login
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="financial">Financial</TabsTrigger>
            <TabsTrigger value="tasks">Tasks & Activity</TabsTrigger>
            <TabsTrigger value="referrals">Referrals</TabsTrigger>
            <TabsTrigger value="transactions">Transactions</TabsTrigger>
            <TabsTrigger value="activity">Activity Logs</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <OverviewTab 
              userData={userDetail} 
              onEditProfile={() => toast.info("Use inline editing in Overview tab")}
              onChangePlan={() => setChangePlanDialogOpen(true)}
              onSuspend={() => setSuspendDialogOpen(true)}
              onBan={() => setBanDialogOpen(true)}
              onResetLimits={() => toast.info("Reset limits coming soon")}
              onMasterLogin={handleGenerateMasterLogin}
            />
          </TabsContent>

          <TabsContent value="financial">
            <FinancialTab 
              userData={userDetail} 
              onAdjustWallet={() => setWalletDialogOpen(true)}
            />
          </TabsContent>

          <TabsContent value="tasks">
            <TasksActivityTab userId={userId!} userData={userDetail} />
          </TabsContent>

          <TabsContent value="referrals">
            <ReferralsTab 
              userId={userId!} 
              userData={userDetail}
              onChangeUpline={() => toast.info("Change upline dialog coming soon")}
            />
          </TabsContent>

          <TabsContent value="transactions">
            <TransactionsTab userId={userId!} />
          </TabsContent>

          <TabsContent value="activity">
            <ActivityLogsTab userId={userId!} />
          </TabsContent>
        </Tabs>

        {/* Dialogs */}
        {userDetail && (
          <>
            <WalletAdjustmentDialog
              open={walletDialogOpen}
              onOpenChange={setWalletDialogOpen}
              userId={userId!}
              username={profile.username}
              currentBalance={{
                deposit: userDetail.financial?.deposit_wallet_balance || 0,
                earnings: userDetail.financial?.earnings_wallet_balance || 0,
              }}
            />

            <ChangePlanDialog
              open={changePlanDialogOpen}
              onOpenChange={setChangePlanDialogOpen}
              userId={userId!}
              username={profile.username}
              currentPlan={profile.membership_plan}
              currentExpiry={profile.plan_expires_at}
            />

            <SuspendUserDialog
              open={suspendDialogOpen}
              onOpenChange={setSuspendDialogOpen}
              userId={userId!}
              username={profile.username}
              currentStatus={profile.account_status}
            />

            <BanUserDialog
              open={banDialogOpen}
              onOpenChange={setBanDialogOpen}
              userId={userId!}
              username={profile.username}
              email={profile.email}
            />
          </>
        )}
      </div>
    </div>
  );
}

// Activity Logs Tab Component
function ActivityLogsTab({ userId }: { userId: string }) {
  const [logs, setLogs] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    loadActivityLogs();
  }, [userId]);

  const loadActivityLogs = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("user_activity_log")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) throw error;
      setLogs(data || []);
    } catch (error) {
      console.error("Error loading activity logs:", error);
      toast.error("Failed to load activity logs");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5" />
          Activity Logs
        </CardTitle>
      </CardHeader>
      <CardContent>
        {logs.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">No activity logs found</p>
        ) : (
          <div className="space-y-4">
            {logs.map((log) => (
              <div
                key={log.id}
                className="flex items-start justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
              >
                <div className="space-y-1">
                  <p className="font-medium">{log.activity_type}</p>
                  {log.details && (
                    <pre className="text-xs text-muted-foreground bg-muted p-2 rounded overflow-x-auto">
                      {JSON.stringify(log.details, null, 2)}
                    </pre>
                  )}
                  {log.ip_address && (
                    <p className="text-xs text-muted-foreground">IP: {log.ip_address}</p>
                  )}
                </div>
                <p className="text-xs text-muted-foreground whitespace-nowrap">
                  {new Date(log.created_at).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
