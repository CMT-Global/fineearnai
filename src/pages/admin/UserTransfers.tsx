import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useLanguageSync } from "@/hooks/useLanguageSync";
import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Search } from "lucide-react";
import { toast } from "sonner";
import { PageLoading } from "@/components/shared/PageLoading";
import { format } from "date-fns";
import { getDateLocale } from "@/lib/date-locale";
import { useLanguage } from "@/contexts/LanguageContext";

interface TransferRow {
  id: string;
  reference_id: string;
  sender_id: string;
  recipient_id: string;
  amount: number;
  currency: string;
  status: string;
  failure_reason: string | null;
  created_at: string;
  completed_at: string | null;
  sender_profile: { full_name: string | null; username: string | null } | null;
  recipient_profile: { full_name: string | null; username: string | null } | null;
}

export default function UserTransfers() {
  const { t } = useTranslation();
  useLanguageSync();
  const { userLanguage } = useLanguage();
  const dateLocale = getDateLocale(userLanguage);
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdmin();
  const navigate = useNavigate();

  const [transfers, setTransfers] = useState<TransferRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (!authLoading && !user) navigate("/login");
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!adminLoading && !isAdmin && user) {
      toast.error(t("toasts.admin.accessDenied"));
      navigate("/dashboard");
    }
  }, [isAdmin, adminLoading, navigate, user, t]);

  useEffect(() => {
    if (isAdmin) loadTransfers();
  }, [isAdmin, statusFilter]);

  const loadTransfers = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from("user_transfers")
        .select(
          `
          id,
          reference_id,
          sender_id,
          recipient_id,
          amount,
          currency,
          status,
          failure_reason,
          created_at,
          completed_at,
          sender_profile:profiles!user_transfers_sender_id_fkey(full_name, username),
          recipient_profile:profiles!user_transfers_recipient_id_fkey(full_name, username)
        `
        )
        .order("created_at", { ascending: false });

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      const { data, error } = await query;

      if (error) throw error;

      setTransfers((data as TransferRow[]) || []);
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Failed to load transfers");
      setTransfers([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredTransfers = transfers.filter((row) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const ref = (row.reference_id || "").toLowerCase();
    const senderName = (row.sender_profile?.full_name || "").toLowerCase();
    const senderUser = (row.sender_profile?.username || "").toLowerCase();
    const recipientName = (row.recipient_profile?.full_name || "").toLowerCase();
    const recipientUser = (row.recipient_profile?.username || "").toLowerCase();
    return (
      ref.includes(q) ||
      senderName.includes(q) ||
      senderUser.includes(q) ||
      recipientName.includes(q) ||
      recipientUser.includes(q)
    );
  });

  const statusBadge = (status: string) => {
    const v = status.toLowerCase();
    if (v === "success") return <Badge className="bg-green-600">{status}</Badge>;
    if (v === "failed") return <Badge variant="destructive">{status}</Badge>;
    return <Badge variant="secondary">{status}</Badge>;
  };

  if (authLoading || adminLoading) {
    return <PageLoading text={t("admin.loading") ?? "Loading..."} />;
  }

  if (!isAdmin) return null;

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold mb-2">
              {t("admin.userTransfers.title") ?? "User Transfers"}
            </h1>
            <p className="text-muted-foreground">
              {t("admin.userTransfers.description") ??
                "Deposit Wallet to Deposit Wallet transfers between users."}
            </p>
          </div>
          <Button variant="outline" onClick={() => navigate("/admin")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t("admin.back") ?? "Back"}
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{t("admin.userTransfers.listTitle") ?? "Transfer history"}</CardTitle>
            <CardDescription>
              {t("admin.userTransfers.listDescription") ?? "Date/time, sender, recipient, amount, status, reference, failure reason."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-4">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={t("admin.userTransfers.searchPlaceholder") ?? "Search by reference or username..."}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder={t("admin.userTransfers.statusFilter") ?? "Status"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("admin.userTransfers.statusAll") ?? "All"}</SelectItem>
                  <SelectItem value="pending">{t("admin.userTransfers.statusPending") ?? "Pending"}</SelectItem>
                  <SelectItem value="success">{t("admin.userTransfers.statusSuccess") ?? "Success"}</SelectItem>
                  <SelectItem value="failed">{t("admin.userTransfers.statusFailed") ?? "Failed"}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("admin.userTransfers.dateTime") ?? "Date/time"}</TableHead>
                    <TableHead>{t("admin.userTransfers.sender") ?? "Sender"}</TableHead>
                    <TableHead>{t("admin.userTransfers.recipient") ?? "Recipient"}</TableHead>
                    <TableHead>{t("admin.userTransfers.amount") ?? "Amount"}</TableHead>
                    <TableHead>{t("admin.userTransfers.status") ?? "Status"}</TableHead>
                    <TableHead>{t("admin.userTransfers.referenceId") ?? "Reference ID"}</TableHead>
                    <TableHead>{t("admin.userTransfers.failureReason") ?? "Failure reason"}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground">
                        {t("admin.loading") ?? "Loading..."}
                      </TableCell>
                    </TableRow>
                  ) : filteredTransfers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground">
                        {t("admin.userTransfers.noTransfers") ?? "No transfers found."}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredTransfers.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="whitespace-nowrap">
                          {format(new Date(row.created_at), "PPp", { locale: dateLocale })}
                        </TableCell>
                        <TableCell>
                          {row.sender_profile?.full_name || "—"} (@{row.sender_profile?.username ?? "—"})
                        </TableCell>
                        <TableCell>
                          {row.recipient_profile?.full_name || "—"} (@{row.recipient_profile?.username ?? "—"})
                        </TableCell>
                        <TableCell>
                          {row.currency} {Number(row.amount).toFixed(2)}
                        </TableCell>
                        <TableCell>{statusBadge(row.status)}</TableCell>
                        <TableCell className="font-mono text-sm">{row.reference_id}</TableCell>
                        <TableCell className="max-w-[200px] truncate text-muted-foreground">
                          {row.failure_reason || "—"}
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
}
