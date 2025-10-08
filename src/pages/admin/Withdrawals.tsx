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
import { CheckCircle, XCircle, Clock, DollarSign } from "lucide-react";
import { formatCurrency } from "@/lib/wallet-utils";

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
      const { data, error } = await supabase
        .from("withdrawal_requests")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Manually fetch profile data for each withdrawal
      const withdrawalsWithProfiles = await Promise.all(
        (data || []).map(async (withdrawal) => {
          const { data: profile } = await supabase
            .from("profiles")
            .select("username, email")
            .eq("id", withdrawal.user_id)
            .single();

          return {
            ...withdrawal,
            profiles: profile || { username: "Unknown", email: "" },
          };
        })
      );

      setWithdrawals(withdrawalsWithProfiles);
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

      const { data, error } = await supabase.functions.invoke("process-withdrawal", {
        body: {
          withdrawalRequestId: selectedWithdrawal,
          action: dialogAction,
          rejectionReason: dialogAction === "reject" ? rejectionReason : undefined,
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
                        <p className="font-medium">{withdrawal.payment_method}</p>
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
                    </div>

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
                ? "This will process the payment and mark the withdrawal as completed."
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
