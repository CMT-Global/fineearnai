import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Mail, RefreshCw, UserPlus, Search, Download } from "lucide-react";
import { PageLoading } from "@/components/shared/PageLoading";
import { useTranslation } from "react-i18next";
import { useLanguageSync } from "@/hooks/useLanguageSync";
import { useDebounce } from "@/hooks/useDebounce";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type InviteRequestStatus = "pending_email_verification" | "verified" | "invite_sent";

interface InviteRequestRow {
  id: string;
  full_name: string;
  email: string;
  country: string | null;
  country_code: string | null;
  status: InviteRequestStatus;
  email_verified_at: string | null;
  invite_sent_at: string | null;
  requested_at: string;
  assigned_referral_code: string | null;
  request_ip: string | null;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function statusLabel(s: InviteRequestStatus): string {
  switch (s) {
    case "pending_email_verification":
      return "Pending verification";
    case "verified":
      return "Verified";
    case "invite_sent":
      return "Invite sent";
    default:
      return s;
  }
}

export default function InviteRequests() {
  const { t } = useTranslation();
  useLanguageSync();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [countryFilter, setCountryFilter] = useState<string>("all");
  const debouncedSearch = useDebounce(searchTerm.trim().toLowerCase(), 500);

  const { data: rows, isLoading } = useQuery({
    queryKey: ["admin-invite-requests"],
    queryFn: async (): Promise<InviteRequestRow[]> => {
      const { data, error } = await supabase
        .from("invite_requests")
        .select("id, full_name, email, country, country_code, status, email_verified_at, invite_sent_at, requested_at, assigned_referral_code, request_ip")
        .order("requested_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as InviteRequestRow[];
    },
  });

  const countries = useMemo(() => {
    if (!rows?.length) return [] as { value: string; label: string }[];
    const seen = new Set<string>();
    const list: { value: string; label: string }[] = [];
    for (const r of rows) {
      const country = r.country ?? r.country_code ?? null;
      if (country && !seen.has(country)) {
        seen.add(country);
        list.push({ value: country, label: (r.country || r.country_code) ?? country });
      }
    }
    return list.sort((a, b) => a.label.localeCompare(b.label));
  }, [rows]);

  const filteredRows = useMemo(() => {
    if (!rows) return [];
    return rows.filter((r) => {
      if (debouncedSearch) {
        const name = (r.full_name ?? "").toLowerCase();
        const email = (r.email ?? "").toLowerCase();
        const referralCode = (r.assigned_referral_code ?? "").toLowerCase();
        if (!name.includes(debouncedSearch) && !email.includes(debouncedSearch) && !referralCode.includes(debouncedSearch)) return false;
      }
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      const country = r.country ?? r.country_code ?? "";
      if (countryFilter !== "all" && country !== countryFilter) return false;
      return true;
    });
  }, [rows, debouncedSearch, statusFilter, countryFilter]);

  const handleExportAll = () => {
    if (filteredRows.length === 0) return;
    const headers = ["Name", "Email", "Country", "Status", "Requested", "Verified", "Invite sent", "Referrer code"];
    const csvRows = [
      headers.join(","),
      ...filteredRows.map((r) =>
        [
          `"${(r.full_name ?? "").replace(/"/g, '""')}"`,
          `"${(r.email ?? "").replace(/"/g, '""')}"`,
          `"${(r.country ?? r.country_code ?? "").replace(/"/g, '""')}"`,
          statusLabel(r.status),
          formatDate(r.requested_at),
          formatDate(r.email_verified_at),
          formatDate(r.invite_sent_at),
          r.assigned_referral_code ?? "",
        ].join(",")
      ),
    ];
    const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `invite-requests-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const resendOtpMutation = useMutation({
    mutationFn: async (inviteRequestId: string) => {
      const { data, error } = await supabase.functions.invoke("resend-invite-otp", {
        body: { invite_request_id: inviteRequestId },
      });
      if (error) throw new Error(error.message);
      const err = (data as { error?: string })?.error;
      if (err) throw new Error(err);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-invite-requests"] });
      toast.success(t("admin.inviteRequests.otpResent"));
    },
    onError: (e: Error) => {
      toast.error(t("admin.inviteRequests.resendFailed", { message: e.message }));
    },
  });

  const resendEmailMutation = useMutation({
    mutationFn: async (inviteRequestId: string) => {
      const { data, error } = await supabase.functions.invoke("resend-invite-email", {
        body: { invite_request_id: inviteRequestId },
      });
      const serverError = (data as { error?: string } | null)?.error;
      if (serverError) throw new Error(serverError);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-invite-requests"] });
      toast.success(t("admin.inviteRequests.inviteResent"));
    },
    onError: (e: Error) => {
      toast.error(t("admin.inviteRequests.resendFailed", { message: e.message }));
    },
  });

  if (isLoading) return <PageLoading text={t("admin.inviteRequests.loading")} />;

  return (
    <div className="container mx-auto px-4 py-6 max-w-7xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <UserPlus className="h-8 w-8" />
          {t("admin.inviteRequests.title")}
        </h1>
        <p className="text-muted-foreground mt-1">{t("admin.inviteRequests.subtitle")}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("admin.inviteRequests.tableTitle")}</CardTitle>
          <CardDescription>{t("admin.inviteRequests.tableDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
              <Input
                placeholder={t("admin.inviteRequests.searchPlaceholder")}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 h-12 text-base"
              />
            </div>
          </div>
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-[180px]">
                <SelectValue placeholder={t("admin.inviteRequests.filters.status.label")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("admin.inviteRequests.filters.status.all")}</SelectItem>
                <SelectItem value="pending_email_verification">{t("admin.inviteRequests.filters.status.pending_email_verification")}</SelectItem>
                <SelectItem value="verified">{t("admin.inviteRequests.filters.status.verified")}</SelectItem>
                <SelectItem value="invite_sent">{t("admin.inviteRequests.filters.status.invite_sent")}</SelectItem>
              </SelectContent>
            </Select>
            <Select value={countryFilter} onValueChange={setCountryFilter}>
              <SelectTrigger className="w-full md:w-[200px]">
                <SelectValue placeholder={t("admin.inviteRequests.filters.country.label")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("admin.inviteRequests.filters.country.all")}</SelectItem>
                {countries.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportAll}
              disabled={filteredRows.length === 0}
            >
              <Download className="h-4 w-4 mr-2" />
              {t("admin.inviteRequests.exportAll")}
            </Button>
          </div>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-left whitespace-nowrap">Name</TableHead>
                  <TableHead className="text-left whitespace-nowrap">Email</TableHead>
                  <TableHead className="text-left whitespace-nowrap">Country</TableHead>
                  <TableHead className="text-left whitespace-nowrap">Status</TableHead>
                  <TableHead className="text-left whitespace-nowrap">Requested</TableHead>
                  <TableHead className="text-left whitespace-nowrap">Verified</TableHead>
                  <TableHead className="text-left whitespace-nowrap">Invite sent</TableHead>
                  <TableHead className="text-left whitespace-nowrap">Referrer code</TableHead>
                  <TableHead className="text-right whitespace-nowrap">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRows.map((r) => (
                  <TableRow key={r.id} className="hover:bg-muted/50">
                    <TableCell className="text-left font-medium whitespace-nowrap">{r.full_name}</TableCell>
                    <TableCell className="text-left whitespace-nowrap">
                      <span className="text-sm">{r.email}</span>
                    </TableCell>
                    <TableCell className="text-left whitespace-nowrap">{r.country ?? r.country_code ?? "—"}</TableCell>
                    <TableCell className="text-left whitespace-nowrap">
                      <Badge
                        variant={r.status === "invite_sent" ? "default" : "secondary"}
                        className="inline-flex"
                      >
                        {statusLabel(r.status)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-left text-muted-foreground text-sm whitespace-nowrap">{formatDate(r.requested_at)}</TableCell>
                    <TableCell className="text-left text-muted-foreground text-sm whitespace-nowrap">{formatDate(r.email_verified_at)}</TableCell>
                    <TableCell className="text-left text-muted-foreground text-sm whitespace-nowrap">{formatDate(r.invite_sent_at)}</TableCell>
                    <TableCell className="text-left font-mono text-xs whitespace-nowrap">{r.assigned_referral_code ?? "—"}</TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      {r.status === "pending_email_verification" && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={resendOtpMutation.isPending && resendOtpMutation.variables === r.id}
                          onClick={() => resendOtpMutation.mutate(r.id)}
                        >
                          {resendOtpMutation.isPending && resendOtpMutation.variables === r.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                          <span className="ml-1">Resend OTP</span>
                        </Button>
                      )}
                      {(r.status === "verified" || r.status === "invite_sent") && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={resendEmailMutation.isPending && resendEmailMutation.variables === r.id}
                          onClick={() => resendEmailMutation.mutate(r.id)}
                        >
                          {resendEmailMutation.isPending && resendEmailMutation.variables === r.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                          <span className="ml-1">Resend invite</span>
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {filteredRows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                      {t("admin.inviteRequests.noRequests")}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
