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
import { useTranslation } from "react-i18next";
import { useLanguage } from "@/contexts/LanguageContext";
import { useLanguageSync } from "@/hooks/useLanguageSync";

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
  const { t } = useTranslation();
  const { userLanguage, isLoading: isLanguageLoading } = useLanguage();
  useLanguageSync();
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
      toast.error(t("admin.accessDenied"));
      navigate("/dashboard");
    }
  }, [isAdmin, adminLoading, navigate, t]);

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
      toast.error(t("admin.cpayMonitoring.errorFailedToLoad"));
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

  if (authLoading || adminLoading || loading || isLanguageLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <LoadingSpinner size="lg" text={t("admin.cpayMonitoring.loading")} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <Button variant="ghost" onClick={() => navigate("/admin")} className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t("admin.cpayMonitoring.backToAdmin")}
          </Button>

          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold mb-2">{t("admin.cpayMonitoring.title")}</h1>
              <p className="text-muted-foreground">
                {t("admin.cpayMonitoring.subtitle")}
              </p>
            </div>
            <Button onClick={handleRefresh} disabled={refreshing}>
              <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
              {t("common.refresh")}
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-4 mb-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">{t("admin.cpayMonitoring.stats.totalDeposits")}</CardTitle>
              <TrendingUp className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {formatCurrency(stats.totalDeposits)}
              </div>
              <p className="text-xs text-muted-foreground">{t("admin.cpayMonitoring.stats.completedViaCPAY")}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">{t("admin.cpayMonitoring.stats.totalWithdrawals")}</CardTitle>
              <TrendingDown className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {formatCurrency(stats.totalWithdrawals)}
              </div>
              <p className="text-xs text-muted-foreground">{t("admin.cpayMonitoring.stats.processedViaCPAY")}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">{t("admin.cpayMonitoring.stats.pendingDeposits")}</CardTitle>
              <Clock className="h-4 w-4 text-yellow-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.pendingDeposits}</div>
              <p className="text-xs text-muted-foreground">{t("admin.cpayMonitoring.stats.awaitingConfirmation")}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">{t("admin.cpayMonitoring.stats.pendingWithdrawals")}</CardTitle>
              <DollarSign className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.pendingWithdrawals}</div>
              <p className="text-xs text-muted-foreground">{t("admin.cpayMonitoring.stats.awaitingProcessing")}</p>
            </CardContent>
          </Card>
        </div>

        {/* Transactions Table */}
        <Card>
          <CardHeader>
            <CardTitle>{t("admin.cpayMonitoring.transactionHistory")}</CardTitle>
            <CardDescription>{t("admin.cpayMonitoring.transactionHistoryDescription")}</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={selectedTab} onValueChange={setSelectedTab}>
              <TabsList className="mb-4">
                <TabsTrigger value="all">{t("admin.cpayMonitoring.tabs.all")} ({transactions.length})</TabsTrigger>
                <TabsTrigger value="deposits">
                  {t("admin.cpayMonitoring.tabs.deposits")} (
                  {transactions.filter((tx) => tx.type === "deposit").length})
                </TabsTrigger>
                <TabsTrigger value="withdrawals">
                  {t("admin.cpayMonitoring.tabs.withdrawals")} (
                  {transactions.filter((tx) => tx.type === "withdrawal").length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value={selectedTab}>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("admin.cpayMonitoring.table.date")}</TableHead>
                        <TableHead>{t("admin.cpayMonitoring.table.user")}</TableHead>
                        <TableHead>{t("admin.cpayMonitoring.table.type")}</TableHead>
                        <TableHead>{t("admin.cpayMonitoring.table.amount")}</TableHead>
                        <TableHead>{t("admin.cpayMonitoring.table.status")}</TableHead>
                        <TableHead>{t("admin.cpayMonitoring.table.gatewayId")}</TableHead>
                        <TableHead>{t("admin.cpayMonitoring.table.metadata")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredTransactions.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={7}
                            className="text-center text-muted-foreground"
                          >
                            {t("admin.cpayMonitoring.noTransactions")}
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
                                  {tx.profiles?.username || t("admin.cpayMonitoring.unknown")}
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
                                <div>{t("admin.cpayMonitoring.order")}: {tx.metadata.order_id}</div>
                              )}
                              {tx.metadata?.payout_id && (
                                <div>{t("admin.cpayMonitoring.payout")}: {tx.metadata.payout_id}</div>
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
