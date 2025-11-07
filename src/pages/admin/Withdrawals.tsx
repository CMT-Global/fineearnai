import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
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
  api_response?: {
    error?: string;
    details?: string;
    provider?: string;
    failed_at?: string;
  };
  profiles?: {
    username: string;
    email: string;
    membership_plan: string | null;
    registration_country_name: string | null;
  };
  referrals?: Array<{
    referrer: {
      username: string;
    } | null;
  }>;
}

export default function Withdrawals() {
  const navigate = useNavigate();
  const { toast } = useToast();
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
        title: "Access Denied",
        description: "Admin access required",
        variant: "destructive",
      });
    }
  };


  const loadWithdrawals = async () => {
    try {
      setLoading(true);
      
      // Single optimized query with join - eliminates N+1 problem
      // Using the foreign key relationship added in migration
      const { data, error } = await supabase
        .from("withdrawal_requests")
        .select(`
          *,
          profiles:user_id (
            username,
            email,
            membership_plan,
            registration_country_name
          ),
          referrals!referrals_referred_id_fkey (
            referrer:referrer_id (
              username
            )
          )
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Type assertion since TypeScript types haven't regenerated yet
      setWithdrawals((data as any) || []);
    } catch (error) {
      console.error("Error loading withdrawals:", error);
      toast({
        title: "Error",
        description: "Failed to load withdrawal requests",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsPaidManually = async (withdrawalId: string) => {
    if (processing) {
      toast({
        title: "Please Wait",
        description: "Another withdrawal is being processed",
        variant: "destructive",
      });
      return;
    }

    const notes = prompt("Add notes (optional):");
    
    try {
      setProcessing(withdrawalId);
      setActionType('manual');
      
      const { data, error } = await supabase.functions.invoke("process-withdrawal-payment", {
        body: {
          withdrawal_request_id: withdrawalId,
          action: "mark_paid_manually",
          manual_payment_notes: notes || "Marked as paid manually by admin"
        }
      });
      
      if (error) throw error;

      if (data?.success) {
        toast({
          title: "Success",
          description: `Withdrawal marked as paid. Transaction hash: ${data.transaction_hash || 'N/A'}`
        });
      } else {
        toast({
          title: "Error",
          description: data?.error || "Failed to mark withdrawal as paid",
          variant: "destructive",
        });
      }
      
      await loadWithdrawals();
    } catch (error) {
      console.error("Error marking withdrawal as paid:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to mark withdrawal as paid",
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
        title: "Error",
        description: "Withdrawal not found",
        variant: "destructive",
      });
      return;
    }

    if (!confirm("Clear previous API error and retry payment?")) return;
    
    try {
      setProcessing(withdrawalId);
      setActionType('api');

      toast({
        title: "Clearing Error",
        description: "Clearing previous API error and retrying payment...",
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
          title: "⚠️ API Payment Failed Again",
          description: `${data.error_message || 'API call failed'}. Withdrawal remains PENDING - please check ${data.provider?.toUpperCase() || 'provider'} configuration and balance.`,
          variant: "destructive",
          duration: 10000,
        });
      } 
      else if (!data.success) {
        toast({
          title: "Error",
          description: data.error || data.error_message || "Failed to process payment",
          variant: "destructive",
        });
      } 
      else {
        toast({
          title: "✅ Payment Sent Successfully",
          description: data.transaction_hash 
            ? `Provider: ${data.provider?.toUpperCase() || 'Unknown'}. Transaction: ${data.transaction_hash.substring(0, 20)}...`
            : "Payment processed successfully via API after clearing error",
          duration: 6000,
        });
      }
      
      await loadWithdrawals();
    } catch (error) {
      console.error("Error clearing error and retrying:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to clear error and retry",
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
        title: "Please Wait",
        description: "Another withdrawal is being processed",
        variant: "destructive",
      });
      return;
    }

    if (!confirm("Process this withdrawal via payment API?")) return;
    
    try {
      setProcessing(withdrawalId);
      setActionType('api');

      toast({
        title: "Processing",
        description: "Sending payment request to API...",
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
          title: "⚠️ API Payment Failed",
          description: `${data.error_message || 'API call failed'}. Withdrawal remains PENDING - you can retry after fixing the issue (e.g., topping up ${data.provider?.toUpperCase() || 'provider'} balance) or reject it manually.`,
          variant: "destructive",
          duration: 10000, // Longer duration for important admin message
        });
      } 
      // Check for general errors (should not happen with new logic, but kept for safety)
      else if (!data.success) {
        toast({
          title: "Error",
          description: data.error || data.error_message || "Failed to process payment",
          variant: "destructive",
        });
      } 
      // Success - payment sent
      else {
        toast({
          title: "✅ Payment Sent Successfully",
          description: data.transaction_hash 
            ? `Provider: ${data.provider?.toUpperCase() || 'Unknown'}. Transaction: ${data.transaction_hash.substring(0, 20)}...`
            : "Payment processed successfully via API",
          duration: 6000,
        });
      }
      
      await loadWithdrawals();
    } catch (error) {
      console.error("Error processing API payment:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to process payment",
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
        title: "Error",
        description: "Rejection reason is required",
        variant: "destructive",
      });
      return;
    }

    if (rejectionReason.length < 10) {
      toast({
        title: "Error",
        description: "Please provide a detailed reason (at least 10 characters)",
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
          title: "Success",
          description: `Withdrawal rejected. Amount ${data.refunded_amount ? formatCurrency(data.refunded_amount) : ''} refunded to user's earnings wallet`
        });
      } else {
        toast({
          title: "Error",
          description: data?.error || "Failed to reject withdrawal",
          variant: "destructive",
        });
      }
      
      await loadWithdrawals();
    } catch (error) {
      console.error("Error rejecting withdrawal:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to reject withdrawal",
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
      title: "Copied",
      description: "Address copied to clipboard",
    });
  };

  const handleFetchCPAYWalletInfo = async (mode: 'wallet' | 'deposit' = 'wallet') => {
    try {
      setFetchingWalletInfo(true);
      const modeLabel = mode === 'deposit' ? 'last deposit' : 'wallet API';
      toast({
        title: "Fetching Token Info",
        description: `Retrieving CPAY token from ${modeLabel}...`,
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
            title: "✅ Token ID Found",
            description: `Source: ${data.source || mode}. currencyId: ${tokenId}`,
            duration: 10000,
          });
        }
      } else {
        toast({
          title: "Error",
          description: data.error || "Failed to fetch token info",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error fetching CPAY token info:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to fetch token info",
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
          title: "Error",
          description: error.message || "Failed to fetch wallet balance",
          variant: "destructive",
        });
        return;
      }

      if (!data?.success) {
        console.error('[Withdrawals] API returned error:', data);
        toast({
          title: "CPAY Error",
          description: data?.error || "Failed to fetch wallet balance from CPAY",
          variant: "destructive",
        });
        return;
      }

      console.log('[Withdrawals] Wallet balance retrieved:', data);
      setWalletBalance(data);
      setShowBalanceDialog(true);

      toast({
        title: "Success",
        description: "Wallet balance retrieved successfully",
      });
    } catch (err: any) {
      console.error('[Withdrawals] Unexpected error:', err);
      toast({
        title: "Error",
        description: err.message || "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setFetchingBalance(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
      pending: { label: "Pending", variant: "secondary" },
      processing: { label: "Processing", variant: "default" },
      completed: { label: "Completed", variant: "default" },
      rejected: { label: "Rejected", variant: "destructive" },
      failed: { label: "Failed", variant: "destructive" },
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
    return (
      <div className="container mx-auto p-6">
        <p>Loading withdrawals...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Withdrawal Management</h1>
        <p className="text-muted-foreground">Process and manage user withdrawal requests</p>
      </div>


      <div className="grid gap-4 md:grid-cols-3 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Pending Requests</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pending}</div>
            <p className="text-xs text-muted-foreground">
              {formatCurrency(stats.pendingAmount)} total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.completed}</div>
            <p className="text-xs text-muted-foreground">Successfully processed</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Rejected</CardTitle>
            <XCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.rejected}</div>
            <p className="text-xs text-muted-foreground">Failed or rejected</p>
          </CardContent>
        </Card>
      </div>

      {/* CPAY Configuration Diagnostic Section */}
      <Card className="mb-6 border-blue-200 bg-blue-50/50">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-blue-600" />
            CPAY Token ID Helper
          </CardTitle>
          <CardDescription>
            Get your correct USDT TRC20 Token ID from CPAY - choose your preferred method
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center gap-3 flex-wrap">
              <Button
                onClick={() => handleFetchCPAYWalletInfo('wallet')}
                disabled={fetchingWalletInfo}
                variant="outline"
                className="border-blue-300 hover:bg-blue-100"
              >
                {fetchingWalletInfo ? (
                  <>
                    <div className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    Fetching...
                  </>
                ) : (
                  <>
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Get From Wallet API
                  </>
                )}
              </Button>
              
              <Button
                onClick={() => handleFetchCPAYWalletInfo('deposit')}
                disabled={fetchingWalletInfo}
                variant="outline"
                className="border-green-300 hover:bg-green-100"
              >
                {fetchingWalletInfo ? (
                  <>
                    <div className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    Fetching...
                  </>
                ) : (
                  <>
                    <DollarSign className="mr-2 h-4 w-4" />
                    Use Token From Last Deposit
                  </>
                )}
              </Button>

              <Button
                onClick={handleFetchCPAYWalletBalance}
                disabled={fetchingBalance}
                variant="outline"
                className="border-purple-300 hover:bg-purple-100"
              >
                {fetchingBalance ? (
                  <>
                    <div className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    Fetching...
                  </>
                ) : (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Check Wallet Balance
                  </>
                )}
              </Button>
            </div>
            
            <div className="text-sm text-muted-foreground space-y-1">
              <p><strong>Wallet API:</strong> Fetches all tokens from your CPAY wallet</p>
              <p><strong>Last Deposit:</strong> Extracts token ID from your most recent CPAY deposit (recommended if you've deposited)</p>
              <p><strong>Check Balance:</strong> View your wallet balance and all token details with USDT TRC20 highlighted</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList>
          <TabsTrigger value="pending">Pending ({stats.pending})</TabsTrigger>
          <TabsTrigger value="completed">Completed</TabsTrigger>
          <TabsTrigger value="rejected">Rejected</TabsTrigger>
          <TabsTrigger value="all">All</TabsTrigger>
        </TabsList>

        <TabsContent value={selectedTab} className="mt-6">
          <div className="space-y-4">
            {filteredWithdrawals.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  No withdrawal requests found
                </CardContent>
              </Card>
            ) : (
              filteredWithdrawals.map((withdrawal) => (
                <Card key={withdrawal.id}>
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-lg">
                          {withdrawal.profiles?.username || "Unknown User"}
                        </CardTitle>
                        <CardDescription>{withdrawal.profiles?.email}</CardDescription>
                      </div>
                      {getStatusBadge(withdrawal.status)}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <p className="text-sm text-muted-foreground">Amount</p>
                        <p className="text-lg font-semibold">{formatCurrency(withdrawal.amount)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Net Amount (after fee)</p>
                        <p className="text-lg font-semibold text-green-600">
                          {formatCurrency(withdrawal.net_amount)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Fee: {formatCurrency(withdrawal.fee)}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Payment Method</p>
                        <p className="font-medium">
                          {getPaymentMethodDisplayName(withdrawal.payment_method, true)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Raw: {withdrawal.payment_method}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Payout Address</p>
                        <p className="font-mono text-sm">{withdrawal.payout_address}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Requested</p>
                        <p className="text-sm">{new Date(withdrawal.created_at).toLocaleString()}</p>
                      </div>
                      {withdrawal.processed_at && (
                        <div>
                          <p className="text-sm text-muted-foreground">Processed</p>
                          <p className="text-sm">{new Date(withdrawal.processed_at).toLocaleString()}</p>
                        </div>
                      )}
                      {withdrawal.rejection_reason && (
                        <div className="md:col-span-2">
                          <p className="text-sm text-muted-foreground">Rejection Reason</p>
                          <p className="text-sm text-red-600">{withdrawal.rejection_reason}</p>
                        </div>
                      )}
                      {withdrawal.admin_notes && (
                        <div className="md:col-span-2">
                          <p className="text-sm text-muted-foreground">Admin Notes</p>
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
                        <AlertTitle>API Payment Failed</AlertTitle>
                        <AlertDescription>
                          {(withdrawal as any).api_response.error}
                        </AlertDescription>
                      </Alert>
                    )}

                    {withdrawal.status === "pending" && withdrawal.api_response?.error && (
                      <Alert variant="destructive" className="mt-4">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>Previous API Attempt Failed</AlertTitle>
                        <AlertDescription className="space-y-2">
                          <div>
                            <strong>Provider:</strong> {withdrawal.api_response.provider?.toUpperCase() || withdrawal.payment_provider?.toUpperCase() || 'Unknown'}
                          </div>
                          <div>
                            <strong>Error:</strong> {withdrawal.api_response.error}
                          </div>
                          {withdrawal.api_response.failed_at && (
                            <div className="text-xs text-muted-foreground">
                              Last attempt: {new Date(withdrawal.api_response.failed_at).toLocaleString()}
                            </div>
                          )}
                          <div className="text-xs mt-2 pt-2 border-t border-destructive/20">
                            💡 <strong>Next steps:</strong> Check {withdrawal.api_response.provider?.toUpperCase() || 'provider'} credentials/balance, then click "Clear Error & Retry" or manually reject if needed.
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
                              Processing...
                            </>
                          ) : (
                            <>
                              <CheckCircle className="mr-2 h-4 w-4" />
                              Mark As Paid Manually
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
                                Retrying...
                              </>
                            ) : (
                              <>
                                <RefreshCw className="mr-2 h-4 w-4" />
                                Clear Error & Retry
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
                                Processing...
                              </>
                            ) : (
                              <>
                                <DollarSign className="mr-2 h-4 w-4" />
                                Approve & Pay Via API
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
                              Processing...
                            </>
                          ) : (
                            <>
                              <XCircle className="mr-2 h-4 w-4" />
                              Reject
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
            <AlertDialogTitle>Reject Withdrawal</AlertDialogTitle>
            <AlertDialogDescription>
              This will reject the withdrawal and refund the amount to the user's earnings wallet.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="py-4">
            <label className="text-sm font-medium">Rejection Reason *</label>
            <Textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Enter detailed reason for rejection (minimum 10 characters)..."
              className="mt-2"
              rows={4}
              disabled={processing !== null}
            />
            <p className="text-xs text-muted-foreground mt-1">
              {rejectionReason.length}/10 characters minimum
            </p>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={processing !== null}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleReject}
              disabled={processing !== null || !rejectionReason.trim() || rejectionReason.length < 10}
            >
              {processing ? (
                <>
                  <div className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Rejecting...
                </>
              ) : (
                "Reject & Refund"
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
              CPAY Wallet Balance & Tokens
            </AlertDialogTitle>
            <AlertDialogDescription>
              Complete overview of your CPAY wallet including all tokens and their details
            </AlertDialogDescription>
          </AlertDialogHeader>

          {walletBalance && (
            <div className="space-y-6 py-4">
              {/* Wallet Overview */}
              <div className="grid gap-4 md:grid-cols-3">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Total Balance</CardTitle>
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
                    <CardTitle className="text-sm font-medium text-muted-foreground">Available Balance</CardTitle>
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
                    <CardTitle className="text-sm font-medium text-muted-foreground">Hold Balance</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-yellow-600">
                      {walletBalance.wallet?.holdBalance || '0.00'}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Pending transactions
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* USDT TRC20 Highlight */}
              {walletBalance.usdtTrc20 && (
                <Alert className="border-green-300 bg-green-50">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <AlertTitle className="text-green-800">USDT TRC20 Token Found! 🎯</AlertTitle>
                  <AlertDescription className="mt-2">
                    <div className="space-y-3">
                      <div className="font-mono text-sm bg-white p-3 rounded border border-green-200">
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
                                title: "Copied!", 
                                description: "USDT TRC20 currencyId copied to clipboard" 
                              });
                            }}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <strong>Name:</strong> {walletBalance.usdtTrc20.name}
                        </div>
                        <div>
                          <strong>Network:</strong> {walletBalance.usdtTrc20.nodeType}
                        </div>
                        <div>
                          <strong>Type:</strong> {walletBalance.usdtTrc20.currencyType}
                        </div>
                        <div>
                          <strong>Balance:</strong> {walletBalance.usdtTrc20.balance}
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
                    <h4 className="font-semibold">All Tokens ({walletBalance.tokens.length})</h4>
                    {!walletBalance.usdtTrc20 && (
                      <Badge variant="destructive">
                        <AlertCircle className="h-3 w-3 mr-1" />
                        USDT TRC20 not found
                      </Badge>
                    )}
                  </div>

                  <div className="border rounded-lg overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-muted">
                          <tr>
                            <th className="px-4 py-3 text-left font-medium">Currency ID</th>
                            <th className="px-4 py-3 text-left font-medium">Name</th>
                            <th className="px-4 py-3 text-left font-medium">Network</th>
                            <th className="px-4 py-3 text-left font-medium">Type</th>
                            <th className="px-4 py-3 text-right font-medium">Balance</th>
                            <th className="px-4 py-3 text-right font-medium">Actions</th>
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
                                    Recommended
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
                                      title: "Copied!", 
                                      description: `${token.name} currencyId copied` 
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
                  <AlertTitle>No Tokens Found</AlertTitle>
                  <AlertDescription>
                    Your CPAY wallet returned 0 tokens. Make sure USDT TRC20 is enabled in your CPAY account.
                  </AlertDescription>
                </Alert>
              )}

              {/* Tips Section */}
              {walletBalance.tips && (
                <div className="border rounded-lg p-4 bg-blue-50">
                  <h4 className="font-semibold mb-2 flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-blue-600" />
                    💡 Tips
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
                <h4 className="font-semibold mb-2">📋 Next Steps:</h4>
                <ol className="text-sm space-y-2 list-decimal list-inside">
                  <li>Copy the <code className="bg-muted px-1">currencyId</code> from the USDT TRC20 token above</li>
                  <li>Update the secret <code className="bg-muted px-1">CPAY_USDT_TOKEN_ID</code> with this 24-character value</li>
                  <li>Ensure you have sufficient TRX balance in your wallet for network fees</li>
                  <li>Return to this page and process pending withdrawals</li>
                </ol>
              </div>
            </div>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel>Close</AlertDialogCancel>
            {walletBalance?.usdtTrc20 && (
              <AlertDialogAction
                onClick={() => {
                  navigator.clipboard.writeText(walletBalance.usdtTrc20.currencyId);
                  toast({
                    title: "Copied!",
                    description: "USDT TRC20 currencyId copied to clipboard",
                  });
                }}
              >
                <Copy className="mr-2 h-4 w-4" />
                Copy USDT TRC20 ID
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* CPAY Wallet Info Dialog */}
      <AlertDialog open={showWalletInfoDialog} onOpenChange={setShowWalletInfoDialog}>
        <AlertDialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <AlertDialogHeader>
            <AlertDialogTitle>CPAY Token Information</AlertDialogTitle>
            <AlertDialogDescription>
              {walletInfo?.source === 'last_deposit' 
                ? 'Token extracted from your most recent CPAY deposit'
                : 'Tokens retrieved from your CPAY wallet'
              }
            </AlertDialogDescription>
          </AlertDialogHeader>

          {walletInfo && (
            <div className="space-y-4 py-4">
              {/* Source Badge */}
              <div className="flex items-center gap-2">
                <Badge variant={walletInfo.source === 'last_deposit' ? 'default' : 'secondary'}>
                  {walletInfo.source === 'last_deposit' ? '📦 From Last Deposit' : '💼 From Wallet API'}
                </Badge>
                {walletInfo.depositDate && (
                  <span className="text-xs text-muted-foreground">
                    Deposit: {new Date(walletInfo.depositDate).toLocaleString()}
                  </span>
                )}
              </div>

              {/* Token Info - show success only when we actually have a tokenId */}
              {(walletInfo.usdtTrc20Token?.currencyId || walletInfo.token?.currencyId) ? (
                <Alert className="border-green-200 bg-green-50">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <AlertTitle>✅ USDT TRC20 Token Found</AlertTitle>
                  <AlertDescription className="mt-2 space-y-2">
                    <div className="font-mono text-sm bg-white p-3 rounded border">
                      <strong>currencyId (Token ID):</strong><br/>
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
                            toast({ title: "Copied!", description: "Token ID copied to clipboard" });
                          }
                        }}
                        className="ml-2"
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                    <div className="text-xs space-y-1">
                      <div><strong>Name:</strong> {walletInfo.usdtTrc20Token?.name || walletInfo.token?.currency || walletInfo.token?.name}</div>
                      <div><strong>Network:</strong> {walletInfo.usdtTrc20Token?.nodeType || walletInfo.usdtTrc20Token?.blockchain || walletInfo.token?.blockchain}</div>
                      <div><strong>Type:</strong> {walletInfo.usdtTrc20Token?.currencyType || 'token'}</div>
                    </div>
                  </AlertDescription>
                </Alert>
              ) : (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>{walletInfo.source === 'last_deposit' ? 'Token Not Found' : 'USDT TRC20 Not Found'}</AlertTitle>
                  <AlertDescription>
                    {walletInfo.error || (walletInfo.totalTokens === 0
                      ? 'Your CPAY wallet returned 0 tokens. Ensure USDT TRC20 is enabled for this wallet or try the "Use Token From Last Deposit" option.'
                      : 'Could not find USDT on TRC20 blockchain in your wallet tokens')}
                    {walletInfo.suggestion && (
                      <div className="mt-2 text-xs">💡 {walletInfo.suggestion}</div>
                    )}
                  </AlertDescription>
                </Alert>
              )}

              {/* Instructions */}
              <div className="border-t pt-4">
                <h4 className="font-semibold mb-2">📋 Next Steps:</h4>
                <ol className="text-sm space-y-2 list-decimal list-inside">
                  <li>Copy the <code className="bg-muted px-1">currencyId</code> value above</li>
                  <li>Update the secret <code className="bg-muted px-1">CPAY_USDT_TOKEN_ID</code> with this value</li>
                  <li>Return to this page and click "Clear Error & Retry" on the pending withdrawal</li>
                </ol>
              </div>

              {/* All Currencies (Collapsible) - show for wallet/currency mode */}
              {(walletInfo.allCurrencies || walletInfo.allTokens) && (walletInfo.allCurrencies?.length > 0 || walletInfo.allTokens?.length > 0) && (
                <details className="border rounded p-3">
                  <summary className="cursor-pointer font-semibold text-sm">
                    All Available Currencies ({walletInfo.allCurrencies?.length || walletInfo.allTokens?.length})
                  </summary>
                  <div className="mt-3 space-y-2 max-h-60 overflow-y-auto">
                    {(walletInfo.allCurrencies || walletInfo.allTokens)?.map((item: any, idx: number) => (
                      <div key={idx} className="text-xs bg-muted p-2 rounded font-mono">
                        <div><strong>currencyId:</strong> {item.currencyId}</div>
                        <div><strong>Name:</strong> {item.name || item.currency}</div>
                        <div><strong>Network:</strong> {item.nodeType || item.blockchain || 'N/A'}</div>
                        {item.currencyType && <div><strong>Type:</strong> {item.currencyType}</div>}
                        {item.isUsdtTrc20 && <Badge variant="default" className="mt-1">← Recommended for USDT TRC20</Badge>}
                      </div>
                    ))}
                  </div>
                </details>
              )}

              {/* Deposit Info (for deposit mode) */}
              {walletInfo.depositInfo && (
                <details className="border rounded p-3">
                  <summary className="cursor-pointer font-semibold text-sm">
                    Deposit Details
                  </summary>
                  <div className="mt-3 text-xs space-y-1 bg-muted p-3 rounded">
                    <div><strong>Wallet ID:</strong> {walletInfo.depositInfo.wallet}</div>
                    <div><strong>Currency:</strong> {walletInfo.depositInfo.currency}</div>
                    <div><strong>Blockchain:</strong> {walletInfo.depositInfo.blockchain}</div>
                  </div>
                </details>
              )}
            </div>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel>Close</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const tokenId = walletInfo?.usdtTrc20Token?.currencyId || walletInfo?.token?.currencyId;
                if (tokenId) {
                  navigator.clipboard.writeText(tokenId);
                  toast({
                    title: "Copied!",
                    description: "Token ID copied to clipboard",
                  });
                }
              }}
              disabled={!walletInfo?.usdtTrc20Token?.currencyId && !walletInfo?.token?.currencyId}
            >
              <Copy className="mr-2 h-4 w-4" />
              Copy Token ID
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
