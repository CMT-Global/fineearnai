import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, RefreshCw, DollarSign, TrendingUp, TrendingDown, Clock } from "lucide-react";
import { toast } from "sonner";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { formatCurrency } from "@/lib/wallet-utils";
import { format } from "date-fns";

interface CPAYTransaction {
  id: string;
  user_id: string;
  type: string;
  amount: number;
  status: string;
  payment_gateway: string;
  gateway_transaction_id: string;
  created_at: string;
  metadata?: any;
  profiles?: {
    username: string;
    email: string;
  };
}

const CPAYMonitoring = () => {
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdmin();
  const navigate = useNavigate();
  const [transactions, setTransactions] = useState<CPAYTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedTab, setSelectedTab] = useState("all");

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
      loadTransactions();
    }
  }, [isAdmin]);

  const loadTransactions = async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from("transactions")
        .select(`
          *,
          profiles:user_id (
            username,
            email
          )
        `)
        .eq("payment_gateway", "cpay")
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) throw error;

      setTransactions(data || []);
    } catch (error: any) {
      console.error("Error loading CPAY transactions:", error);
      toast.error("Failed to load CPAY transactions");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadTransactions();
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      completed: "default",
      pending: "secondary",
      failed: "destructive",
    };

    return <Badge variant={variants[status] || "outline"}>{status}</Badge>;
  };

  const filteredTransactions = transactions.filter((tx) => {
    if (selectedTab === "all") return true;
    if (selectedTab === "deposits") return tx.type === "deposit";
    if (selectedTab === "withdrawals") return tx.type === "withdrawal";
    return true;
  });

  const stats = {
    totalDeposits: transactions
      .filter((tx) => tx.type === "deposit" && tx.status === "completed")
      .reduce((sum, tx) => sum + tx.amount, 0),
    totalWithdrawals: transactions
      .filter((tx) => tx.type === "withdrawal" && tx.status === "completed")
      .reduce((sum, tx) => sum + tx.amount, 0),
    pendingDeposits: transactions.filter(
      (tx) => tx.type === "deposit" && tx.status === "pending"
    ).length,
    pendingWithdrawals: transactions.filter(
      (tx) => tx.type === "withdrawal" && tx.status === "pending"
    ).length,
  };

  if (authLoading || adminLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <LoadingSpinner size="lg" text="Loading CPAY monitoring..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <Button variant="ghost" onClick={() => navigate("/admin")} className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Admin
          </Button>

          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold mb-2">CPAY Transaction Monitoring</h1>
              <p className="text-muted-foreground">
                Monitor and track all CPAY payment gateway transactions
              </p>
            </div>
            <Button onClick={handleRefresh} disabled={refreshing}>
              <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-4 mb-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Deposits</CardTitle>
              <TrendingUp className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {formatCurrency(stats.totalDeposits)}
              </div>
              <p className="text-xs text-muted-foreground">Completed via CPAY</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Withdrawals</CardTitle>
              <TrendingDown className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {formatCurrency(stats.totalWithdrawals)}
              </div>
              <p className="text-xs text-muted-foreground">Processed via CPAY</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Pending Deposits</CardTitle>
              <Clock className="h-4 w-4 text-yellow-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.pendingDeposits}</div>
              <p className="text-xs text-muted-foreground">Awaiting confirmation</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Pending Withdrawals</CardTitle>
              <DollarSign className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.pendingWithdrawals}</div>
              <p className="text-xs text-muted-foreground">Awaiting processing</p>
            </CardContent>
          </Card>
        </div>

        {/* Transactions Table */}
        <Card>
          <CardHeader>
            <CardTitle>Transaction History</CardTitle>
            <CardDescription>All CPAY payment gateway transactions</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={selectedTab} onValueChange={setSelectedTab}>
              <TabsList className="mb-4">
                <TabsTrigger value="all">All ({transactions.length})</TabsTrigger>
                <TabsTrigger value="deposits">
                  Deposits (
                  {transactions.filter((tx) => tx.type === "deposit").length})
                </TabsTrigger>
                <TabsTrigger value="withdrawals">
                  Withdrawals (
                  {transactions.filter((tx) => tx.type === "withdrawal").length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value={selectedTab}>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>User</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Gateway ID</TableHead>
                        <TableHead>Metadata</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredTransactions.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={7}
                            className="text-center text-muted-foreground"
                          >
                            No CPAY transactions found
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredTransactions.map((tx) => (
                          <TableRow key={tx.id}>
                            <TableCell className="text-sm">
                              {format(new Date(tx.created_at), "MMM dd, yyyy HH:mm")}
                            </TableCell>
                            <TableCell>
                              <div>
                                <p className="font-medium">
                                  {tx.profiles?.username || "Unknown"}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {tx.profiles?.email}
                                </p>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{tx.type}</Badge>
                            </TableCell>
                            <TableCell className="font-semibold">
                              {formatCurrency(tx.amount)}
                            </TableCell>
                            <TableCell>{getStatusBadge(tx.status)}</TableCell>
                            <TableCell className="font-mono text-xs">
                              {tx.gateway_transaction_id || "-"}
                            </TableCell>
                            <TableCell className="text-xs">
                              {tx.metadata?.order_id && (
                                <div>Order: {tx.metadata.order_id}</div>
                              )}
                              {tx.metadata?.payout_id && (
                                <div>Payout: {tx.metadata.payout_id}</div>
                              )}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default CPAYMonitoring;
