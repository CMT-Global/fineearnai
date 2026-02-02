import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Calendar, DollarSign, Users, Target, ArrowDownCircle } from "lucide-react";
import { format } from "date-fns";
import type { AdminAnalyticsData } from "@/hooks/useAdminAnalytics";

interface InsightsSummaryCardProps {
  analytics: AdminAnalyticsData;
  dateRange: { startDate: string; endDate: string };
}

const getPeriodLabel = (dateRange: { startDate: string; endDate: string }) => {
  const start = new Date(dateRange.startDate);
  const end = new Date(dateRange.endDate);
  const daysDiff = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  
  // Check if it's today
  if (start.getTime() === today.getTime() && end.getTime() === today.getTime()) {
    return "Today";
  }
  
  // Check if it's yesterday
  if (start.getTime() === yesterday.getTime() && end.getTime() === yesterday.getTime()) {
    return "Yesterday";
  }
  
  // Return days count for other ranges
  return `${daysDiff + 1} Days`;
};

export const InsightsSummaryCard = ({ analytics, dateRange }: InsightsSummaryCardProps) => {
  // Find peak days
  const peakUserDay = analytics.userGrowth?.daily_breakdown
    .reduce((max, day) => (day.count > max.count ? day : max), { date: "", count: 0 });
  
  const peakDepositDay = analytics.deposits?.daily_breakdown
    .reduce((max, day) => ((day.volume || 0) > (max.volume || 0) ? day : max), { date: "", volume: 0 });
  
  const peakReferralDay = analytics.referrals?.daily_breakdown
    .reduce((max, day) => (day.count > max.count ? day : max), { date: "", count: 0 });
  
  const peakWithdrawalDay = analytics.withdrawals?.daily_breakdown
    .reduce((max, day) => ((day.volume || 0) > (max.volume || 0) ? day : max), { date: "", volume: 0 });

  // Calculate daily averages
  const daysCount = analytics.userGrowth?.daily_breakdown.length || 1;
  const avgDailyUsers = Math.round((analytics.userGrowth?.last_7days_count || 0) / daysCount);
  const avgDailyDeposits = Math.round((analytics.deposits?.last_7days_volume || 0) / daysCount);
  const avgDailyReferrals = Math.round((analytics.referrals?.last_7days_count || 0) / daysCount);
  const avgDailyWithdrawals = Math.round((analytics.withdrawals?.total_volume || 0) / daysCount);

  // Calculate weekly averages (daily average * 7)
  const avgWeeklyUsers = Math.round(avgDailyUsers * 7);
  const avgWeeklyDeposits = Math.round(avgDailyDeposits * 7);
  const avgWeeklyReferrals = Math.round(avgDailyReferrals * 7);
  const avgWeeklyWithdrawals = Math.round(avgDailyWithdrawals * 7);

  // Calculate totals
  const totalDeposits = analytics.deposits?.last_7days_volume || 0;
  const totalWithdrawals = analytics.withdrawals?.total_volume || 0;

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
    <div className="flex items-start gap-2 sm:gap-3 p-2 sm:p-3 rounded-lg border bg-muted/30 min-w-0">
      <div className={`p-1.5 sm:p-2 rounded-md shrink-0 ${
        color === "success" ? "bg-green-500/10 text-green-600" :
        color === "warning" ? "bg-amber-500/10 text-amber-600" :
        "bg-primary/10 text-primary"
      }`}>
        <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] sm:text-xs font-medium text-muted-foreground break-words line-clamp-2">{label}</p>
        <p className="text-xs sm:text-sm font-bold truncate">{value}</p>
        {subtext && (
          <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 truncate">{subtext}</p>
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
              subtext={peakUserDay?.date ? format(new Date(peakUserDay.date), "EEE, MMM dd, yyyy") : "N/A"}
              color="success"
            />
            <InsightItem
              icon={DollarSign}
              label="Highest Deposits"
              value={`$${(peakDepositDay?.volume || 0).toLocaleString()}`}
              subtext={peakDepositDay?.date ? format(new Date(peakDepositDay.date), "EEE, MMM dd, yyyy") : "N/A"}
              color="success"
            />
            <InsightItem
              icon={Users}
              label="Most Referrals"
              value={`${peakReferralDay?.count || 0} referrals`}
              subtext={peakReferralDay?.date ? format(new Date(peakReferralDay.date), "EEE, MMM dd, yyyy") : "N/A"}
              color="success"
            />
            <InsightItem
              icon={ArrowDownCircle}
              label="Highest Withdrawals"
              value={`$${(peakWithdrawalDay?.volume || 0).toLocaleString()}`}
              subtext={peakWithdrawalDay?.date ? format(new Date(peakWithdrawalDay.date), "EEE, MMM dd, yyyy") : "N/A"}
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
              icon={ArrowDownCircle}
              label="Avg Withdrawals/Day"
              value={`$${avgDailyWithdrawals.toLocaleString()}`}
            />
          </div>
        </div>

        {/* Weekly Averages */}
        <div>
          <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Calendar className="h-4 w-4 text-blue-600" />
            Weekly Averages
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <InsightItem
              icon={Users}
              label="Avg New Users/Week"
              value={`${avgWeeklyUsers}`}
            />
            <InsightItem
              icon={DollarSign}
              label="Avg Deposits/Week"
              value={`$${avgWeeklyDeposits.toLocaleString()}`}
            />
            <InsightItem
              icon={Users}
              label="Avg Referrals/Week"
              value={`${avgWeeklyReferrals}`}
            />
            <InsightItem
              icon={ArrowDownCircle}
              label="Avg Withdrawals/Week"
              value={`$${avgWeeklyWithdrawals.toLocaleString()}`}
            />
          </div>
        </div>

        {/* Period Summary */}
        <div>
          <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-amber-600" />
            Period Summary for {getPeriodLabel(dateRange)}
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <InsightItem
              icon={Users}
              label="Total New Users"
              value={`${analytics.userGrowth?.last_7days_count || 0}`}
              subtext={`${daysCount} days`}
            />
            <InsightItem
              icon={DollarSign}
              label="Total Deposits"
              value={`$${totalDeposits.toLocaleString()}`}
              subtext={`${daysCount} days`}
              color="success"
            />
            <InsightItem
              icon={ArrowDownCircle}
              label="Total Withdrawals"
              value={`$${totalWithdrawals.toLocaleString()}`}
              subtext={`${daysCount} days`}
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
