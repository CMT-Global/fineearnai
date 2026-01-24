import React, { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";
import { useUserManagement } from "@/hooks/useUserManagement";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { AdminErrorBoundary } from "@/components/admin/AdminErrorBoundary";
import { toast } from "sonner";
import { ArrowLeft, Key, Activity, Crown, AlertCircle, RefreshCw, Copy, ExternalLink, AlertTriangle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useLanguageSync } from "@/hooks/useLanguageSync";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

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
import { ManageRolesDialog } from "@/components/admin/dialogs/ManageRolesDialog";
import { EditProfileDialog } from "@/components/admin/dialogs/EditProfileDialog";

function UserDetailContent() {
  const { t } = useTranslation();
  useLanguageSync(); // Sync language and force re-render
  const navigate = useNavigate();
  const { userId } = useParams<{ userId: string }>();
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdmin();
  const { useUserDetail } = useUserManagement();
  const queryClient = useQueryClient();

  // Dialog states
  const [walletDialogOpen, setWalletDialogOpen] = useState(false);
  const [changePlanDialogOpen, setChangePlanDialogOpen] = useState(false);
  const [suspendDialogOpen, setSuspendDialogOpen] = useState(false);
  const [banDialogOpen, setBanDialogOpen] = useState(false);
  const [manageRolesDialogOpen, setManageRolesDialogOpen] = useState(false);
  const [editProfileDialogOpen, setEditProfileDialogOpen] = useState(false);

  // User roles state
  const [userRoles, setUserRoles] = useState<string[]>(['user']);
  
  // Master login URL state
  const [masterLoginUrl, setMasterLoginUrl] = useState<string | null>(null);

  // Fetch user detail using the new hook
  const { data: userDetail, isLoading: loadingDetail, error: detailError, refetch } = useUserDetail(userId || '');

  // Fetch user roles when component mounts or userId changes
  React.useEffect(() => {
    const fetchUserRoles = async () => {
      if (!userId) return;
      
      try {
        const { data, error } = await supabase.functions.invoke('admin-manage-user', {
          body: { 
            action: 'get_user_roles',
            userId 
          }
        });

        if (error) throw error;
        setUserRoles(data?.roles || ['user']);
      } catch (err) {
        console.error('Error fetching user roles:', err);
        setUserRoles(['user']); // Fallback to user role
      }
    };

    fetchUserRoles();
  }, [userId]);

  // PHASE 5: Enhanced query invalidation with comprehensive cache management
  const handleUserUpdated = async () => {
    console.log('🔄 PHASE 5: handleUserUpdated triggered:', {
      timestamp: new Date().toISOString(),
      userId,
      action: 'comprehensive_cache_invalidation'
    });

    // Wait for database to commit (200ms proven sufficient)
    await new Promise(resolve => setTimeout(resolve, 200));
    
    console.log('📦 PHASE 5: Invalidating related query caches:', {
      timestamp: new Date().toISOString(),
      queries: [
        'user-detail (primary)',
        'users (list cache)',
        'user-transactions',
        'user-referrals',
        'admin-stats (if affected)'
      ]
    });

    // Invalidate all queries related to this user
    await Promise.all([
      // Primary user detail cache
      queryClient.invalidateQueries({ queryKey: ['admin-user-detail', userId] }),
      
      // Users list cache (in case user appears in listings)
      queryClient.invalidateQueries({ queryKey: ['users'] }),
      
      // User-specific transaction cache
      queryClient.invalidateQueries({ queryKey: ['transactions', userId] }),
      
      // User-specific referral cache
      queryClient.invalidateQueries({ queryKey: ['referrals', userId] }),
      
      // Admin dashboard stats (might include this user's data)
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] }),
      
      // Withdrawal requests if they exist
      queryClient.invalidateQueries({ queryKey: ['withdrawal-requests'] }),
    ]);
    
    console.log('✅ PHASE 5: All related caches invalidated:', {
      timestamp: new Date().toISOString(),
      action: 'forcing_refetch'
    });

    // Force hard refetch of primary query
    await refetch();

    console.log('✅ PHASE 5: Cache invalidation and refetch complete:', {
      timestamp: new Date().toISOString(),
      status: 'success'
    });
  };

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
      
      // Store URL to display in dialog
      setMasterLoginUrl(loginUrl);
      
      toast.success(t("admin.userDetail.masterLoginUrlGeneratedSuccess"));
    } catch (error: any) {
      toast.error(error.message || t("admin.userDetail.failedToGenerateMasterLogin"));
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
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  // Show error UI if fetch failed
  if (detailError) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-7xl mx-auto">
          <Button variant="ghost" onClick={() => navigate("/admin/users")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            {t("admin.userDetail.backToUsers")}
          </Button>
          <Card className="mt-6">
            <CardContent className="p-6">
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>{t("admin.userDetail.errorLoadingUser")}</AlertTitle>
                <AlertDescription className="space-y-3">
                  <p>{detailError.message || t("admin.userDetail.failedToLoadUserDetails")}</p>
                  <Button 
                    onClick={() => refetch()} 
                    variant="outline" 
                    size="sm"
                    className="mt-2"
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    {t("admin.userDetail.tryAgain")}
                  </Button>
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (!userDetail) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-7xl mx-auto">
          <Button variant="ghost" onClick={() => navigate("/admin/users")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            {t("admin.userDetail.backToUsers")}
          </Button>
          <Card className="mt-6">
            <CardContent className="p-6">
              <p className="text-muted-foreground">{t("admin.userDetail.userNotFound")}</p>
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
          <Button variant="ghost" onClick={() => navigate("/admin/users")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            {t("admin.userDetail.backToUsers")}
          </Button>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleGenerateMasterLogin}
            >
              <Key className="h-4 w-4 mr-2" />
              {t("admin.userDetail.masterLogin")}
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList>
            <TabsTrigger value="overview">{t("admin.userDetail.tabs.overview")}</TabsTrigger>
            <TabsTrigger value="financial">{t("admin.userDetail.tabs.financial")}</TabsTrigger>
            <TabsTrigger value="tasks">{t("admin.userDetail.tabs.tasks")}</TabsTrigger>
            <TabsTrigger value="referrals">{t("admin.userDetail.tabs.referrals")}</TabsTrigger>
            <TabsTrigger value="transactions">{t("admin.userDetail.tabs.transactions")}</TabsTrigger>
            <TabsTrigger value="activity">{t("admin.userDetail.tabs.activity")}</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <OverviewTab 
              userData={userDetail} 
              onEditProfile={() => setEditProfileDialogOpen(true)}
              onChangePlan={() => setChangePlanDialogOpen(true)}
              onSuspend={() => setSuspendDialogOpen(true)}
              onBan={() => setBanDialogOpen(true)}
              onResetLimits={() => toast.info(t("admin.toasts.resetLimitsComingSoon"))}
              onMasterLogin={handleGenerateMasterLogin}
              onManageRoles={() => setManageRolesDialogOpen(true)}
              onUserUpdated={handleUserUpdated}
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
            <EditProfileDialog
              open={editProfileDialogOpen}
              onOpenChange={setEditProfileDialogOpen}
              userId={userId!}
              username={profile.username}
              currentProfile={{
                full_name: profile.full_name,
                phone: profile.phone,
                country: profile.country,
              }}
              onSuccess={handleUserUpdated}
            />

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

            <ManageRolesDialog
              open={manageRolesDialogOpen}
              onOpenChange={setManageRolesDialogOpen}
              userId={userId!}
              username={profile.username}
              currentRoles={userRoles}
              onSuccess={async () => {
                await handleUserUpdated();
                // Refetch roles after update
                try {
                  const { data } = await supabase.functions.invoke('admin-manage-user', {
                    body: { action: 'get_user_roles', userId: userId! }
                  });
                  setUserRoles(data?.roles || ['user']);
                } catch (err) {
                  console.error('Error refetching roles:', err);
                }
              }}
            />
          </>
        )}

        {/* Master Login URL Dialog */}
        <AlertDialog open={!!masterLoginUrl} onOpenChange={() => setMasterLoginUrl(null)}>
          <AlertDialogContent className="max-w-2xl">
            <AlertDialogHeader>
              <AlertDialogTitle>{t("admin.userDetail.masterLoginUrlGenerated")}</AlertDialogTitle>
              <AlertDialogDescription>
                {t("admin.userDetail.masterLoginUrlDescription")}
              </AlertDialogDescription>
            </AlertDialogHeader>
            
            <div className="space-y-4">
              <div className="p-4 bg-muted rounded-lg border">
                <p className="text-sm font-mono break-all">{masterLoginUrl}</p>
              </div>
              
              <div className="flex gap-2">
                <Button
                  onClick={() => {
                    navigator.clipboard.writeText(masterLoginUrl!);
                    toast.success(t("admin.userDetail.urlCopied"));
                  }}
                  variant="outline"
                  className="flex-1"
                >
                  <Copy className="h-4 w-4 mr-2" />
                  {t("admin.userDetail.copyUrl")}
                </Button>
                
                <Button
                  onClick={() => {
                    window.open(masterLoginUrl!, '_blank');
                  }}
                  className="flex-1"
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  {t("admin.userDetail.openInNewTab")}
                </Button>
              </div>
              
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>{t("admin.userDetail.securityNotice")}</AlertTitle>
                <AlertDescription>
                  {t("admin.userDetail.securityNoticeDescription")}
                </AlertDescription>
              </Alert>
            </div>
            
            <AlertDialogFooter>
              <AlertDialogAction onClick={() => setMasterLoginUrl(null)}>
                {t("common.close")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}

// Activity Logs Tab Component
function ActivityLogsTab({ userId }: { userId: string }) {
  const { t } = useTranslation();
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
      toast.error(t("admin.userDetail.failedToLoadActivityLogs"));
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
          {t("admin.userDetail.activityLogs")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {logs.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">{t("admin.userDetail.noActivityLogsFound")}</p>
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

export default function UserDetail() {
  return (
    <AdminErrorBoundary fallbackTitle="User Detail Error">
      <UserDetailContent />
    </AdminErrorBoundary>
  );
}
