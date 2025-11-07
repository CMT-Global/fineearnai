import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Calendar, DollarSign, Users, Target } from "lucide-react";
import { format } from "date-fns";
import type { AdminAnalyticsData } from "@/hooks/useAdminAnalytics";

interface InsightsSummaryCardProps {
  analytics: AdminAnalyticsData;
  dateRange: { startDate: string; endDate: string };
}

export const InsightsSummaryCard = ({ analytics, dateRange }: InsightsSummaryCardProps) => {
  // Find peak days
  const peakUserDay = analytics.userGrowth?.daily_breakdown
    .reduce((max, day) => (day.count > max.count ? day : max), { date: "", count: 0 });
  
  const peakDepositDay = analytics.deposits?.daily_breakdown
    .reduce((max, day) => ((day.volume || 0) > (max.volume || 0) ? day : max), { date: "", volume: 0 });
  
  const peakReferralDay = analytics.referrals?.daily_breakdown
    .reduce((max, day) => (day.count > max.count ? day : max), { date: "", count: 0 });
  
  const peakUpgradeDay = analytics.planUpgrades?.daily_breakdown
    .reduce((max, day) => ((day.volume || 0) > (max.volume || 0) ? day : max), { date: "", volume: 0 });

  // Calculate averages
  const daysCount = analytics.userGrowth?.daily_breakdown.length || 1;
  const avgDailyUsers = Math.round((analytics.userGrowth?.last_7days_count || 0) / daysCount);
  const avgDailyDeposits = Math.round((analytics.deposits?.last_7days_volume || 0) / daysCount);
  const avgDailyReferrals = Math.round((analytics.referrals?.last_7days_count || 0) / daysCount);
  const avgDailyUpgrades = Math.round((analytics.planUpgrades?.last_7days_volume || 0) / daysCount);

  // Calculate totals
  const totalRevenue = (analytics.deposits?.last_7days_volume || 0) + (analytics.planUpgrades?.last_7days_volume || 0);

  const InsightItem = ({ 
    icon: Icon, 
    label, 
    value, 
    subtext, 
    color = "default" 
  }: { 
    icon: any; 
    label: string; 
    value: string; 
    subtext?: string;
    color?: "default" | "success" | "warning";
  }) => (
    <div className="flex items-start gap-3 p-3 rounded-lg border bg-muted/30">
      <div className={`p-2 rounded-md ${
        color === "success" ? "bg-green-500/10 text-green-600" :
        color === "warning" ? "bg-amber-500/10 text-amber-600" :
        "bg-primary/10 text-primary"
      }`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <p className="text-sm font-bold truncate">{value}</p>
        {subtext && (
          <p className="text-xs text-muted-foreground mt-0.5">{subtext}</p>
        )}
      </div>
    </div>
  );

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            <CardTitle>Key Insights</CardTitle>
          </div>
          <Badge variant="outline" className="text-xs">
            {format(new Date(dateRange.startDate), "MMM dd")} - {format(new Date(dateRange.endDate), "MMM dd")}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Peak Performance Days */}
        <div>
          <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-green-600" />
            Peak Performance Days
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            <InsightItem
              icon={Users}
              label="Most New Users"
              value={`${peakUserDay?.count || 0} users`}
              subtext={peakUserDay?.date ? format(new Date(peakUserDay.date), "MMM dd, yyyy") : "N/A"}
              color="success"
            />
            <InsightItem
              icon={DollarSign}
              label="Highest Deposits"
              value={`$${(peakDepositDay?.volume || 0).toLocaleString()}`}
              subtext={peakDepositDay?.date ? format(new Date(peakDepositDay.date), "MMM dd, yyyy") : "N/A"}
              color="success"
            />
            <InsightItem
              icon={Users}
              label="Most Referrals"
              value={`${peakReferralDay?.count || 0} referrals`}
              subtext={peakReferralDay?.date ? format(new Date(peakReferralDay.date), "MMM dd, yyyy") : "N/A"}
              color="success"
            />
            <InsightItem
              icon={DollarSign}
              label="Top Upgrade Day"
              value={`$${(peakUpgradeDay?.volume || 0).toLocaleString()}`}
              subtext={peakUpgradeDay?.date ? format(new Date(peakUpgradeDay.date), "MMM dd, yyyy") : "N/A"}
              color="success"
            />
          </div>
        </div>

        {/* Daily Averages */}
        <div>
          <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Calendar className="h-4 w-4 text-primary" />
            Daily Averages
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <InsightItem
              icon={Users}
              label="Avg New Users/Day"
              value={`${avgDailyUsers}`}
            />
            <InsightItem
              icon={DollarSign}
              label="Avg Deposits/Day"
              value={`$${avgDailyDeposits.toLocaleString()}`}
            />
            <InsightItem
              icon={Users}
              label="Avg Referrals/Day"
              value={`${avgDailyReferrals}`}
            />
            <InsightItem
              icon={DollarSign}
              label="Avg Upgrades/Day"
              value={`$${avgDailyUpgrades.toLocaleString()}`}
            />
          </div>
        </div>

        {/* Period Summary */}
        <div>
          <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-amber-600" />
            Period Summary
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <InsightItem
              icon={Users}
              label="Total New Users"
              value={`${analytics.userGrowth?.last_7days_count || 0}`}
              subtext={`${daysCount} days`}
            />
            <InsightItem
              icon={DollarSign}
              label="Total Revenue"
              value={`$${totalRevenue.toLocaleString()}`}
              subtext={`Deposits + Upgrades`}
              color="warning"
            />
            <InsightItem
              icon={Users}
              label="Total Referrals"
              value={`${analytics.referrals?.last_7days_count || 0}`}
              subtext={`${daysCount} days`}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
