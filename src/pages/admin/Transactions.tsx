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
import { Skeleton } from "@/components/ui/skeleton";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { ArrowLeft, Download, Search, Filter, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { useLanguageSync } from "@/hooks/useLanguageSync";
import { formatCurrency, getTransactionTypeLabel } from "@/lib/wallet-utils";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { PageLoading } from "@/components/shared/PageLoading";
import { getDateLocale } from "@/lib/date-locale";
import { useLanguage } from "@/contexts/LanguageContext";
import { format } from "date-fns";

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

// Helper function to calculate which page numbers to show in pagination
const getPageNumber = (index: number, currentPage: number, totalPages: number): number => {
  if (totalPages <= 5) return index + 1;
  if (currentPage <= 3) return index + 1;
  if (currentPage >= totalPages - 2) return totalPages - 4 + index;
  return currentPage - 2 + index;
};

const Transactions = () => {
  const { t } = useTranslation();
  useLanguageSync(); // Sync language and force re-render
  const { userLanguage } = useLanguage();
  const dateLocale = getDateLocale(userLanguage);
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdmin();
  const navigate = useNavigate();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [walletFilter, setWalletFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const limit = 50;

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/login");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!adminLoading && !isAdmin) {
      toast.error(t("toasts.admin.accessDenied"));
      navigate("/dashboard");
    }
  }, [isAdmin, adminLoading, navigate]);

  useEffect(() => {
    if (isAdmin) {
      loadTransactions();
    }
  }, [isAdmin, page]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [typeFilter, statusFilter, walletFilter, searchQuery]);

  const loadTransactions = async () => {
    try {
      setLoading(true);

      const from = (page - 1) * limit;
      const to = from + limit - 1;

      const { data, error, count } = await supabase
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
        `, { count: 'exact' })
        .order("created_at", { ascending: false })
        .range(from, to);

      if (error) throw error;

      setTransactions(data || []);
      setTotalCount(count || 0);
      setTotalPages(Math.ceil((count || 0) / limit));
    } catch (error: any) {
      console.error("Error loading transactions:", error);
      toast.error(t("toasts.admin.failedToLoadTransactions"));
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
    toast.success(t("toasts.admin.transactionsExported"));
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
    return <PageLoading text={t("admin.transactions.loadingTransactions")} />;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <Button variant="ghost" onClick={() => navigate("/admin")} className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t("admin.transactions.backToAdmin")}
          </Button>

          <h1 className="text-3xl font-bold mb-2">{t("admin.transactions.title")}</h1>
          <p className="text-muted-foreground">
            {t("admin.transactions.subtitle")}
          </p>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <CardTitle>{t("admin.transactions.allTransactions")}</CardTitle>
              {totalCount > 0 && (
                <Badge variant="secondary">
                  {totalCount} {t("admin.transactions.total")}
                </Badge>
              )}
            </div>
            <CardDescription>
              {filteredTransactions.length} {filteredTransactions.length === 1 
                ? t("admin.transactions.transactionsFound", { count: filteredTransactions.length })
                : t("admin.transactions.transactionsFoundPlural", { count: filteredTransactions.length })} {t("admin.transactions.found")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Filters */}
            <div className="flex flex-col md:flex-row gap-4 mb-6">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder={t("admin.transactions.searchPlaceholder")}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>

              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-full md:w-[180px]">
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue placeholder={t("admin.transactions.type")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("admin.transactions.allTypes")}</SelectItem>
                  {transactionTypes.map((type) => (
                    <SelectItem key={type} value={type}>
                      {getTransactionTypeLabel(type)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={walletFilter} onValueChange={setWalletFilter}>
                <SelectTrigger className="w-full md:w-[160px]">
                  <SelectValue placeholder={t("admin.transactions.wallet")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("admin.transactions.allWallets")}</SelectItem>
                  <SelectItem value="deposit">Deposit</SelectItem>
                  <SelectItem value="earnings">Earnings</SelectItem>
                </SelectContent>
              </Select>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full md:w-[160px]">
                  <SelectValue placeholder={t("admin.transactions.status")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("admin.transactions.allStatus")}</SelectItem>
                  <SelectItem value="completed">{t("common.completed")}</SelectItem>
                  <SelectItem value="pending">{t("common.pending")}</SelectItem>
                  <SelectItem value="failed">{t("common.failed")}</SelectItem>
                </SelectContent>
              </Select>

              <Button onClick={exportToCSV} variant="outline">
                <Download className="mr-2 h-4 w-4" />
                {t("admin.transactions.exportCSV")}
              </Button>
            </div>

            {/* Table */}
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("admin.transactions.date")}</TableHead>
                    <TableHead>{t("admin.transactions.user")}</TableHead>
                    <TableHead>{t("admin.transactions.type")}</TableHead>
                    <TableHead>{t("admin.transactions.amount")}</TableHead>
                    <TableHead>{t("admin.transactions.wallet")}</TableHead>
                    <TableHead>{t("admin.transactions.status")}</TableHead>
                    <TableHead>{t("admin.transactions.description")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTransactions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground">
                        {t("admin.transactions.noTransactionsFound")}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredTransactions.map((txn) => (
                      <TableRow key={txn.id}>
                        <TableCell className="whitespace-nowrap">
                          {format(new Date(txn.created_at), "PPp", { locale: dateLocale })}
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

            {/* Loading skeleton for pagination */}
            {loading && (
              <Skeleton className="h-10 w-full mt-4" />
            )}

            {/* Pagination Controls */}
            {!loading && totalPages > 1 && (
              <div className="flex items-center justify-between px-2 mt-4 pt-4 border-t">
                <div className="text-sm text-muted-foreground">
                  {t("admin.transactions.showing")} {((page - 1) * limit) + 1} {t("admin.transactions.to")} {Math.min(page * limit, totalCount)} {t("admin.transactions.of")} {totalCount} {t("admin.transactions.transactions")}
                </div>
                
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious 
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        className={page === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                      />
                    </PaginationItem>
                    
                    {/* Page numbers - show up to 5 pages */}
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      const pageNum = getPageNumber(i, page, totalPages);
                      return (
                        <PaginationItem key={pageNum}>
                          <PaginationLink
                            onClick={() => setPage(pageNum)}
                            isActive={page === pageNum}
                            className="cursor-pointer"
                          >
                            {pageNum}
                          </PaginationLink>
                        </PaginationItem>
                      );
                    })}
                    
                    <PaginationItem>
                      <PaginationNext 
                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                        className={page >= totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Transactions;
