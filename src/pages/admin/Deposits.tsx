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
import { AdminBreadcrumb } from "@/components/admin/AdminBreadcrumb";
import { Download, Search, Filter } from "lucide-react";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/wallet-utils";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";

interface Deposit {
  id: string;
  user_id: string;
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
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [methodFilter, setMethodFilter] = useState<string>("all");

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
  }, [isAdmin]);

  const loadDeposits = async () => {
    try {
      setLoading(true);

      let query = supabase
        .from("transactions")
        .select(`
          id,
          user_id,
          amount,
          status,
          payment_gateway,
          gateway_transaction_id,
          created_at,
          profiles:user_id (
            username,
            email
          )
        `)
        .eq("type", "deposit")
        .order("created_at", { ascending: false });

      const { data, error } = await query;

      if (error) throw error;

      setDeposits(data || []);
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

        <Card>
          <CardHeader>
            <CardTitle>All Deposits</CardTitle>
            <CardDescription>
              {filteredDeposits.length} deposit{filteredDeposits.length !== 1 ? "s" : ""} found
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

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full md:w-[180px]">
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
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

            {/* Table */}
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Transaction ID</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredDeposits.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground">
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
                          <Badge variant="outline">
                            {deposit.payment_gateway || "N/A"}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {deposit.gateway_transaction_id || "N/A"}
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
