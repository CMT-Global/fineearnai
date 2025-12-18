import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAdminAnalytics, DateRange } from "@/hooks/useAdminAnalytics";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, TrendingDown, Users, DollarSign, UserPlus, ArrowDownCircle } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { format, subDays } from "date-fns";
import { DateRangeSelector } from "@/components/admin/DateRangeSelector";
import { ComparisonPresetSelector, type ComparisonPreset } from "@/components/admin/ComparisonPresetSelector";
import { InsightsSummaryCard } from "@/components/admin/InsightsSummaryCard";
import { CountrySegmentationCard } from "@/components/admin/CountrySegmentationCard";
import { TopReferrersCard } from "@/components/admin/TopReferrersCard";

const StatCard = ({ 
  title, 
  value, 
  previousValue, 
  icon: Icon, 
  prefix = "" 
}: { 
  title: string; 
  value: number; 
  previousValue?: number; 
  icon: any; 
  prefix?: string;
}) => {
  const percentChange = previousValue && previousValue > 0 
    ? ((value - previousValue) / previousValue) * 100 
    : 0;
  
  const isPositive = percentChange >= 0;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{prefix}{value.toLocaleString()}</div>
        {previousValue !== undefined && (
          <div className="flex items-center text-xs text-muted-foreground mt-1">
            {isPositive ? (
              <TrendingUp className="h-3 w-3 text-green-500 mr-1" />
            ) : (
              <TrendingDown className="h-3 w-3 text-red-500 mr-1" />
            )}
            <span className={isPositive ? "text-green-500" : "text-red-500"}>
              {Math.abs(percentChange).toFixed(1)}%
            </span>
            <span className="ml-1">
              vs yesterday <span className="text-[10px]">({prefix}{previousValue.toLocaleString()})</span>
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

const LoadingSkeleton = () => (
  <div className="space-y-6">
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {[...Array(4)].map((_, i) => (
        <Card key={i}>
          <CardHeader className="space-y-0 pb-2">
            <Skeleton className="h-4 w-[120px]" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-8 w-[100px]" />
            <Skeleton className="h-3 w-[80px] mt-2" />
          </CardContent>
        </Card>
      ))}
    </div>
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-[150px]" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[300px] w-full" />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-[150px]" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[300px] w-full" />
        </CardContent>
      </Card>
    </div>
  </div>
);

export default function AdminAnalyticsDashboard() {
  // Initialize with last 7 days
  const [dateRange, setDateRange] = useState<DateRange>({
    startDate: format(subDays(new Date(), 6), "yyyy-MM-dd"),
    endDate: format(new Date(), "yyyy-MM-dd"),
  });
  const [selectedPreset, setSelectedPreset] = useState<string>("Last 7 Days vs Previous 7");

  const { data: analytics, isLoading, error } = useAdminAnalytics(dateRange);

  const handlePresetSelect = (preset: ComparisonPreset) => {
    setDateRange({
      startDate: preset.startDate,
      endDate: preset.endDate,
    });
    setSelectedPreset(preset.label);
  };

  // Utility to reverse data chronologically (oldest to newest, left to right)
  const reverseChronologically = (data: any[]) => {
    return [...data].reverse();
  };

  return (
    <div className="p-6 space-y-6">
        {/* Page Header */}
        <div className="space-y-4">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold tracking-tight">Analytics Dashboard</h1>
            <p className="text-muted-foreground">
              Monitor platform performance and user activity metrics
            </p>
          </div>
          
          {/* Date Range Selector */}
          <DateRangeSelector value={dateRange} onChange={setDateRange} />
          
          {/* Quick Comparison Presets */}
          <ComparisonPresetSelector 
            onPresetSelect={handlePresetSelect}
            selectedPreset={selectedPreset}
          />
        </div>
        {error && (
          <Alert variant="destructive">
            <AlertDescription>
              Failed to load analytics data: {error.message}
            </AlertDescription>
          </Alert>
        )}

        {isLoading && <LoadingSkeleton />}

        {!isLoading && analytics && (
          <>
            {/* Insights Summary Card */}
            <InsightsSummaryCard analytics={analytics} dateRange={dateRange} />

            {/* KPI Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <StatCard
                title="New Users Today"
                value={analytics.userGrowth?.today_count || 0}
                previousValue={analytics.userGrowth?.yesterday_count || 0}
                icon={Users}
              />
              <StatCard
                title="Deposits Today"
                value={analytics.deposits?.today_volume || 0}
                previousValue={analytics.deposits?.yesterday_volume || 0}
                icon={DollarSign}
                prefix="$"
              />
              <StatCard
                title="New Referrals Today"
                value={analytics.referrals?.today_count || 0}
                previousValue={analytics.referrals?.yesterday_count || 0}
                icon={UserPlus}
              />
              <StatCard
                title="Withdrawals Today"
                value={analytics.withdrawals?.today_volume || 0}
                previousValue={analytics.withdrawals?.yesterday_volume || 0}
                icon={ArrowDownCircle}
                prefix="$"
              />
            </div>
            {/* Charts */}
            <div className="grid gap-4 md:grid-cols-2">
              {/* User Growth Chart */}
              <Card>
                <CardHeader>
                  <CardTitle>User Growth Trend</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={reverseChronologically(analytics.userGrowth?.daily_breakdown || [])}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis 
                        dataKey="date" 
                        tickFormatter={(date) => format(new Date(date), 'EEE, MMM dd')}
                        className="text-xs"
                      />
                      <YAxis className="text-xs" />
                      <Tooltip 
                        labelFormatter={(date) => format(new Date(date), 'EEE, MMM dd, yyyy')}
                        contentStyle={{ backgroundColor: '#123630', border: 'none', borderRadius: '8px', color: '#EAF4F2' }}
                      />
                      <Legend />
                      <Bar 
                        dataKey="count" 
                        fill="hsl(var(--primary))" 
                        name="New Users"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                  <p className="text-sm text-muted-foreground mt-3">
                    Daily count of new user registrations over the selected period. Track user acquisition trends and identify high-growth days.
                  </p>
                </CardContent>
              </Card>

              {/* Deposit Volume Chart */}
              <Card>
                <CardHeader>
                  <CardTitle>Deposit Volume Trend</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={reverseChronologically(analytics.deposits?.daily_breakdown || [])}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis 
                        dataKey="date" 
                        tickFormatter={(date) => format(new Date(date), 'EEE, MMM dd')}
                        className="text-xs"
                      />
                      <YAxis className="text-xs" />
                      <Tooltip 
                        labelFormatter={(date) => format(new Date(date), 'EEE, MMM dd, yyyy')}
                        formatter={(value: any) => [`$${value.toLocaleString()}`, 'Volume']}
                        contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                      />
                      <Legend />
                      <Bar 
                        dataKey="volume" 
                        fill="hsl(var(--primary))" 
                        name="Volume"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                  <p className="text-sm text-muted-foreground mt-3">
                    Total deposit amounts (in USD) per day over the selected period. Monitor revenue trends and identify peak deposit days.
                  </p>
                </CardContent>
              </Card>

              {/* Referrals Chart */}
              <Card>
                <CardHeader>
                  <CardTitle>Referral Activity</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={reverseChronologically(analytics.referrals?.daily_breakdown || [])}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis 
                        dataKey="date" 
                        tickFormatter={(date) => format(new Date(date), 'EEE, MMM dd')}
                        className="text-xs"
                      />
                      <YAxis className="text-xs" />
                      <Tooltip 
                        labelFormatter={(date) => format(new Date(date), 'EEE, MMM dd, yyyy')}
                        contentStyle={{ backgroundColor: '#123630', border: 'none', borderRadius: '8px', color: '#EAF4F2' }}
                      />
                      <Legend />
                      <Bar 
                        dataKey="count" 
                        fill="hsl(var(--chart-2))" 
                        name="Referrals"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                  <p className="text-sm text-muted-foreground mt-3">
                    Daily count of new referrals (users who joined via referral links) over the selected period. Measure referral program effectiveness.
                  </p>
                </CardContent>
              </Card>

              {/* Deposits vs Withdrawals Chart */}
              <Card>
                <CardHeader>
                  <CardTitle>Deposits vs Withdrawals</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={reverseChronologically(
                      (analytics.deposits?.daily_breakdown || []).map((depositDay) => ({
                        date: depositDay.date,
                        deposits: depositDay.volume || 0,
                        withdrawals: analytics.withdrawals?.daily_breakdown.find(w => w.date === depositDay.date)?.volume || 0
                      }))
                    )}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis 
                        dataKey="date" 
                        tickFormatter={(date) => format(new Date(date), 'EEE, MMM dd')}
                        className="text-xs"
                      />
                      <YAxis className="text-xs" />
                      <Tooltip 
                        labelFormatter={(date) => format(new Date(date), 'EEE, MMM dd, yyyy')}
                        formatter={(value: any, name: string) => [
                          `$${Number(value).toLocaleString()}`, 
                          name === 'deposits' ? 'Deposits' : 'Withdrawals'
                        ]}
                        contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                      />
                      <Legend />
                      <Bar 
                        dataKey="deposits" 
                        fill="hsl(var(--chart-1))" 
                        name="Deposits"
                        radius={[4, 4, 0, 0]}
                      />
                      <Bar 
                        dataKey="withdrawals" 
                        fill="hsl(var(--chart-4))" 
                        name="Withdrawals"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                  <p className="text-sm text-muted-foreground mt-3">
                    Daily comparison of deposit inflows vs withdrawal outflows (in USD). Monitor cash flow balance and identify liquidity trends.
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* User Segmentation Section */}
            <div className="space-y-4">
              <div className="space-y-1">
                <h2 className="text-2xl font-bold tracking-tight">User Segmentation & High-Value Analysis</h2>
                <p className="text-muted-foreground">
                  Identify high-value user segments by geographic distribution and top referrer performance
                </p>
              </div>
              
              <div className="grid gap-4 md:grid-cols-2">
                <CountrySegmentationCard data={analytics.countryStats} dateRange={dateRange} />
                <TopReferrersCard data={analytics.topReferrers} dateRange={dateRange} />
              </div>
            </div>
          </>
        )}
    </div>
  );
}
