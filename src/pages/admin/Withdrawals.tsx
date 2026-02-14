import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CheckCircle, XCircle, Clock, DollarSign, Copy, AlertCircle, ExternalLink, RefreshCw } from "lucide-react";
import { formatCurrency } from "@/lib/wallet-utils";
import { getPaymentMethodDisplayName } from "@/lib/payment-processor-utils";
import { PageLoading } from "@/components/shared/PageLoading";
import { AdminBreadcrumb } from "@/components/admin/AdminBreadcrumb";

interface WithdrawalRequest {
  id: string;
  user_id: string;
  amount: number;
  net_amount: number;
  fee: number;
  payout_address: string;
  payment_method: string;
  status: string;
  rejection_reason?: string;
  admin_notes?: string;
  manual_txn_hash?: string;
  processed_at?: string;
  created_at: string;
  payment_provider?: string;
  metadata?: {
    crypto_id?: string;           // 'usdc-solana' or 'usdt-bep20'
    crypto_name?: string;         // 'USDC (Solana)' or 'USDT (BEP-20)'
    processor_id?: string;
    requested_at?: string;
    user_agent?: string;
  };
  api_response?: {
    error?: string;
    details?: string;
    provider?: string;
    failed_at?: string;
  };
  profiles?: {
    username: string;
    email: string;
    membership_plan: string;
    registration_country_name: string | null;
  };
}

export default function Withdrawals() {
  const { t, i18n: i18nInstance } = useTranslation();
  const { userLanguage, isLoading: isLanguageLoading } = useLanguage();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  // Force re-render when language changes
  useEffect(() => {
    // Ensure i18n language is synced with userLanguage from context
    if (i18nInstance.language !== userLanguage && !isLanguageLoading) {
      i18nInstance.changeLanguage(userLanguage).catch((err) => {
        console.error('Error changing i18n language:', err);
      });
    }
  }, [userLanguage, isLanguageLoading, i18nInstance]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [actionType, setActionType] = useState<'manual' | 'api' | 'reject' | null>(null);
  const [selectedTab, setSelectedTab] = useState("pending");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedWithdrawal, setSelectedWithdrawal] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [fetchingWalletInfo, setFetchingWalletInfo] = useState(false);
  const [walletInfo, setWalletInfo] = useState<any | null>(null);
  const [showWalletInfoDialog, setShowWalletInfoDialog] = useState(false);
  const [fetchingBalance, setFetchingBalance] = useState(false);
  const [walletBalance, setWalletBalance] = useState<any | null>(null);
  const [showBalanceDialog, setShowBalanceDialog] = useState(false);

  useEffect(() => {
    checkAuth();
    loadWithdrawals();
  }, []);

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/login");
      return;
    }

    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .single();

    if (!roleData) {
      navigate("/dashboard");
      toast({
        title: t("toasts.admin.accessDenied"),
        description: t("errors.admin.accessDenied"),
        variant: "destructive",
      });
    }
  };


  const loadWithdrawals = async () => {
    try {
      setLoading(true);
      
      // Fetch withdrawals and profiles separately to avoid relationship ambiguity
      // This approach works around the PGRST201 error when multiple relationships exist
      const { data: withdrawalsData, error: withdrawalsError } = await supabase
        .from("withdrawal_requests")
        .select("*")
        .order("created_at", { ascending: false });

      if (withdrawalsError) {
        console.error("Error fetching withdrawals:", withdrawalsError);
        throw withdrawalsError;
      }

      if (!withdrawalsData || withdrawalsData.length === 0) {
        setWithdrawals([]);
        return;
      }

      // Get unique user IDs
      const userIds = [...new Set(withdrawalsData.map(w => w.user_id).filter(Boolean))];
      
      // If no valid user IDs, return withdrawals without profiles
      if (userIds.length === 0) {
        setWithdrawals(withdrawalsData.map(w => ({ ...w, profiles: undefined })) as any);
        return;
      }
      
      // Fetch profiles for all users in one query
      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("id, username, email, membership_plan, registration_country_name")
        .in("id", userIds);

      if (profilesError) {
        console.error("Error fetching profiles:", profilesError);
        throw profilesError;
      }

      // Create a map of user_id -> profile for quick lookup
      const profilesMap = new Map(
        (profilesData || []).map(profile => [
          profile.id, 
          {
            username: profile.username,
            email: profile.email,
            membership_plan: profile.membership_plan,
            registration_country_name: profile.registration_country_name
          }
        ])
      );

      // Merge withdrawals with profiles
      const withdrawalsWithProfiles = withdrawalsData.map(withdrawal => ({
        ...withdrawal,
        profiles: profilesMap.get(withdrawal.user_id) || undefined
      }));

      setWithdrawals(withdrawalsWithProfiles as any);
    } catch (error: any) {
      console.error("Error loading withdrawals:", error);
      
      // Extract error message from various error formats
      let errorMessage = "Unknown error";
      if (error?.message) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      } else if (error?.details) {
        errorMessage = error.details;
      } else if (error?.hint) {
        errorMessage = error.hint;
      }
      
      console.error("Error details:", {
        message: errorMessage,
        code: error?.code,
        details: error?.details,
        hint: error?.hint,
        error: error,
        stack: error?.stack
      });
      
      toast({
        title: t("common.error"),
        description: `${t("admin.withdrawals.errorFailedToLoad")}: ${errorMessage}`,
        variant: "destructive",
        duration: 10000, // Longer duration to read the error
      });
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsPaidManually = async (withdrawalId: string) => {
    if (processing) {
      toast({
        title: t("common.pleaseWait"),
        description: t("admin.withdrawals.anotherWithdrawalProcessing"),
        variant: "destructive",
      });
      return;
    }

    const notes = prompt(t("admin.withdrawals.addNotesPrompt"));
    
    try {
      setProcessing(withdrawalId);
      setActionType('manual');
      
      const { data, error } = await supabase.functions.invoke("process-withdrawal-payment", {
        body: {
          withdrawal_request_id: withdrawalId,
          action: "mark_paid_manually",
          manual_payment_notes: notes || t("admin.withdrawals.markedAsPaidManuallyByAdmin")
        }
      });
      
      if (error) throw error;

      if (data?.success) {
        toast({
          title: t("admin.withdrawals.success"),
          description: t("admin.withdrawals.withdrawalMarkedAsPaid", { hash: data.transaction_hash || 'N/A' })
        });
      } else {
        toast({
          title: t("admin.withdrawals.error"),
          description: data?.error || t("admin.withdrawals.failedToMarkAsPaid"),
          variant: "destructive",
        });
      }
      
      await loadWithdrawals();
    } catch (error) {
      console.error("Error marking withdrawal as paid:", error);
      toast({
        title: t("admin.withdrawals.error"),
        description: error instanceof Error ? error.message : t("admin.withdrawals.failedToMarkAsPaid"),
        variant: "destructive",
      });
    } finally {
      setProcessing(null);
      setActionType(null);
    }
  };

  const handleClearErrorAndRetry = async (withdrawalId: string) => {
    const withdrawal = withdrawals.find(w => w.id === withdrawalId);
    if (!withdrawal) {
      toast({
        title: t("admin.withdrawals.error"),
        description: t("admin.withdrawals.withdrawalNotFound"),
        variant: "destructive",
      });
      return;
    }

    if (!confirm(t("admin.withdrawals.clearErrorAndRetryConfirm"))) return;
    
    try {
      setProcessing(withdrawalId);
      setActionType('api');

      toast({
        title: t("admin.withdrawals.clearingError"),
        description: t("admin.withdrawals.clearingErrorDescription"),
      });

      // Step 1: Clear the api_response error field
      const { error: clearError } = await supabase
        .from('withdrawal_requests')
        .update({ 
          api_response: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', withdrawalId);

      if (clearError) {
        throw clearError;
      }

      // Step 2: Immediately retry the API payment
      const { data, error } = await supabase.functions.invoke("process-withdrawal-payment", {
        body: {
          withdrawal_request_id: withdrawalId,
          action: "pay_via_api"
        }
      });
      
      if (error) throw error;
      
      // Check for API-specific failures
      if (data.api_failed) {
        toast({
          title: t("admin.withdrawals.apiPaymentFailedAgain"),
          description: t("admin.withdrawals.apiPaymentFailedDescription", { 
            error: data.error_message || 'API call failed',
            provider: data.provider?.toUpperCase() || t("admin.withdrawals.unknown")
          }),
          variant: "destructive",
          duration: 10000,
        });
      } 
      else if (!data.success) {
        toast({
          title: t("admin.withdrawals.error"),
          description: data.error || data.error_message || t("admin.withdrawals.failedToProcessPayment"),
          variant: "destructive",
        });
      } 
      else {
        toast({
          title: t("admin.withdrawals.paymentSentSuccessfully"),
          description: data.transaction_hash 
            ? t("admin.withdrawals.paymentSentDescription", { 
                provider: data.provider?.toUpperCase() || t("admin.withdrawals.unknown"),
                hash: data.transaction_hash.substring(0, 20)
              })
            : t("admin.withdrawals.paymentProcessedSuccessfully"),
          duration: 6000,
        });
      }
      
      await loadWithdrawals();
    } catch (error) {
      console.error("Error clearing error and retrying:", error);
      toast({
        title: t("admin.withdrawals.error"),
        description: error instanceof Error ? error.message : t("admin.withdrawals.failedToProcessPayment"),
        variant: "destructive",
      });
    } finally {
      setProcessing(null);
      setActionType(null);
    }
  };

  const handlePayViaAPI = async (withdrawalId: string) => {
    if (processing) {
      toast({
        title: t("common.pleaseWait"),
        description: t("admin.withdrawals.anotherWithdrawalProcessing"),
        variant: "destructive",
      });
      return;
    }

    if (!confirm(t("admin.withdrawals.processViaAPIConfirm"))) return;
    
    try {
      setProcessing(withdrawalId);
      setActionType('api');

      toast({
        title: t("admin.withdrawals.processing"),
        description: t("admin.withdrawals.sendingPaymentRequest"),
      });
      
      const { data, error } = await supabase.functions.invoke("process-withdrawal-payment", {
        body: {
          withdrawal_request_id: withdrawalId,
          action: "pay_via_api"
        }
      });
      
      if (error) throw error;
      
      // Check for API-specific failures (API called but failed - withdrawal stays pending)
      if (data.api_failed) {
        toast({
          title: t("admin.withdrawals.apiPaymentFailedTitle"),
          description: t("admin.withdrawals.apiPaymentFailedDescription", { 
            error: data.error_message || 'API call failed',
            provider: data.provider?.toUpperCase() || t("admin.withdrawals.unknown")
          }),
          variant: "destructive",
          duration: 10000, // Longer duration for important admin message
        });
      } 
      // Check for general errors (should not happen with new logic, but kept for safety)
      else if (!data.success) {
        toast({
          title: t("admin.withdrawals.error"),
          description: data.error || data.error_message || t("admin.withdrawals.failedToProcessPayment"),
          variant: "destructive",
        });
      } 
      // Success - payment sent
      else {
        toast({
          title: t("admin.withdrawals.paymentSentSuccessfully"),
          description: data.transaction_hash 
            ? t("admin.withdrawals.paymentSentDescription", { 
                provider: data.provider?.toUpperCase() || t("admin.withdrawals.unknown"),
                hash: data.transaction_hash.substring(0, 20)
              })
            : t("admin.withdrawals.paymentProcessedSuccessfully"),
          duration: 6000,
        });
      }
      
      await loadWithdrawals();
    } catch (error) {
      console.error("Error processing API payment:", error);
      toast({
        title: t("admin.withdrawals.error"),
        description: error instanceof Error ? error.message : t("admin.withdrawals.failedToProcessPayment"),
        variant: "destructive",
      });
    } finally {
      setProcessing(null);
      setActionType(null);
    }
  };

  const handleReject = async () => {
    if (!selectedWithdrawal) return;
    
    if (!rejectionReason.trim()) {
      toast({
        title: t("admin.withdrawals.error"),
        description: t("admin.withdrawals.rejectionReasonRequiredError"),
        variant: "destructive",
      });
      return;
    }

    if (rejectionReason.length < 10) {
      toast({
        title: t("admin.withdrawals.error"),
        description: t("admin.withdrawals.rejectionReasonMinLength"),
        variant: "destructive",
      });
      return;
    }
    
    try {
      setProcessing(selectedWithdrawal);
      setActionType('reject');
      
      const { data, error } = await supabase.functions.invoke("process-withdrawal-payment", {
        body: {
          withdrawal_request_id: selectedWithdrawal,
          action: "reject",
          rejection_reason: rejectionReason
        }
      });
      
      if (error) throw error;

      if (data?.success) {
        toast({
          title: t("admin.withdrawals.success"),
          description: t("admin.withdrawals.withdrawalRejected", { 
            amount: data.refunded_amount ? formatCurrency(data.refunded_amount) : '' 
          })
        });
      } else {
        toast({
          title: t("admin.withdrawals.error"),
          description: data?.error || t("admin.withdrawals.failedToReject"),
          variant: "destructive",
        });
      }
      
      await loadWithdrawals();
    } catch (error) {
      console.error("Error rejecting withdrawal:", error);
      toast({
        title: t("admin.withdrawals.error"),
        description: error instanceof Error ? error.message : t("admin.withdrawals.failedToReject"),
        variant: "destructive",
      });
    } finally {
      setProcessing(null);
      setActionType(null);
      setDialogOpen(false);
      setSelectedWithdrawal(null);
      setRejectionReason("");
    }
  };

  const openRejectDialog = (withdrawalId: string) => {
    setSelectedWithdrawal(withdrawalId);
    setDialogOpen(true);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: t("common.copied"),
      description: t("admin.withdrawals.addressCopied"),
    });
  };

  const handleFetchCPAYWalletInfo = async (mode: 'wallet' | 'deposit' = 'wallet') => {
    try {
      setFetchingWalletInfo(true);
      const modeLabel = mode === 'deposit' ? t("admin.withdrawals.lastDepositDescription") : t("admin.withdrawals.walletAPIDescription");
      toast({
        title: t("admin.withdrawals.fetchingTokenInfo"),
        description: t("admin.withdrawals.retrievingCPAYToken", { source: modeLabel }),
      });

      const { data, error } = await supabase.functions.invoke("get-cpay-wallet-info", {
        body: { mode } // Pass mode as query param alternative
      });
      
      if (error) throw error;
      
      if (data.success) {
        setWalletInfo(data);
        setShowWalletInfoDialog(true);
        
        const tokenId = data.usdtTrc20Token?.currencyId || data.token?.currencyId;
        if (tokenId) {
          toast({
            title: t("admin.withdrawals.tokenIdFound"),
            description: t("admin.withdrawals.tokenIdFoundDescription", { 
              source: data.source || mode,
              tokenId 
            }),
            duration: 10000,
          });
        }
      } else {
        toast({
          title: t("admin.withdrawals.error"),
          description: data.error || t("admin.withdrawals.failedToFetchTokenInfo"),
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error fetching CPAY token info:", error);
      toast({
        title: t("admin.withdrawals.error"),
        description: error instanceof Error ? error.message : t("admin.withdrawals.failedToFetchTokenInfo"),
        variant: "destructive",
      });
    } finally {
      setFetchingWalletInfo(false);
    }
  };

  const handleFetchCPAYWalletBalance = async () => {
    try {
      setFetchingBalance(true);
      setWalletBalance(null);

      console.log('[Withdrawals] Fetching CPAY wallet balance...');
      
      const { data, error } = await supabase.functions.invoke('get-cpay-wallet-balance');

      if (error) {
        console.error('[Withdrawals] Error fetching wallet balance:', error);
        toast({
          title: t("admin.withdrawals.error"),
          description: error.message || t("admin.withdrawals.failedToFetchBalance"),
          variant: "destructive",
        });
        return;
      }

      if (!data?.success) {
        console.error('[Withdrawals] API returned error:', data);
        toast({
          title: t("admin.withdrawals.cpayError"),
          description: data?.error || t("admin.withdrawals.failedToFetchBalance"),
          variant: "destructive",
        });
        return;
      }

      console.log('[Withdrawals] Wallet balance retrieved:', data);
      setWalletBalance(data);
      setShowBalanceDialog(true);

      toast({
        title: t("admin.withdrawals.success"),
        description: t("admin.withdrawals.walletBalanceRetrieved"),
      });
    } catch (err: any) {
      console.error('[Withdrawals] Unexpected error:', err);
      toast({
        title: t("admin.withdrawals.error"),
        description: err.message || t("admin.withdrawals.anUnexpectedErrorOccurred"),
        variant: "destructive",
      });
    } finally {
      setFetchingBalance(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
      pending: { label: t("admin.withdrawals.status.pending"), variant: "secondary" },
      processing: { label: t("admin.withdrawals.status.processing"), variant: "default" },
      completed: { label: t("admin.withdrawals.status.completed"), variant: "default" },
      rejected: { label: t("admin.withdrawals.status.rejected"), variant: "destructive" },
      failed: { label: t("admin.withdrawals.status.failed"), variant: "destructive" },
    };

    const config = statusConfig[status] || { label: status, variant: "outline" };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const filteredWithdrawals = withdrawals.filter(w => {
    if (selectedTab === "pending") return w.status === "pending";
    if (selectedTab === "completed") return ["completed", "processing"].includes(w.status);
    if (selectedTab === "rejected") return ["rejected", "failed"].includes(w.status);
    return true;
  });

  const stats = {
    pending: withdrawals.filter(w => w.status === "pending").length,
    pendingAmount: withdrawals
      .filter(w => w.status === "pending")
      .reduce((sum, w) => sum + parseFloat(w.amount.toString()), 0),
    completed: withdrawals.filter(w => w.status === "completed").length,
    rejected: withdrawals.filter(w => ["rejected", "failed"].includes(w.status)).length,
  };

  if (loading) {
    return <PageLoading text={t("admin.withdrawals.loading")} />;
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="container mx-auto">
        <AdminBreadcrumb 
          items={[
            { label: t("admin.sidebar.categories.financialManagement") },
            { label: t("admin.sidebar.items.withdrawals") }
          ]} 
        />
        
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">{t("admin.withdrawals.title")}</h1>
          <p className="text-muted-foreground">{t("admin.withdrawals.subtitle")}</p>
        </div>


      <div className="grid gap-4 md:grid-cols-3 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">{t("admin.withdrawals.stats.pendingRequests")}</CardTitle>
            <Clock className="h-4 w-4 text-yellow-600 dark:text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pending}</div>
            <p className="text-xs text-muted-foreground">
              {formatCurrency(stats.pendingAmount)} {t("admin.withdrawals.stats.total")}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">{t("admin.withdrawals.stats.completed")}</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.completed}</div>
            <p className="text-xs text-muted-foreground">{t("admin.withdrawals.stats.successfullyProcessed")}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">{t("admin.withdrawals.stats.rejected")}</CardTitle>
            <XCircle className="h-4 w-4 text-red-600 dark:text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.rejected}</div>
            <p className="text-xs text-muted-foreground">{t("admin.withdrawals.stats.failedOrRejected")}</p>
          </CardContent>
        </Card>
      </div>

      {/* CPAY Configuration Diagnostic Section */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-primary" />
            {t("admin.withdrawals.cpayTokenHelper")}
          </CardTitle>
          <CardDescription>
            {t("admin.withdrawals.cpayTokenHelperDescription")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center gap-3 flex-wrap">
              <Button
                onClick={() => handleFetchCPAYWalletInfo('wallet')}
                disabled={fetchingWalletInfo}
                variant="outline"
              >
                {fetchingWalletInfo ? (
                  <>
                    <div className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    {t("admin.withdrawals.fetching")}
                  </>
                ) : (
                  <>
                    <ExternalLink className="mr-2 h-4 w-4" />
                    {t("admin.withdrawals.getFromWalletAPI")}
                  </>
                )}
              </Button>
              
              <Button
                onClick={() => handleFetchCPAYWalletInfo('deposit')}
                disabled={fetchingWalletInfo}
                variant="default"
              >
                {fetchingWalletInfo ? (
                  <>
                    <div className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    {t("admin.withdrawals.fetching")}
                  </>
                ) : (
                  <>
                    <DollarSign className="mr-2 h-4 w-4" />
                    {t("admin.withdrawals.useTokenFromLastDeposit")}
                  </>
                )}
              </Button>

              <Button
                onClick={handleFetchCPAYWalletBalance}
                disabled={fetchingBalance}
                variant="outline"
              >
                {fetchingBalance ? (
                  <>
                    <div className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    {t("admin.withdrawals.fetching")}
                  </>
                ) : (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    {t("admin.withdrawals.checkWalletBalance")}
                  </>
                )}
              </Button>
            </div>
            
            <div className="text-sm text-muted-foreground space-y-1">
              <p><strong>Wallet API:</strong> {t("admin.withdrawals.walletAPIDescription")}</p>
              <p><strong>Last Deposit:</strong> {t("admin.withdrawals.lastDepositDescription")}</p>
              <p><strong>Check Balance:</strong> {t("admin.withdrawals.checkBalanceDescription")}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList>
          <TabsTrigger value="pending">{t("admin.withdrawals.tabs.pending")} ({stats.pending})</TabsTrigger>
          <TabsTrigger value="completed">{t("admin.withdrawals.tabs.completed")}</TabsTrigger>
          <TabsTrigger value="rejected">{t("admin.withdrawals.tabs.rejected")}</TabsTrigger>
          <TabsTrigger value="all">{t("admin.withdrawals.tabs.all")}</TabsTrigger>
        </TabsList>

        <TabsContent value={selectedTab} className="mt-6">
          <div className="space-y-4">
            {filteredWithdrawals.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  {t("admin.withdrawals.noWithdrawalsFound")}
                </CardContent>
              </Card>
            ) : (
              filteredWithdrawals.map((withdrawal) => (
                <Card key={withdrawal.id}>
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-lg">
                          {withdrawal.profiles?.username || t("admin.withdrawals.unknownUser")}
                        </CardTitle>
                        <CardDescription>{withdrawal.profiles?.email}</CardDescription>
                      </div>
                      {getStatusBadge(withdrawal.status)}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <p className="text-sm text-muted-foreground">{t("admin.withdrawals.membershipPlan")}</p>
                        <Badge variant="outline" className="mt-1">
                          {withdrawal.profiles?.membership_plan ?? '—'}
                        </Badge>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">{t("admin.withdrawals.country")}</p>
                        <Badge variant="outline" className="mt-1">
                          {withdrawal.profiles?.registration_country_name || t("admin.deposits.na")}
                        </Badge>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">{t("admin.withdrawals.amount")}</p>
                        <p className="text-lg font-semibold">{formatCurrency(withdrawal.amount)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">{t("admin.withdrawals.netAmount")}</p>
                        <p className="text-lg font-semibold text-green-600">
                          {formatCurrency(withdrawal.net_amount)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {t("admin.withdrawals.fee")}: {formatCurrency(withdrawal.fee)}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">{t("admin.withdrawals.paymentMethod")}</p>
                        <p className="font-medium">
                          {getPaymentMethodDisplayName(withdrawal.payment_method, true)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {t("admin.withdrawals.raw")}: {withdrawal.payment_method}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">{t("admin.withdrawals.cryptocurrency")}</p>
                        {withdrawal.metadata?.crypto_name ? (
                          <>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge 
                                variant="default" 
                                className={
                                  withdrawal.metadata.crypto_id === 'usdc-solana' 
                                    ? 'bg-blue-600 hover:bg-blue-700' 
                                    : 'bg-amber-600 hover:bg-amber-700'
                                }
                              >
                                {withdrawal.metadata.crypto_name}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                              {t("admin.withdrawals.network")}: {withdrawal.metadata.crypto_id === 'usdc-solana' ? 'Solana' : 'BEP-20 (BSC)'}
                            </p>
                          </>
                        ) : (
                          <Badge variant="outline" className="mt-1 text-muted-foreground">
                            {t("admin.withdrawals.notSpecifiedLegacy")}
                          </Badge>
                        )}
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">{t("admin.withdrawals.payoutAddress")}</p>
                        <p className="font-mono text-sm">{withdrawal.payout_address}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">{t("admin.withdrawals.requested")}</p>
                        <p className="text-sm">{new Date(withdrawal.created_at).toLocaleString()}</p>
                      </div>
                      {withdrawal.processed_at && (
                        <div>
                          <p className="text-sm text-muted-foreground">{t("admin.withdrawals.processed")}</p>
                          <p className="text-sm">{new Date(withdrawal.processed_at).toLocaleString()}</p>
                        </div>
                      )}
                      {withdrawal.rejection_reason && (
                        <div className="md:col-span-2">
                          <p className="text-sm text-muted-foreground">{t("admin.withdrawals.rejectionReason")}</p>
                          <p className="text-sm text-red-600">{withdrawal.rejection_reason}</p>
                        </div>
                      )}
                      {withdrawal.admin_notes && (
                        <div className="md:col-span-2">
                          <p className="text-sm text-muted-foreground">{t("admin.withdrawals.adminNotes")}</p>
                          <p className="text-sm">{withdrawal.admin_notes}</p>
                        </div>
                      )}
                      {withdrawal.manual_txn_hash && (
                        <div className="md:col-span-2">
                          <p className="text-sm text-muted-foreground">Transaction Hash</p>
                          <div className="flex items-center gap-2">
                            <code className="text-sm bg-muted px-2 py-1 rounded">{withdrawal.manual_txn_hash}</code>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => copyToClipboard(withdrawal.manual_txn_hash!)}
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => window.open(`https://tronscan.org/#/transaction/${withdrawal.manual_txn_hash}`, '_blank')}
                            >
                              <ExternalLink className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>

                    {withdrawal.status === "failed" && (withdrawal as any).api_response?.error && (
                      <Alert variant="destructive" className="mt-4">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>{t("admin.withdrawals.apiPaymentFailed")}</AlertTitle>
                        <AlertDescription>
                          {(withdrawal as any).api_response.error}
                        </AlertDescription>
                      </Alert>
                    )}

                    {withdrawal.status === "pending" && withdrawal.api_response?.error && (
                      <Alert variant="destructive" className="mt-4">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>{t("admin.withdrawals.previousAPIAttemptFailed")}</AlertTitle>
                        <AlertDescription className="space-y-2">
                          <div>
                            <strong>{t("admin.withdrawals.provider")}</strong> {withdrawal.api_response.provider?.toUpperCase() || withdrawal.payment_provider?.toUpperCase() || t("admin.withdrawals.unknown")}
                          </div>
                          <div>
                            <strong>{t("admin.withdrawals.error")}</strong> {withdrawal.api_response.error}
                          </div>
                          {withdrawal.api_response.failed_at && (
                            <div className="text-xs text-muted-foreground">
                              {t("admin.withdrawals.lastAttempt")} {new Date(withdrawal.api_response.failed_at).toLocaleString()}
                            </div>
                          )}
                          <div className="text-xs mt-2 pt-2 border-t border-destructive/20">
                            {t("admin.withdrawals.nextStepsHint")} <strong>{t("admin.withdrawals.nextStepsText", { provider: withdrawal.api_response.provider?.toUpperCase() || t("admin.withdrawals.unknown") })}</strong>
                          </div>
                        </AlertDescription>
                      </Alert>
                    )}

                    {withdrawal.status === "pending" && (
                      <div className="flex gap-2 mt-4">
                        <Button
                          onClick={() => handleMarkAsPaidManually(withdrawal.id)}
                          disabled={processing !== null}
                          variant="outline"
                          className="flex-1"
                        >
                          {processing === withdrawal.id && actionType === 'manual' ? (
                            <>
                              <div className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-current border-t-transparent" />
                              {t("admin.withdrawals.processing")}
                            </>
                          ) : (
                            <>
                              <CheckCircle className="mr-2 h-4 w-4" />
                              {t("admin.withdrawals.markAsPaidManually")}
                            </>
                          )}
                        </Button>

                        {/* Show Clear Error & Retry button if API error exists, otherwise show regular Pay Via API */}
                        {(withdrawal as any).api_response?.error ? (
                          <Button
                            onClick={() => handleClearErrorAndRetry(withdrawal.id)}
                            disabled={processing !== null}
                            className="flex-1 bg-orange-600 hover:bg-orange-700"
                            title="Clear previous API error and retry payment"
                          >
                            {processing === withdrawal.id && actionType === 'api' ? (
                              <>
                                <div className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-current border-t-transparent" />
                                {t("common.retrying")}
                              </>
                            ) : (
                              <>
                                <RefreshCw className="mr-2 h-4 w-4" />
                                {t("admin.withdrawals.clearErrorAndRetry")}
                              </>
                            )}
                          </Button>
                        ) : (
                          <Button
                            onClick={() => handlePayViaAPI(withdrawal.id)}
                            disabled={processing !== null}
                            className="flex-1 bg-green-600 hover:bg-green-700"
                          >
                            {processing === withdrawal.id && actionType === 'api' ? (
                              <>
                                <div className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-current border-t-transparent" />
                                {t("admin.withdrawals.processing")}
                              </>
                            ) : (
                              <>
                                <DollarSign className="mr-2 h-4 w-4" />
                                {t("admin.withdrawals.approveAndPayViaAPI")}
                              </>
                            )}
                          </Button>
                        )}

                        <Button
                          onClick={() => openRejectDialog(withdrawal.id)}
                          disabled={processing !== null}
                          variant="destructive"
                          className="flex-1"
                        >
                          {processing === withdrawal.id && actionType === 'reject' ? (
                            <>
                              <div className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-current border-t-transparent" />
                              {t("admin.withdrawals.processing")}
                            </>
                          ) : (
                            <>
                              <XCircle className="mr-2 h-4 w-4" />
                              {t("admin.withdrawals.reject")}
                            </>
                          )}
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>

      <AlertDialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("admin.withdrawals.rejectWithdrawal")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("admin.withdrawals.rejectWithdrawalDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="py-4">
            <label className="text-sm font-medium">{t("admin.withdrawals.rejectionReasonRequired")}</label>
            <Textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder={t("admin.withdrawals.rejectionReasonPlaceholder")}
              className="mt-2"
              rows={4}
              disabled={processing !== null}
            />
            <p className="text-xs text-muted-foreground mt-1">
              {rejectionReason.length}/10 {t("admin.withdrawals.charactersMinimum")}
            </p>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={processing !== null}>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleReject}
              disabled={processing !== null || !rejectionReason.trim() || rejectionReason.length < 10}
            >
              {processing ? (
                <>
                  <div className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  {t("admin.withdrawals.rejecting")}
                </>
              ) : (
                t("admin.withdrawals.rejectAndRefund")
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* CPAY Wallet Balance Dialog */}
      <AlertDialog open={showBalanceDialog} onOpenChange={setShowBalanceDialog}>
        <AlertDialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-green-600" />
              {t("admin.withdrawals.cpayWalletBalance")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("admin.withdrawals.cpayWalletBalanceDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>

          {walletBalance && (
            <div className="space-y-6 py-4">
              {/* Wallet Overview */}
              <div className="grid gap-4 md:grid-cols-3">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-muted-foreground">{t("admin.withdrawals.totalBalance")}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{walletBalance.wallet?.balance || '0.00'}</div>
                    <p className="text-xs text-muted-foreground mt-1">
                      ${walletBalance.wallet?.balanceUSD || '0.00'} USD
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-muted-foreground">{t("admin.withdrawals.availableBalance")}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-green-600">
                      {walletBalance.wallet?.availableBalance || '0.00'}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      ${walletBalance.wallet?.availableBalanceUSD || '0.00'} USD
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-muted-foreground">{t("admin.withdrawals.holdBalance")}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-yellow-600">
                      {walletBalance.wallet?.holdBalance || '0.00'}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {t("admin.withdrawals.pendingTransactions")}
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* USDT TRC20 Highlight */}
              {walletBalance.usdtTrc20 && (
                <Alert className="border-green-300 bg-green-50">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <AlertTitle className="text-green-800">{t("admin.withdrawals.usdtTrc20Found")}</AlertTitle>
                  <AlertDescription className="mt-2">
                    <div className="space-y-3">
                      <div className="font-mono text-sm bg-muted p-3 rounded border border-green-200/20">
                        <div className="flex items-center justify-between">
                          <div>
                            <strong className="text-green-700">currencyId:</strong>
                            <code className="ml-2 text-lg font-bold text-green-700">
                              {walletBalance.usdtTrc20.currencyId}
                            </code>
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              navigator.clipboard.writeText(walletBalance.usdtTrc20.currencyId);
                              toast({ 
                                title: t("common.copied"), 
                                description: t("admin.withdrawals.currencyIdCopied")
                              });
                            }}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <strong>{t("admin.withdrawals.name")}:</strong> {walletBalance.usdtTrc20.name}
                        </div>
                        <div>
                          <strong>{t("admin.withdrawals.network")}:</strong> {walletBalance.usdtTrc20.nodeType}
                        </div>
                        <div>
                          <strong>{t("admin.withdrawals.type")}:</strong> {walletBalance.usdtTrc20.currencyType}
                        </div>
                        <div>
                          <strong>{t("admin.withdrawals.balance")}:</strong> {walletBalance.usdtTrc20.balance}
                        </div>
                      </div>
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              {/* All Tokens Table */}
              {walletBalance.tokens && walletBalance.tokens.length > 0 ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold">{t("admin.withdrawals.allTokens")} ({walletBalance.tokens.length})</h4>
                    {!walletBalance.usdtTrc20 && (
                      <Badge variant="destructive">
                        <AlertCircle className="h-3 w-3 mr-1" />
                        {t("admin.withdrawals.usdtTrc20NotFound")}
                      </Badge>
                    )}
                  </div>

                  <div className="border rounded-lg overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-muted">
                          <tr>
                            <th className="px-4 py-3 text-left font-medium">{t("admin.withdrawals.currencyId")}</th>
                            <th className="px-4 py-3 text-left font-medium">{t("admin.withdrawals.name")}</th>
                            <th className="px-4 py-3 text-left font-medium">{t("admin.withdrawals.network")}</th>
                            <th className="px-4 py-3 text-left font-medium">{t("admin.withdrawals.type")}</th>
                            <th className="px-4 py-3 text-right font-medium">{t("admin.withdrawals.balance")}</th>
                            <th className="px-4 py-3 text-right font-medium">{t("admin.withdrawals.actions")}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {walletBalance.tokens.map((token: any, idx: number) => (
                            <tr 
                              key={idx}
                              className={token.isUsdtTrc20 ? 'bg-green-50' : 'hover:bg-muted/50'}
                            >
                              <td className="px-4 py-3">
                                <code className={`text-xs ${token.isUsdtTrc20 ? 'text-green-700 font-bold' : 'text-muted-foreground'}`}>
                                  {token.currencyId.substring(0, 12)}...
                                </code>
                              </td>
                              <td className="px-4 py-3 font-medium">
                                {token.name}
                                {token.isUsdtTrc20 && (
                                  <Badge variant="default" className="ml-2 text-xs">
                                    {t("admin.withdrawals.recommended")}
                                  </Badge>
                                )}
                              </td>
                              <td className="px-4 py-3 text-muted-foreground">
                                {token.nodeType}
                              </td>
                              <td className="px-4 py-3 text-muted-foreground">
                                {token.currencyType}
                              </td>
                              <td className="px-4 py-3 text-right font-mono">
                                {token.balance}
                              </td>
                              <td className="px-4 py-3 text-right">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => {
                                    navigator.clipboard.writeText(token.currencyId);
                                    toast({ 
                                      title: t("common.copied"), 
                                      description: t("admin.withdrawals.tokenCopied", { name: token.name })
                                    });
                                  }}
                                >
                                  <Copy className="h-3 w-3" />
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              ) : (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>{t("admin.withdrawals.noTokensFound")}</AlertTitle>
                  <AlertDescription>
                    {t("admin.withdrawals.noTokensFoundDescription")}
                  </AlertDescription>
                </Alert>
              )}

              {/* Tips Section */}
              {walletBalance.tips && (
                <div className="border rounded-lg p-4 bg-blue-50">
                  <h4 className="font-semibold mb-2 flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-blue-600" />
                    {t("admin.withdrawals.tips")}
                  </h4>
                  <ul className="text-sm space-y-1 list-disc list-inside text-muted-foreground">
                    {walletBalance.tips.map((tip: string, idx: number) => (
                      <li key={idx}>{tip}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Next Steps */}
              <div className="border-t pt-4">
                <h4 className="font-semibold mb-2">{t("admin.withdrawals.nextSteps")}</h4>
                <ol className="text-sm space-y-2 list-decimal list-inside">
                  <li>{t("admin.withdrawals.nextStep1")}</li>
                  <li>{t("admin.withdrawals.nextStep2")}</li>
                  <li>{t("admin.withdrawals.nextStep3")}</li>
                  <li>{t("admin.withdrawals.nextStep4")}</li>
                </ol>
              </div>
            </div>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.close")}</AlertDialogCancel>
            {walletBalance?.usdtTrc20 && (
              <AlertDialogAction
                onClick={() => {
                  navigator.clipboard.writeText(walletBalance.usdtTrc20.currencyId);
                  toast({
                    title: t("common.copied"),
                    description: t("admin.withdrawals.currencyIdCopied"),
                  });
                }}
              >
                <Copy className="mr-2 h-4 w-4" />
                {t("admin.withdrawals.copyUsdtTrc20Id")}
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* CPAY Wallet Info Dialog */}
      <AlertDialog open={showWalletInfoDialog} onOpenChange={setShowWalletInfoDialog}>
        <AlertDialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <AlertDialogHeader>
            <AlertDialogTitle>{t("admin.withdrawals.cpayTokenInformation")}</AlertDialogTitle>
            <AlertDialogDescription>
              {walletInfo?.source === 'last_deposit' 
                ? t("admin.withdrawals.tokenFromLastDeposit")
                : t("admin.withdrawals.tokensFromWallet")
              }
            </AlertDialogDescription>
          </AlertDialogHeader>

          {walletInfo && (
            <div className="space-y-4 py-4">
              {/* Source Badge */}
              <div className="flex items-center gap-2">
                <Badge variant={walletInfo.source === 'last_deposit' ? 'default' : 'secondary'}>
                  {walletInfo.source === 'last_deposit' ? t("admin.withdrawals.fromLastDeposit") : t("admin.withdrawals.fromWalletAPI")}
                </Badge>
                {walletInfo.depositDate && (
                  <span className="text-xs text-muted-foreground">
                    {t("admin.withdrawals.deposit")} {new Date(walletInfo.depositDate).toLocaleString()}
                  </span>
                )}
              </div>

              {/* Token Info - show success only when we actually have a tokenId */}
              {(walletInfo.usdtTrc20Token?.currencyId || walletInfo.token?.currencyId) ? (
                <Alert className="border-green-200 bg-green-50">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <AlertTitle>{t("admin.withdrawals.usdtTrc20TokenFound")}</AlertTitle>
                  <AlertDescription className="mt-2 space-y-2">
                    <div className="font-mono text-sm bg-muted p-3 rounded border border-border">
                      <strong>{t("admin.withdrawals.tokenId")}</strong><br/>
                      <code className="text-green-700 font-bold text-base">
                        {walletInfo.usdtTrc20Token?.currencyId || walletInfo.token?.currencyId}
                      </code>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          const tokenId = walletInfo.usdtTrc20Token?.currencyId || walletInfo.token?.currencyId;
                          if (tokenId) {
                            navigator.clipboard.writeText(tokenId);
                            toast({ title: t("common.copied"), description: t("admin.withdrawals.tokenIdCopied") });
                          }
                        }}
                        className="ml-2"
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                    <div className="text-xs space-y-1">
                      <div><strong>{t("admin.withdrawals.name")}:</strong> {walletInfo.usdtTrc20Token?.name || walletInfo.token?.currency || walletInfo.token?.name}</div>
                      <div><strong>{t("admin.withdrawals.network")}:</strong> {walletInfo.usdtTrc20Token?.nodeType || walletInfo.usdtTrc20Token?.blockchain || walletInfo.token?.blockchain}</div>
                      <div><strong>{t("admin.withdrawals.type")}:</strong> {walletInfo.usdtTrc20Token?.currencyType || 'token'}</div>
                    </div>
                  </AlertDescription>
                </Alert>
              ) : (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>{walletInfo.source === 'last_deposit' ? t("admin.withdrawals.tokenNotFound") : t("admin.withdrawals.usdtTrc20NotFoundTitle")}</AlertTitle>
                  <AlertDescription>
                    {walletInfo.error || (walletInfo.totalTokens === 0
                      ? t("admin.withdrawals.tokenNotFoundDescription")
                      : t("admin.withdrawals.couldNotFindUsdt"))}
                    {walletInfo.suggestion && (
                      <div className="mt-2 text-xs">💡 {walletInfo.suggestion}</div>
                    )}
                  </AlertDescription>
                </Alert>
              )}

              {/* Instructions */}
              <div className="border-t pt-4">
                <h4 className="font-semibold mb-2">{t("admin.withdrawals.nextSteps")}</h4>
                <ol className="text-sm space-y-2 list-decimal list-inside">
                  <li>{t("admin.withdrawals.nextStep1Short")}</li>
                  <li>{t("admin.withdrawals.nextStep2Short")}</li>
                  <li>{t("admin.withdrawals.nextStep3Short")}</li>
                </ol>
              </div>

              {/* All Currencies (Collapsible) - show for wallet/currency mode */}
              {(walletInfo.allCurrencies || walletInfo.allTokens) && (walletInfo.allCurrencies?.length > 0 || walletInfo.allTokens?.length > 0) && (
                <details className="border rounded p-3">
                  <summary className="cursor-pointer font-semibold text-sm">
                    {t("admin.withdrawals.allAvailableCurrencies")} ({walletInfo.allCurrencies?.length || walletInfo.allTokens?.length})
                  </summary>
                  <div className="mt-3 space-y-2 max-h-60 overflow-y-auto">
                    {(walletInfo.allCurrencies || walletInfo.allTokens)?.map((item: any, idx: number) => (
                      <div key={idx} className="text-xs bg-muted p-2 rounded font-mono">
                        <div><strong>currencyId:</strong> {item.currencyId}</div>
                        <div><strong>{t("admin.withdrawals.name")}:</strong> {item.name || item.currency}</div>
                        <div><strong>{t("admin.withdrawals.network")}:</strong> {item.nodeType || item.blockchain || 'N/A'}</div>
                        {item.currencyType && <div><strong>{t("admin.withdrawals.type")}:</strong> {item.currencyType}</div>}
                        {item.isUsdtTrc20 && <Badge variant="default" className="mt-1">← {t("admin.withdrawals.recommended")} for USDT TRC20</Badge>}
                      </div>
                    ))}
                  </div>
                </details>
              )}

              {/* Deposit Info (for deposit mode) */}
              {walletInfo.depositInfo && (
                <details className="border rounded p-3">
                  <summary className="cursor-pointer font-semibold text-sm">
                    {t("admin.withdrawals.depositDetails")}
                  </summary>
                  <div className="mt-3 text-xs space-y-1 bg-muted p-3 rounded">
                    <div><strong>{t("admin.withdrawals.walletId")}</strong> {walletInfo.depositInfo.wallet}</div>
                    <div><strong>{t("admin.withdrawals.currency")}</strong> {walletInfo.depositInfo.currency}</div>
                    <div><strong>{t("admin.withdrawals.blockchain")}</strong> {walletInfo.depositInfo.blockchain}</div>
                  </div>
                </details>
              )}
            </div>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.close")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const tokenId = walletInfo?.usdtTrc20Token?.currencyId || walletInfo?.token?.currencyId;
                if (tokenId) {
                  navigator.clipboard.writeText(tokenId);
                  toast({
                    title: t("common.copied"),
                    description: t("admin.withdrawals.tokenIdCopied"),
                  });
                }
              }}
              disabled={!walletInfo?.usdtTrc20Token?.currencyId && !walletInfo?.token?.currencyId}
            >
              <Copy className="mr-2 h-4 w-4" />
              {t("admin.withdrawals.copyTokenId")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      </div>
    </div>
  );
}
