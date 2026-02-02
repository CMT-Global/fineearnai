import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useLanguage } from "@/contexts/LanguageContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { DollarSign, Users, CheckCircle2, XCircle, Clock, Eye, PlayCircle, Calendar } from "lucide-react";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface WeeklyBonus {
  id: string;
  partner_id: string;
  week_start_date: string;
  week_end_date: string;
  total_weekly_sales: number;
  qualified_tier_id: string | null;
  bonus_percentage: number;
  bonus_amount: number;
  status: string;
  paid_at: string | null;
  transaction_id: string | null;
  created_at: string;
  profiles?: {
    username: string;
    email: string;
  };
  partner_bonus_tiers?: {
    tier_name: string;
  };
}

export default function PartnerBonusPayouts() {
  const { t, i18n: i18nInstance } = useTranslation();
  const { userLanguage, isLoading: isLanguageLoading } = useLanguage();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [weekFilter, setWeekFilter] = useState<string>("all");
  const [selectedBonus, setSelectedBonus] = useState<WeeklyBonus | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  // Force re-render when language changes
  useEffect(() => {
    // Ensure i18n language is synced with userLanguage from context
    if (i18nInstance.language !== userLanguage && !isLanguageLoading) {
      i18nInstance.changeLanguage(userLanguage).catch((err) => {
        console.error('Error changing i18n language:', err);
      });
    }
  }, [userLanguage, isLanguageLoading, i18nInstance]);

  // Fetch weekly bonuses
  const { data: bonuses, isLoading } = useQuery({
    queryKey: ["partner-weekly-bonuses", statusFilter, weekFilter],
    queryFn: async () => {
      let query = supabase
        .from("partner_weekly_bonuses")
        .select(`
          *,
          partner_bonus_tiers(tier_name)
        `)
        .order("created_at", { ascending: false });

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      if (weekFilter !== "all") {
        query = query.eq("week_start_date", weekFilter);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Fetch profiles separately
      if (data && data.length > 0) {
        const partnerIds = [...new Set(data.map(b => b.partner_id))];
        const { data: profilesData } = await supabase
          .from("profiles")
          .select("id, username, email")
          .in("id", partnerIds);

        const profilesMap = new Map(profilesData?.map(p => [p.id, p]) || []);
        
        return data.map(bonus => ({
          ...bonus,
          profiles: profilesMap.get(bonus.partner_id) || { username: "Unknown", email: "" }
        })) as WeeklyBonus[];
      }

      return [];
    },
  });

  // Get unique weeks for filter
  const uniqueWeeks = Array.from(
    new Set(bonuses?.map(b => b.week_start_date) || [])
  ).sort((a, b) => b.localeCompare(a));

  // Calculate statistics
  const stats = {
    totalPending: bonuses?.filter(b => b.status === "calculated").length || 0,
    totalPaid: bonuses?.filter(b => b.status === "paid").length || 0,
    totalAmount: bonuses?.reduce((sum, b) => sum + (b.status === "calculated" ? b.bonus_amount : 0), 0) || 0,
    totalPaidAmount: bonuses?.reduce((sum, b) => sum + (b.status === "paid" ? b.bonus_amount : 0), 0) || 0,
    uniquePartners: new Set(bonuses?.map(b => b.partner_id)).size || 0,
  };

  // Manual trigger calculation
  const triggerCalculationMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("calculate-weekly-bonuses");
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["partner-weekly-bonuses"] });
      toast.success(t("admin.partnerBonusPayouts.toasts.calculationComplete", { count: data.bonuses_calculated }));
    },
    onError: (error: Error) => {
      toast.error(t("admin.partnerBonusPayouts.toasts.calculationFailed", { error: error.message }));
    },
  });

  // Manual trigger payout
  const triggerPayoutMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("process-weekly-bonus-payouts");
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["partner-weekly-bonuses"] });
      toast.success(t("admin.partnerBonusPayouts.toasts.payoutComplete", { count: data.bonuses_paid }));
      if (data.bonuses_failed > 0) {
        toast.warning(t("admin.partnerBonusPayouts.toasts.payoutFailed", { count: data.bonuses_failed }));
      }
    },
    onError: (error: Error) => {
      toast.error(t("admin.partnerBonusPayouts.toasts.payoutProcessFailed", { error: error.message }));
    },
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "paid":
        return <Badge className="bg-success/10 text-success hover:bg-success/20"><CheckCircle2 className="h-3 w-3 mr-1" />{t("admin.partnerBonusPayouts.status.paid")}</Badge>;
      case "calculated":
        return <Badge className="bg-warning/10 text-warning hover:bg-warning/20"><Clock className="h-3 w-3 mr-1" />{t("admin.partnerBonusPayouts.status.ready")}</Badge>;
      case "pending":
        return <Badge variant="outline"><Clock className="h-3 w-3 mr-1" />{t("admin.partnerBonusPayouts.status.pending")}</Badge>;
      case "failed":
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />{t("admin.partnerBonusPayouts.status.failed")}</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const handleViewDetails = (bonus: WeeklyBonus) => {
    setSelectedBonus(bonus);
    setIsDetailsOpen(true);
  };

  return (
    <div className="space-y-6 p-4 sm:p-6 max-w-full overflow-x-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">{t("admin.partnerBonusPayouts.title")}</h1>
            <p className="text-muted-foreground">{t("admin.partnerBonusPayouts.subtitle")}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => triggerCalculationMutation.mutate()}
              disabled={triggerCalculationMutation.isPending}
              className="flex-1 sm:flex-none"
            >
              <PlayCircle className="mr-2 h-4 w-4" />
              {t("admin.partnerBonusPayouts.actions.calculateBonuses")}
            </Button>
            <Button
              onClick={() => triggerPayoutMutation.mutate()}
              disabled={triggerPayoutMutation.isPending || stats.totalPending === 0}
              className="flex-1 sm:flex-none"
            >
              <DollarSign className="mr-2 h-4 w-4" />
              {t("admin.partnerBonusPayouts.actions.processPayouts", { count: stats.totalPending })}
            </Button>
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-5">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t("admin.partnerBonusPayouts.stats.pendingPayouts")}</CardTitle>
              <Clock className="h-4 w-4 text-warning" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalPending}</div>
              <p className="text-xs text-muted-foreground">{t("admin.partnerBonusPayouts.stats.totalAmount", { amount: stats.totalAmount.toFixed(2) })}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t("admin.partnerBonusPayouts.stats.bonusesPaid")}</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-success" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalPaid}</div>
              <p className="text-xs text-muted-foreground">{t("admin.partnerBonusPayouts.stats.thisMonth")}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t("admin.partnerBonusPayouts.stats.totalPaid")}</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${stats.totalPaidAmount.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground">{t("admin.partnerBonusPayouts.stats.allTime")}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t("admin.partnerBonusPayouts.stats.activePartners")}</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.uniquePartners}</div>
              <p className="text-xs text-muted-foreground">{t("admin.partnerBonusPayouts.stats.earningBonuses")}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t("admin.partnerBonusPayouts.stats.avgBonus")}</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ${stats.totalPaid > 0 ? (stats.totalPaidAmount / stats.totalPaid).toFixed(2) : "0.00"}
              </div>
              <p className="text-xs text-muted-foreground">{t("admin.partnerBonusPayouts.stats.perPayout")}</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters and Table */}
        <Card>
          <CardHeader>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <CardTitle>{t("admin.partnerBonusPayouts.weeklyBonuses.title")}</CardTitle>
                <CardDescription>{t("admin.partnerBonusPayouts.weeklyBonuses.description")}</CardDescription>
              </div>
              <div className="flex flex-wrap gap-2">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full sm:w-[150px]">
                    <SelectValue placeholder={t("admin.partnerBonusPayouts.filters.filterByStatus")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("admin.partnerBonusPayouts.filters.allStatuses")}</SelectItem>
                    <SelectItem value="pending">{t("admin.partnerBonusPayouts.status.pending")}</SelectItem>
                    <SelectItem value="calculated">{t("admin.partnerBonusPayouts.status.ready")}</SelectItem>
                    <SelectItem value="paid">{t("admin.partnerBonusPayouts.status.paid")}</SelectItem>
                    <SelectItem value="failed">{t("admin.partnerBonusPayouts.status.failed")}</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={weekFilter} onValueChange={setWeekFilter}>
                  <SelectTrigger className="w-full sm:w-[180px]">
                    <SelectValue placeholder={t("admin.partnerBonusPayouts.filters.filterByWeek")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("admin.partnerBonusPayouts.filters.allWeeks")}</SelectItem>
                    {uniqueWeeks.map((week) => (
                      <SelectItem key={week} value={week}>
                        {format(new Date(week), "MMM d, yyyy")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="text-muted-foreground">{t("admin.partnerBonusPayouts.loading")}</div>
              </div>
            ) : bonuses && bonuses.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("admin.partnerBonusPayouts.table.partner")}</TableHead>
                    <TableHead>{t("admin.partnerBonusPayouts.table.weekPeriod")}</TableHead>
                    <TableHead>{t("admin.partnerBonusPayouts.table.totalSales")}</TableHead>
                    <TableHead>{t("admin.partnerBonusPayouts.table.tier")}</TableHead>
                    <TableHead>{t("admin.partnerBonusPayouts.table.bonusPercent")}</TableHead>
                    <TableHead>{t("admin.partnerBonusPayouts.table.bonusAmount")}</TableHead>
                    <TableHead>{t("admin.partnerBonusPayouts.table.status")}</TableHead>
                    <TableHead className="text-right">{t("admin.partnerBonusPayouts.table.actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bonuses.map((bonus) => (
                    <TableRow key={bonus.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{bonus.profiles?.username}</div>
                          <div className="text-xs text-muted-foreground">{bonus.profiles?.email}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm">
                          <Calendar className="h-3 w-3" />
                          {format(new Date(bonus.week_start_date), "MMM d")} - {format(new Date(bonus.week_end_date), "MMM d, yyyy")}
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">${bonus.total_weekly_sales.toFixed(2)}</TableCell>
                      <TableCell>
                        {bonus.partner_bonus_tiers?.tier_name || "N/A"}
                      </TableCell>
                      <TableCell className="text-primary font-semibold">
                        {(bonus.bonus_percentage * 100).toFixed(2)}%
                      </TableCell>
                      <TableCell className="font-bold text-success">
                        ${bonus.bonus_amount.toFixed(2)}
                      </TableCell>
                      <TableCell>{getStatusBadge(bonus.status)}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewDetails(bonus)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <DollarSign className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">{t("admin.partnerBonusPayouts.noRecords.title")}</h3>
                <p className="text-muted-foreground mb-4">
                  {statusFilter !== "all" || weekFilter !== "all" 
                    ? t("admin.partnerBonusPayouts.noRecords.noMatch")
                    : t("admin.partnerBonusPayouts.noRecords.getStarted")
                  }
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Details Dialog */}
        <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{t("admin.partnerBonusPayouts.details.title")}</DialogTitle>
              <DialogDescription>{t("admin.partnerBonusPayouts.details.description")}</DialogDescription>
            </DialogHeader>
            {selectedBonus && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">{t("admin.partnerBonusPayouts.details.partner")}</p>
                    <p className="font-medium">{selectedBonus.profiles?.username}</p>
                    <p className="text-xs text-muted-foreground">{selectedBonus.profiles?.email}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">{t("admin.partnerBonusPayouts.details.weekPeriod")}</p>
                    <p className="font-medium">
                      {format(new Date(selectedBonus.week_start_date), "MMM d")} - {format(new Date(selectedBonus.week_end_date), "MMM d, yyyy")}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">{t("admin.partnerBonusPayouts.details.totalSales")}</p>
                    <p className="font-medium text-lg">${selectedBonus.total_weekly_sales.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">{t("admin.partnerBonusPayouts.details.qualifiedTier")}</p>
                    <p className="font-medium">{selectedBonus.partner_bonus_tiers?.tier_name || t("common.none")}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">{t("admin.partnerBonusPayouts.details.bonusPercentage")}</p>
                    <p className="font-medium text-primary text-lg">{(selectedBonus.bonus_percentage * 100).toFixed(2)}%</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">{t("admin.partnerBonusPayouts.details.bonusAmount")}</p>
                    <p className="font-bold text-success text-lg">${selectedBonus.bonus_amount.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">{t("admin.partnerBonusPayouts.details.status")}</p>
                    <div className="mt-1">{getStatusBadge(selectedBonus.status)}</div>
                  </div>
                  {selectedBonus.paid_at && (
                    <div>
                      <p className="text-sm text-muted-foreground">{t("admin.partnerBonusPayouts.details.paidAt")}</p>
                      <p className="font-medium">{format(new Date(selectedBonus.paid_at), "MMM d, yyyy HH:mm")}</p>
                    </div>
                  )}
                </div>
                {selectedBonus.transaction_id && (
                  <div className="pt-4 border-t">
                    <p className="text-sm text-muted-foreground">{t("admin.partnerBonusPayouts.details.transactionId")}</p>
                    <p className="font-mono text-xs">{selectedBonus.transaction_id}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
