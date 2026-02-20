import { Card } from "@/components/ui/card";
import { Users, UserPlus, DollarSign, TrendingUp, BarChart3 } from "lucide-react";
import { CurrencyDisplay } from "@/components/ui/CurrencyDisplay";
import { useTranslation } from "react-i18next";

interface ReferralAnalyticsKPIsProps {
  teamMembersCount: number;
  activeMembersCount: number;
  taskCommissionsSum: number;
  teamEarningsSum: number;
  avgCommissionPerActive: number | null;
  projectedWeekly: number | null;
  prevTaskCommissions?: number;
  prevActiveMembers?: number;
  prevTeamEarnings?: number;
  periodLabel: string;
}

function Delta({
  current,
  previous,
  formatter = (n: number) => n.toString(),
}: {
  current: number;
  previous: number;
  formatter?: (n: number) => string;
}) {
  if (previous === 0) return current > 0 ? <span className="text-xs text-green-600 dark:text-green-400">+{formatter(current)}</span> : null;
  const pct = previous ? ((current - previous) / previous) * 100 : 0;
  const isUp = current >= previous;
  return (
    <span className={isUp ? "text-xs text-green-600 dark:text-green-400" : "text-xs text-red-600 dark:text-red-400"}>
      {isUp ? "+" : ""}{pct.toFixed(0)}%
    </span>
  );
}

export function ReferralAnalyticsKPIs({
  teamMembersCount,
  activeMembersCount,
  taskCommissionsSum,
  teamEarningsSum,
  avgCommissionPerActive,
  projectedWeekly,
  prevTaskCommissions = 0,
  prevActiveMembers = 0,
  prevTeamEarnings = 0,
  periodLabel,
}: ReferralAnalyticsKPIsProps) {
  const { t } = useTranslation();
  const showActiveDelta = periodLabel !== "all";
  const showEarningsDelta = periodLabel !== "all" && periodLabel !== "today";
  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
      <Card className="p-4 min-w-0 min-h-[148px]">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-10 w-10 shrink-0 rounded-lg bg-[hsl(var(--wallet-referrals))]/10 flex items-center justify-center">
            <Users className="h-5 w-5 text-[hsl(var(--wallet-referrals))]" />
          </div>
          <div className="min-w-0">
            <p className="text-sm text-muted-foreground">{t("referrals.analytics.kpis.teamMembers")}</p>
            <p className="text-xl font-bold sm:text-2xl">{teamMembersCount}</p>
          </div>
        </div>
      </Card>

      <Card className="p-4 min-w-0 min-h-[148px]">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-10 w-10 shrink-0 rounded-lg bg-[hsl(var(--wallet-tasks))]/10 flex items-center justify-center">
            <UserPlus className="h-5 w-5 text-[hsl(var(--wallet-tasks))]" />
          </div>
          <div className="min-w-0">
            <p className="text-sm text-muted-foreground">{t("referrals.analytics.kpis.activeMembers")}</p>
            <p className="text-xl font-bold sm:text-2xl">{activeMembersCount}</p>
            <div className="h-4">
              {showActiveDelta ? (
                <Delta current={activeMembersCount} previous={prevActiveMembers} />
              ) : (
                <span className="invisible text-xs">placeholder</span>
              )}
            </div>
          </div>
        </div>
      </Card>

      <Card className="p-4 min-w-0 min-h-[148px]">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-10 w-10 shrink-0 rounded-lg bg-[hsl(var(--wallet-deposit))]/10 flex items-center justify-center">
            <TrendingUp className="h-5 w-5 text-[hsl(var(--wallet-deposit))]" />
          </div>
          <div className="min-w-0">
            <p className="text-sm text-muted-foreground">{t("referrals.analytics.kpis.taskCommissions")}</p>
            <p className="text-xl font-bold break-words sm:text-2xl">
              <CurrencyDisplay amountUSD={taskCommissionsSum} />
            </p>
            <div className="h-4">
              {showEarningsDelta ? (
                <Delta
                  current={taskCommissionsSum}
                  previous={prevTaskCommissions}
                  formatter={(n) => `$${n.toFixed(2)}`}
                />
              ) : (
                <span className="invisible text-xs">placeholder</span>
              )}
            </div>
          </div>
        </div>
      </Card>

      <Card className="p-4 min-w-0 min-h-[148px]">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-10 w-10 shrink-0 rounded-lg bg-[hsl(var(--wallet-earnings))]/10 flex items-center justify-center">
            <DollarSign className="h-5 w-5 text-[hsl(var(--wallet-earnings))]" />
          </div>
          <div className="min-w-0">
            <p className="text-sm text-muted-foreground">{t("referrals.analytics.kpis.teamEarnings")}</p>
            <p className="text-xl font-bold break-words sm:text-2xl">
              <CurrencyDisplay amountUSD={teamEarningsSum} />
            </p>
            <div className="h-4">
              {showEarningsDelta ? (
                <Delta
                  current={teamEarningsSum}
                  previous={prevTeamEarnings}
                  formatter={(n) => `$${n.toFixed(2)}`}
                />
              ) : (
                <span className="invisible text-xs">placeholder</span>
              )}
            </div>
          </div>
        </div>
      </Card>

      <Card className="p-4 min-w-0 min-h-[148px]">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-10 w-10 shrink-0 rounded-lg bg-muted flex items-center justify-center">
            <BarChart3 className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="min-w-0">
            <p className="text-sm text-muted-foreground">{t("referrals.analytics.kpis.avgCommissionPerActive")}</p>
            <p className="text-xl font-bold break-words sm:text-2xl">
              {avgCommissionPerActive != null ? <CurrencyDisplay amountUSD={avgCommissionPerActive} /> : "—"}
            </p>
          </div>
        </div>
      </Card>

      <Card className="p-4 min-w-0 min-h-[148px]">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-10 w-10 shrink-0 rounded-lg bg-[hsl(var(--wallet-deposit))]/10 flex items-center justify-center">
            <TrendingUp className="h-5 w-5 text-[hsl(var(--wallet-deposit))]" />
          </div>
          <div className="min-w-0">
            <p className="text-sm text-muted-foreground">{t("referrals.analytics.kpis.projectedWeekly")}</p>
            <p className="text-xl font-bold break-words sm:text-2xl">
              {projectedWeekly != null ? <CurrencyDisplay amountUSD={projectedWeekly} /> : "—"}
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
