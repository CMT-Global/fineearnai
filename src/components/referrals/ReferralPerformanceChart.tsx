import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useTranslation } from "react-i18next";
import type { ReferralAnalyticsDailyPoint } from "@/hooks/useReferralAnalytics";

type ChartMetric = "commissions" | "team_earnings" | "active_members";

interface ReferralPerformanceChartProps {
  dailySeries: ReferralAnalyticsDailyPoint[];
  periodLabel: string;
}

function formatDay(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  } catch {
    return dateStr;
  }
}

export function ReferralPerformanceChart({ dailySeries, periodLabel }: ReferralPerformanceChartProps) {
  const { t } = useTranslation();
  const [metric, setMetric] = useState<ChartMetric>("commissions");

  const chartData = dailySeries.map((d) => ({
    ...d,
    day: formatDay(d.date),
    value:
      metric === "commissions"
        ? Number(d.commission_amount)
        : metric === "team_earnings"
          ? Number(d.team_earnings)
          : Number(d.active_count),
  }));

  const totalLabel =
    metric === "commissions"
      ? t("referrals.analytics.chart.commissions")
      : metric === "team_earnings"
        ? t("referrals.analytics.chart.teamEarnings")
        : t("referrals.analytics.chart.activeMembers");

  return (
    <Card>
      <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle>{t("referrals.analytics.chart.title")}</CardTitle>
        <div className="flex gap-1 rounded-md bg-muted p-1">
          {(["commissions", "team_earnings", "active_members"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMetric(m)}
              className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
                metric === m ? "bg-background text-foreground shadow" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {m === "commissions"
                ? t("referrals.analytics.chart.commissions")
                : m === "team_earnings"
                  ? t("referrals.analytics.chart.teamEarnings")
                  : t("referrals.analytics.chart.activeMembers")}
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        {chartData.length === 0 ? (
          <div className="flex h-[240px] items-center justify-center text-sm text-muted-foreground">
            {t("referrals.analytics.chart.noData")}
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="day" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip
                formatter={(value: number) =>
                  metric === "active_members" ? [value, totalLabel] : ["$" + Number(value).toFixed(2), totalLabel]
                }
                labelFormatter={(label) => label}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke="hsl(var(--wallet-deposit))"
                strokeWidth={2}
                dot={{ r: 3 }}
                name={totalLabel}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
