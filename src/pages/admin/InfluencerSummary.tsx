import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { useTranslation } from "react-i18next";
import { TrendingUp, Calendar, ExternalLink } from "lucide-react";
import { CurrencyDisplay } from "@/components/ui/CurrencyDisplay";

export default function InfluencerSummary() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const { data: rows, isLoading, error, refetch, isRefetching } = useQuery({
    queryKey: ["admin-influencer-summary", dateFrom || null, dateTo || null],
    queryFn: async () => {
      const pDateFrom = dateFrom ? new Date(dateFrom).toISOString() : null;
      const pDateTo = dateTo ? new Date(dateTo + "T23:59:59.999Z").toISOString() : null;
      const { data, error: rpcError } = await (supabase.rpc as (name: string, args: object) => ReturnType<typeof supabase.rpc>)("get_influencer_summary", {
        p_date_from: pDateFrom,
        p_date_to: pDateTo,
      });
      if (rpcError) throw new Error(rpcError.message);
      return (data ?? []) as Array<{
        user_id: string;
        username: string | null;
        email: string | null;
        affiliate_name_country: string | null;
        total_referred: number;
        referred_free: number;
        referred_upgraded: number;
        total_deposits_by_referred: number;
        total_deposit_commissions: number;
        total_task_commissions: number;
        total_withdrawn: number;
        earnings_balance: number;
      }>;
    },
    enabled: true,
  });

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <TrendingUp className="h-7 w-7" />
            {t("admin.influencerSummary.title")}
          </h1>
          <p className="text-muted-foreground mt-1">{t("admin.influencerSummary.subtitle")}</p>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            {t("admin.influencerSummary.dateFilter")}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-4">
          <div className="flex items-center gap-2">
            <Label htmlFor="date-from" className="whitespace-nowrap">{t("admin.influencerSummary.from")}</Label>
            <Input
              id="date-from"
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="date-to" className="whitespace-nowrap">{t("admin.influencerSummary.to")}</Label>
            <Input
              id="date-to"
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {isLoading && (
            <div className="flex justify-center py-12">
              <LoadingSpinner />
            </div>
          )}
          {error && (
            <div className="p-6 space-y-3">
              <p className="text-destructive">
                {error instanceof Error ? error.message : t("admin.influencerSummary.loadError")}
              </p>
              <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isRefetching}>
                {isRefetching ? t("common.loading") : t("admin.influencerSummary.retry")}
              </Button>
            </div>
          )}
          {!isLoading && !error && (
            <div className="overflow-x-auto">
              {!rows?.length ? (
                <p className="p-6 text-muted-foreground">{t("admin.influencerSummary.noInfluencers")}</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-left p-3 font-medium">{t("admin.influencerSummary.user")}</th>
                      <th className="text-left p-3 font-medium">{t("admin.influencerSummary.affiliateName")}</th>
                      <th className="text-right p-3 font-medium">{t("admin.influencerSummary.totalReferred")}</th>
                      <th className="text-right p-3 font-medium">{t("admin.influencerSummary.referredFree")}</th>
                      <th className="text-right p-3 font-medium">{t("admin.influencerSummary.referredUpgraded")}</th>
                      <th className="text-right p-3 font-medium">{t("admin.influencerSummary.depositsByReferred")}</th>
                      <th className="text-right p-3 font-medium">{t("admin.influencerSummary.depositCommissions")}</th>
                      <th className="text-right p-3 font-medium">{t("admin.influencerSummary.taskCommissions")}</th>
                      <th className="text-right p-3 font-medium">{t("admin.influencerSummary.totalWithdrawn")}</th>
                      <th className="text-right p-3 font-medium">{t("admin.influencerSummary.availableBalance")}</th>
                      <th className="p-3 w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => {
                      const num = (v: unknown) => (v != null && v !== "" ? Number(v) : 0);
                      return (
                        <tr key={r.user_id} className="border-b hover:bg-muted/30">
                          <td className="p-3">
                            <div className="font-medium">{r.username ?? "—"}</div>
                            <div className="text-xs text-muted-foreground truncate max-w-[180px]">{r.email ?? "—"}</div>
                          </td>
                          <td className="p-3 text-muted-foreground">{r.affiliate_name_country ?? "—"}</td>
                          <td className="p-3 text-right tabular-nums">{num(r.total_referred)}</td>
                          <td className="p-3 text-right tabular-nums">{num(r.referred_free)}</td>
                          <td className="p-3 text-right tabular-nums">{num(r.referred_upgraded)}</td>
                          <td className="p-3 text-right tabular-nums"><CurrencyDisplay amountUSD={num(r.total_deposits_by_referred)} /></td>
                          <td className="p-3 text-right tabular-nums"><CurrencyDisplay amountUSD={num(r.total_deposit_commissions)} /></td>
                          <td className="p-3 text-right tabular-nums"><CurrencyDisplay amountUSD={num(r.total_task_commissions)} /></td>
                          <td className="p-3 text-right tabular-nums"><CurrencyDisplay amountUSD={num(r.total_withdrawn)} /></td>
                          <td className="p-3 text-right tabular-nums"><CurrencyDisplay amountUSD={num(r.earnings_balance)} /></td>
                          <td className="p-3">
                            <Button variant="ghost" size="sm" onClick={() => navigate(`/admin/users/${r.user_id}`)}>
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
