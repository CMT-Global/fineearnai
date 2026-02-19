import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
import { useReferralAnalytics, type AnalyticsPeriod } from "@/hooks/useReferralAnalytics";
import { ReferralAnalyticsKPIs } from "./ReferralAnalyticsKPIs";
import { ReferralPerformanceChart } from "./ReferralPerformanceChart";
import { ReferralInviteFunnel } from "./ReferralInviteFunnel";
import { ReferralTopContributors } from "./ReferralTopContributors";
import { ReferralCommissionBreakdown } from "./ReferralCommissionBreakdown";

interface ReferralAnalyticsTabProps {
  userId: string;
}

const PERIODS: { value: AnalyticsPeriod; labelKey: string }[] = [
  { value: "today", labelKey: "referrals.analytics.period.today" },
  { value: "7d", labelKey: "referrals.analytics.period.7d" },
  { value: "30d", labelKey: "referrals.analytics.period.30d" },
  { value: "all", labelKey: "referrals.analytics.period.all" },
];

export function ReferralAnalyticsTab({ userId }: ReferralAnalyticsTabProps) {
  const { t } = useTranslation();
  const [period, setPeriod] = useState<AnalyticsPeriod>("7d");
  const { data, isLoading, error } = useReferralAnalytics(userId, period);

  const periodLabel = period;

  if (error) {
    const message = error instanceof Error ? error.message : "Failed to load analytics.";
    return (
      <div className="rounded-lg border border-destructive bg-destructive/15 p-4 text-sm text-destructive space-y-2">
        <p className="font-medium">Analytics failed to load</p>
        <p>{message}</p>
        <p className="text-muted-foreground text-xs mt-2">
          If you just added this feature, run the migration in{" "}
          <code className="bg-muted px-1 rounded">supabase/migrations/20260219140000_get_referral_analytics.sql</code>{" "}
          (Supabase Dashboard → SQL Editor, or <code className="bg-muted px-1 rounded">supabase db push</code>). Check the browser console for details.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Time filter */}
      <div className="flex flex-wrap gap-2">
        {PERIODS.map(({ value, labelKey }) => (
          <button
            key={value}
            type="button"
            onClick={() => setPeriod(value)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              period === value
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            {t(labelKey)}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : data ? (
        <>
          <ReferralAnalyticsKPIs
            teamMembersCount={data.team_members_count}
            activeMembersCount={data.active_members_count}
            taskCommissionsSum={data.task_commissions_sum}
            teamEarningsSum={data.team_earnings_sum}
            avgCommissionPerActive={
              data.active_members_count > 0
                ? data.task_commissions_sum / data.active_members_count
                : null
            }
            projectedWeekly={period === "7d" ? data.task_commissions_sum : null}
            prevTaskCommissions={data.prev_task_commissions_sum}
            prevTeamEarnings={data.prev_team_earnings_sum}
            prevActiveMembers={data.prev_active_members_count}
            periodLabel={periodLabel}
          />

          <ReferralPerformanceChart dailySeries={data.daily_series} periodLabel={periodLabel} />

          <ReferralInviteFunnel
            signupsFromLink={data.signups_from_link}
            upgradedCount={data.upgraded_count}
            conversionRate={data.conversion_rate}
          />

          <ReferralTopContributors topContributors={data.top_contributors} />

          <ReferralCommissionBreakdown earnedTaskCommissions={data.task_commissions_sum} />
        </>
      ) : (
        <div className="rounded-lg border border-border bg-muted/50 p-8 text-center space-y-2">
          <p className="text-sm font-medium text-foreground">{t("referrals.analytics.noData")}</p>
          <p className="text-xs text-muted-foreground">
            If you expected data, ensure the migration <code className="bg-muted px-1 rounded">20260219140000_get_referral_analytics.sql</code> has been run and check the browser console (F12) for errors.
          </p>
        </div>
      )}
    </div>
  );
}
