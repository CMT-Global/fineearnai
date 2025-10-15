import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Download, Search, Filter, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { toast } from "sonner";
import { formatCurrency, getTransactionTypeLabel } from "@/lib/wallet-utils";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";

interface Transaction {
  id: string;
  user_id: string;
  type: string;
  amount: number;
  wallet_type: string;
  status: string;
  new_balance: number;
  description: string | null;
  created_at: string;
  profiles: {
    username: string;
    email: string;
  };
}

const Transactions = () => {
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdmin();
  const navigate = useNavigate();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [walletFilter, setWalletFilter] = useState<string>("all");

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
          id,
          user_id,
          type,
          amount,
          wallet_type,
          status,
          new_balance,
          description,
          created_at,
          profiles:user_id (
            username,
            email
          )
        `)
        .order("created_at", { ascending: false })
        .limit(500);

      if (error) throw error;

      setTransactions(data || []);
    } catch (error: any) {
      console.error("Error loading transactions:", error);
      toast.error("Failed to load transactions");
    } finally {
      setLoading(false);
    }
  };

  const exportToCSV = () => {
    const csv = [
      ["Date", "Username", "Email", "Type", "Amount", "Wallet", "Status", "New Balance", "Description"],
      ...filteredTransactions.map((t) => [
        new Date(t.created_at).toLocaleDateString(),
        t.profiles?.username || "N/A",
        t.profiles?.email || "N/A",
        getTransactionTypeLabel(t.type),
        t.amount.toString(),
        t.wallet_type,
        t.status,
        t.new_balance.toString(),
        t.description || "N/A",
      ]),
    ]
      .map((row) => row.join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `transactions_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    toast.success("Transactions exported to CSV");
  };

  const isCredit = (type: string) => {
    return ["deposit", "task_earning", "referral_commission", "adjustment"].includes(type);
  };

  const filteredTransactions = transactions.filter((txn) => {
    const matchesSearch =
      searchQuery === "" ||
      txn.profiles?.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      txn.profiles?.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      txn.description?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesType = typeFilter === "all" || txn.type === typeFilter;
    const matchesStatus = statusFilter === "all" || txn.status === statusFilter;
    const matchesWallet = walletFilter === "all" || txn.wallet_type === walletFilter;

    return matchesSearch && matchesType && matchesStatus && matchesWallet;
  });

  const transactionTypes = Array.from(new Set(transactions.map((t) => t.type)));

  if (authLoading || adminLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <LoadingSpinner size="lg" text="Loading transactions..." />
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

          <h1 className="text-3xl font-bold mb-2">Transaction Logs</h1>
          <p className="text-muted-foreground">
            Comprehensive audit trail of all platform transactions
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>All Transactions</CardTitle>
            <CardDescription>
              {filteredTransactions.length} transaction{filteredTransactions.length !== 1 ? "s" : ""} found
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Filters */}
            <div className="flex flex-col md:flex-row gap-4 mb-6">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by username, email, or description..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>

              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-full md:w-[180px]">
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {transactionTypes.map((type) => (
                    <SelectItem key={type} value={type}>
                      {getTransactionTypeLabel(type)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={walletFilter} onValueChange={setWalletFilter}>
                <SelectTrigger className="w-full md:w-[160px]">
                  <SelectValue placeholder="Wallet" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Wallets</SelectItem>
                  <SelectItem value="deposit">Deposit</SelectItem>
                  <SelectItem value="earnings">Earnings</SelectItem>
                </SelectContent>
              </Select>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full md:w-[160px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                </SelectContent>
              </Select>

              <Button onClick={exportToCSV} variant="outline">
                <Download className="mr-2 h-4 w-4" />
                Export CSV
              </Button>
            </div>

            {/* Table */}
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Wallet</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Description</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTransactions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground">
                        No transactions found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredTransactions.map((txn) => (
                      <TableRow key={txn.id}>
                        <TableCell className="whitespace-nowrap">
                          {new Date(txn.created_at).toLocaleDateString()}{" "}
                          {new Date(txn.created_at).toLocaleTimeString()}
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">{txn.profiles?.username}</div>
                            <div className="text-sm text-muted-foreground">
                              {txn.profiles?.email}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {isCredit(txn.type) ? (
                              <ArrowDownRight className="h-4 w-4 text-green-500" />
                            ) : (
                              <ArrowUpRight className="h-4 w-4 text-red-500" />
                            )}
                            <span>{getTransactionTypeLabel(txn.type)}</span>
                          </div>
                        </TableCell>
                        <TableCell
                          className={`font-semibold ${
                            isCredit(txn.type) ? "text-green-600" : "text-red-600"
                          }`}
                        >
                          {isCredit(txn.type) ? "+" : "-"}
                          {formatCurrency(txn.amount)}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">
                            {txn.wallet_type}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              txn.status === "completed"
                                ? "default"
                                : txn.status === "pending"
                                ? "secondary"
                                : "destructive"
                            }
                          >
                            {txn.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate">
                          {txn.description || "—"}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Transactions;
