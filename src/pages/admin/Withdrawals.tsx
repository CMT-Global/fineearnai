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
import { CheckCircle, XCircle, Clock, DollarSign, Copy, AlertCircle, ExternalLink } from "lucide-react";
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
  profiles?: {
    username: string;
    email: string;
  };
}

export default function Withdrawals() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [selectedTab, setSelectedTab] = useState("pending");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogAction, setDialogAction] = useState<"approve" | "reject" | null>(null);
  const [selectedWithdrawal, setSelectedWithdrawal] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [txnHash, setTxnHash] = useState("");
  const [completionNotes, setCompletionNotes] = useState("");
  const [completingWithdrawal, setCompletingWithdrawal] = useState<string | null>(null);

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
          profiles (
            username,
            email
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

  const handleProcessWithdrawal = async () => {
    if (!selectedWithdrawal || !dialogAction) return;

    try {
      setProcessing(selectedWithdrawal);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const withdrawal = withdrawals.find(w => w.id === selectedWithdrawal);
      if (!withdrawal) throw new Error("Withdrawal not found");

      // All withdrawals now processed through cpay-withdraw (manual processing workflow)
      console.log('Processing withdrawal:', {
        withdrawalId: selectedWithdrawal,
        paymentMethod: withdrawal.payment_method,
        action: dialogAction
      });
      
      const { data, error } = await supabase.functions.invoke("cpay-withdraw", {
        body: {
          withdrawal_request_id: selectedWithdrawal,
          action: dialogAction,
          rejection_reason: dialogAction === "reject" ? rejectionReason : undefined,
        },
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: data.message || `Withdrawal ${dialogAction}ed successfully`,
      });

      await loadWithdrawals();
    } catch (error) {
      console.error("Error processing withdrawal:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to process withdrawal",
        variant: "destructive",
      });
    } finally {
      setProcessing(null);
      setDialogOpen(false);
      setSelectedWithdrawal(null);
      setRejectionReason("");
      setDialogAction(null);
    }
  };

  const openDialog = (withdrawalId: string, action: "approve" | "reject") => {
    setSelectedWithdrawal(withdrawalId);
    setDialogAction(action);
    setDialogOpen(true);
  };

  const handleCompleteManualWithdrawal = async (withdrawalId: string) => {
    if (!txnHash.trim()) {
      toast({
        title: "Error",
        description: "Transaction hash is required",
        variant: "destructive",
      });
      return;
    }

    try {
      setCompletingWithdrawal(withdrawalId);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const { data, error } = await supabase.functions.invoke("complete-manual-withdrawal", {
        body: {
          withdrawal_request_id: withdrawalId,
          transaction_hash: txnHash,
          notes: completionNotes || undefined,
        },
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: data.message || "Withdrawal marked as completed successfully",
      });

      setTxnHash("");
      setCompletionNotes("");
      await loadWithdrawals();
    } catch (error) {
      console.error("Error completing withdrawal:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to complete withdrawal",
        variant: "destructive",
      });
    } finally {
      setCompletingWithdrawal(null);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied",
      description: "Address copied to clipboard",
    });
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
      pending: { label: "Pending", variant: "secondary" },
      approved_manual: { label: "Awaiting Manual Payout", variant: "outline" },
      processing: { label: "Processing", variant: "default" },
      completed: { label: "Completed", variant: "default" },
      rejected: { label: "Rejected", variant: "destructive" },
      failed: { label: "Failed", variant: "destructive" },
    };

    const config = statusConfig[status] || { label: status, variant: "outline" };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const filteredWithdrawals = withdrawals.filter(w => {
    if (selectedTab === "pending") return ["pending", "approved_manual"].includes(w.status);
    if (selectedTab === "completed") return ["completed", "processing"].includes(w.status);
    if (selectedTab === "rejected") return ["rejected", "failed"].includes(w.status);
    return true;
  });

  const stats = {
    pending: withdrawals.filter(w => ["pending", "approved_manual"].includes(w.status)).length,
    pendingAmount: withdrawals
      .filter(w => ["pending", "approved_manual"].includes(w.status))
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

                    {withdrawal.status === "approved_manual" && (
                      <Alert className="mt-4 border-orange-500 bg-orange-50">
                        <AlertCircle className="h-4 w-4 text-orange-600" />
                        <AlertTitle>Manual Payout Required</AlertTitle>
                        <AlertDescription>
                          <div className="space-y-2 mt-2">
                            <p><strong>Network:</strong> TRC20 (USDT)</p>
                            <p><strong>Amount:</strong> {formatCurrency(withdrawal.net_amount)} USDT</p>
                            <p className="flex items-center gap-2">
                              <strong>Address:</strong> 
                              <code className="ml-2 bg-white px-2 py-1 rounded text-xs">
                                {withdrawal.payout_address}
                              </code>
                              <Button 
                                size="sm" 
                                variant="ghost" 
                                onClick={() => copyToClipboard(withdrawal.payout_address)}
                              >
                                <Copy className="h-3 w-3" />
                              </Button>
                            </p>
                            <p className="text-xs text-muted-foreground mt-2">
                              Send crypto manually from your external wallet, then enter transaction hash below.
                            </p>
                          </div>
                        </AlertDescription>
                      </Alert>
                    )}

                    {withdrawal.status === "approved_manual" && (
                      <div className="space-y-3 mt-4">
                        <div>
                          <label className="text-sm font-medium">Blockchain Transaction Hash *</label>
                          <Input 
                            placeholder="Enter transaction hash (e.g., 0xabc123...)" 
                            value={txnHash}
                            onChange={(e) => setTxnHash(e.target.value)}
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <label className="text-sm font-medium">Completion Notes (Optional)</label>
                          <Textarea
                            placeholder="Add any notes about the completion..."
                            value={completionNotes}
                            onChange={(e) => setCompletionNotes(e.target.value)}
                            className="mt-1"
                            rows={2}
                          />
                        </div>
                        <Button 
                          onClick={() => handleCompleteManualWithdrawal(withdrawal.id)}
                          disabled={completingWithdrawal === withdrawal.id || !txnHash.trim()}
                          className="w-full"
                        >
                          <CheckCircle className="mr-2 h-4 w-4" />
                          {completingWithdrawal === withdrawal.id ? "Marking as Completed..." : "Mark as Completed"}
                        </Button>
                      </div>
                    )}

                    {withdrawal.status === "pending" && (
                      <div className="flex gap-2 mt-4">
                        <Button
                          onClick={() => openDialog(withdrawal.id, "approve")}
                          disabled={processing === withdrawal.id}
                          className="flex-1"
                        >
                          <CheckCircle className="mr-2 h-4 w-4" />
                          Approve
                        </Button>
                        <Button
                          onClick={() => openDialog(withdrawal.id, "reject")}
                          disabled={processing === withdrawal.id}
                          variant="destructive"
                          className="flex-1"
                        >
                          <XCircle className="mr-2 h-4 w-4" />
                          Reject
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
            <AlertDialogTitle>
              {dialogAction === "approve" ? "Approve Withdrawal" : "Reject Withdrawal"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {dialogAction === "approve"
                ? "This will approve the withdrawal for manual processing. You will need to send the crypto manually and then mark it as completed."
                : "This will refund the amount to the user's earnings wallet."}
            </AlertDialogDescription>
          </AlertDialogHeader>

          {dialogAction === "reject" && (
            <div className="py-4">
              <label className="text-sm font-medium">Rejection Reason</label>
              <Textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Enter reason for rejection..."
                className="mt-2"
                rows={3}
              />
            </div>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleProcessWithdrawal}>
              {dialogAction === "approve" ? "Approve" : "Reject"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
