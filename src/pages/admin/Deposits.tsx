import { useEffect, useState, useMemo } from "react";
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
import { AdminBreadcrumb } from "@/components/admin/AdminBreadcrumb";
import { Download, Search, Filter } from "lucide-react";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/wallet-utils";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";

interface Deposit {
  id: string;
  user_id: string;
  type: string;
  amount: number;
  status: string;
  payment_gateway: string | null;
  gateway_transaction_id: string | null;
  created_at: string;
  profiles: {
    username: string;
    email: string;
  };
}

const Deposits = () => {
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdmin();
  const navigate = useNavigate();
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("completed"); // Default to completed only
  const [methodFilter, setMethodFilter] = useState<string>("all");
  const [depositTypeFilter, setDepositTypeFilter] = useState<string>("regular"); // "regular", "admin_adjustments", "all"
  const [stats, setStats] = useState({ 
    total: 0, 
    totalAmount: 0,
    completed: 0, 
    pending: 0, 
    failed: 0,
    adminAdjustments: 0,
    adminAdjustmentsAmount: 0,
  });

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
      loadDeposits();
    }
  }, [isAdmin, statusFilter, depositTypeFilter]); // Reload when status or deposit type filter changes

  const loadDeposits = async () => {
    try {
      setLoading(true);

      // Build query based on deposit type filter
      let query = supabase
        .from("transactions")
        .select(`
          id,
          user_id,
          type,
          amount,
          status,
          payment_gateway,
          gateway_transaction_id,
          created_at,
          profiles:user_id (
            username,
            email
          )
        `);

      // Apply deposit type filter
      if (depositTypeFilter === "regular") {
        query = query.eq("type", "deposit");
      } else if (depositTypeFilter === "admin_adjustments") {
        query = query.in("type", ["adjustment", "transfer"]).eq("wallet_type", "deposit");
      } else {
        // "all" - show both deposits and admin adjustments to deposit wallet
        query = query.or(`type.eq.deposit,and(type.in.(adjustment,transfer),wallet_type.eq.deposit)`);
      }

      // Apply status filter if not "all"
      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter as any);
      }

      query = query.order("created_at", { ascending: false });

      const { data, error } = await query;

      if (error) throw error;

      setDeposits(data || []);

      // Load separate stats for regular deposits
      const { data: regularDeposits, error: regularError } = await supabase
        .from("transactions")
        .select("amount, status")
        .eq("type", "deposit");

      // Load stats for admin adjustments
      const { data: adminAdjustments, error: adminError } = await supabase
        .from("transactions")
        .select("amount")
        .in("type", ["adjustment", "transfer"])
        .eq("wallet_type", "deposit");

      if (!regularError && regularDeposits) {
        const statsCount = {
          total: regularDeposits.length,
          totalAmount: regularDeposits.reduce((sum, t) => sum + Number(t.amount), 0),
          completed: regularDeposits.filter(t => t.status === "completed").length,
          pending: regularDeposits.filter(t => t.status === "pending").length,
          failed: regularDeposits.filter(t => t.status === "failed").length,
          adminAdjustments: adminAdjustments?.length || 0,
          adminAdjustmentsAmount: adminAdjustments?.reduce((sum, t) => sum + Number(t.amount), 0) || 0,
        };
        setStats(statsCount);
      }
    } catch (error: any) {
      console.error("Error loading deposits:", error);
      toast.error("Failed to load deposits");
    } finally {
      setLoading(false);
    }
  };

  const exportToCSV = () => {
    const csv = [
      ["Date", "Username", "Email", "Amount", "Method", "Transaction ID", "Status"],
      ...filteredDeposits.map((d) => [
        new Date(d.created_at).toLocaleDateString(),
        d.profiles?.username || "N/A",
        d.profiles?.email || "N/A",
        d.amount.toString(),
        d.payment_gateway || "N/A",
        d.gateway_transaction_id || "N/A",
        d.status,
      ]),
    ]
      .map((row) => row.join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `deposits_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    toast.success("Deposits exported to CSV");
  };

  const filteredDeposits = deposits.filter((deposit) => {
    const matchesSearch =
      searchQuery === "" ||
      deposit.profiles?.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      deposit.profiles?.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      deposit.gateway_transaction_id?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === "all" || deposit.status === statusFilter;
    const matchesMethod = methodFilter === "all" || deposit.payment_gateway === methodFilter;

    return matchesSearch && matchesStatus && matchesMethod;
  });

  const uniqueMethods = Array.from(
    new Set(deposits.map((d) => d.payment_gateway).filter(Boolean))
  );

  // Calculate filtered deposit totals in real-time
  const filteredDepositTotals = useMemo(() => {
    const regularDeposits = filteredDeposits.filter(d => d.type === 'deposit');
    const adminAdjustments = filteredDeposits.filter(d => d.type !== 'deposit');
    
    return {
      regularAmount: regularDeposits.reduce((sum, d) => sum + Number(d.amount), 0),
      regularCount: regularDeposits.length,
      adminAmount: adminAdjustments.reduce((sum, d) => sum + Number(d.amount), 0),
      adminCount: adminAdjustments.length,
      totalAmount: filteredDeposits.reduce((sum, d) => sum + Number(d.amount), 0),
      totalCount: filteredDeposits.length,
    };
  }, [filteredDeposits]);

  if (authLoading || adminLoading || loading) {
    return (
      <div className="min-h-screen bg-[hsl(0,0%,98%)] flex items-center justify-center">
        <LoadingSpinner size="lg" text="Loading deposits..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[hsl(0,0%,98%)] p-6">
      <div className="container mx-auto">
        <AdminBreadcrumb 
          items={[
            { label: "Financial Management" },
            { label: "Deposits" }
          ]} 
        />
        
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Deposit Management</h1>
          <p className="text-muted-foreground mt-1">View and manage all platform deposits</p>
        </div>

        {/* Stats Summary Card */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Total Regular Deposits</CardDescription>
              <CardTitle className="text-2xl">{stats.total}</CardTitle>
              <p className="text-sm font-semibold text-green-600 mt-1">
                {formatCurrency(stats.totalAmount)}
              </p>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Completed</CardDescription>
              <CardTitle className="text-2xl text-green-600">{stats.completed}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Pending</CardDescription>
              <CardTitle className="text-2xl text-yellow-600">{stats.pending}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Failed</CardDescription>
              <CardTitle className="text-2xl text-red-600">{stats.failed}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Admin Adjustments</CardDescription>
              <CardTitle className="text-2xl text-blue-600">{stats.adminAdjustments}</CardTitle>
              <p className="text-sm font-semibold text-blue-600 mt-1">
                {formatCurrency(stats.adminAdjustmentsAmount)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                (Excluded from revenue)
              </p>
            </CardHeader>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>
              {statusFilter === "all" ? "All Deposits" : 
               statusFilter === "completed" ? "Completed Deposits" :
               statusFilter === "pending" ? "Pending Deposits" :
               "Failed Deposits"}
            </CardTitle>
            <CardDescription>
              {filteredDeposits.length} deposit{filteredDeposits.length !== 1 ? "s" : ""} found
              {statusFilter !== "all" && ` (${statusFilter} only)`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Filters */}
            <div className="flex flex-col md:flex-row gap-4 mb-6">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by username, email, or transaction ID..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>

              <Select value={depositTypeFilter} onValueChange={setDepositTypeFilter}>
                <SelectTrigger className="w-full md:w-[220px]">
                  <SelectValue placeholder="Deposit Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="regular">💳 Regular Deposits</SelectItem>
                  <SelectItem value="admin_adjustments">⚙️ Admin Adjustments</SelectItem>
                  <SelectItem value="all">📊 All Transactions</SelectItem>
                </SelectContent>
              </Select>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full md:w-[200px]">
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="completed">✓ Completed Only</SelectItem>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="pending">⏳ Pending Only</SelectItem>
                  <SelectItem value="failed">✗ Failed Only</SelectItem>
                </SelectContent>
              </Select>

              <Select value={methodFilter} onValueChange={setMethodFilter}>
                <SelectTrigger className="w-full md:w-[180px]">
                  <SelectValue placeholder="Method" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Methods</SelectItem>
                  {uniqueMethods.map((method) => (
                    <SelectItem key={method} value={method!}>
                      {method}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button onClick={exportToCSV} variant="outline">
                <Download className="mr-2 h-4 w-4" />
                Export CSV
              </Button>
            </div>

            {/* Filtered Totals Summary */}
            <Card className="mb-6 bg-gradient-to-r from-green-50 to-emerald-50 border-green-200 dark:from-green-950/20 dark:to-emerald-950/20 dark:border-green-800">
              <CardContent className="pt-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Regular Deposits</p>
                    <p className="text-2xl font-bold text-green-600">
                      {formatCurrency(filteredDepositTotals.regularAmount)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {filteredDepositTotals.regularCount} transaction{filteredDepositTotals.regularCount !== 1 ? 's' : ''}
                    </p>
                  </div>
                  
                  {depositTypeFilter === 'all' && (
                    <div>
                      <p className="text-sm text-muted-foreground">Admin Adjustments</p>
                      <p className="text-2xl font-bold text-blue-600">
                        {formatCurrency(filteredDepositTotals.adminAmount)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {filteredDepositTotals.adminCount} adjustment{filteredDepositTotals.adminCount !== 1 ? 's' : ''}
                      </p>
                    </div>
                  )}
                  
                  <div>
                    <p className="text-sm text-muted-foreground">Total (Filtered View)</p>
                    <p className="text-2xl font-bold">
                      {formatCurrency(filteredDepositTotals.totalAmount)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {filteredDepositTotals.totalCount} item{filteredDepositTotals.totalCount !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Table */}
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Transaction ID</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredDeposits.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground">
                        No deposits found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredDeposits.map((deposit) => (
                      <TableRow key={deposit.id}>
                        <TableCell>
                          {new Date(deposit.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">{deposit.profiles?.username}</div>
                            <div className="text-sm text-muted-foreground">
                              {deposit.profiles?.email}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="font-semibold">
                          {formatCurrency(deposit.amount)}
                        </TableCell>
                        <TableCell>
                          <Badge variant={deposit.type === 'deposit' ? 'default' : 'secondary'}>
                            {deposit.type === 'deposit' ? '💳 Regular' : '⚙️ Admin'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {deposit.payment_gateway || "Admin Panel"}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {deposit.gateway_transaction_id || deposit.id.slice(0, 8)}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              deposit.status === "completed"
                                ? "default"
                                : deposit.status === "pending"
                                ? "secondary"
                                : "destructive"
                            }
                          >
                            {deposit.status}
                          </Badge>
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

export default Deposits;
