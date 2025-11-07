import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAdminAnalytics } from "@/hooks/useAdminAnalytics";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, TrendingDown, Users, DollarSign, UserPlus, CreditCard } from "lucide-react";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { format } from "date-fns";

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
            <span className="ml-1">vs yesterday</span>
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
  const { data: analytics, isLoading, error } = useAdminAnalytics();

  return (
    <div className="p-6 space-y-6">
        {/* Page Header */}
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">Analytics Dashboard</h1>
          <p className="text-muted-foreground">
            Monitor platform performance and user activity metrics
          </p>
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
                title="Referrals Today"
                value={analytics.referrals?.today_count || 0}
                icon={UserPlus}
              />
              <StatCard
                title="Plan Upgrades Today"
                value={analytics.planUpgrades?.today_count || 0}
                previousValue={analytics.planUpgrades?.yesterday_count || 0}
                icon={CreditCard}
              />
            </div>

            {/* 7-Day Summary Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    New Users (7 Days)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {analytics.userGrowth?.last_7days_count || 0}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Deposit Volume (7 Days)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    ${(analytics.deposits?.last_7days_volume || 0).toLocaleString()}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Referrals (7 Days)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {analytics.referrals?.last_7days_count || 0}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Upgrade Revenue (7 Days)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    ${(analytics.planUpgrades?.last_7days_volume || 0).toLocaleString()}
                  </div>
                </CardContent>
              </Card>
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
                    <LineChart data={analytics.userGrowth?.daily_breakdown || []}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis 
                        dataKey="date" 
                        tickFormatter={(date) => format(new Date(date), 'MMM dd')}
                        className="text-xs"
                      />
                      <YAxis className="text-xs" />
                      <Tooltip 
                        labelFormatter={(date) => format(new Date(date), 'MMM dd, yyyy')}
                        contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                      />
                      <Legend />
                      <Line 
                        type="monotone" 
                        dataKey="count" 
                        stroke="hsl(var(--primary))" 
                        strokeWidth={2}
                        name="New Users"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Deposit Volume Chart */}
              <Card>
                <CardHeader>
                  <CardTitle>Deposit Volume Trend</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={analytics.deposits?.daily_breakdown || []}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis 
                        dataKey="date" 
                        tickFormatter={(date) => format(new Date(date), 'MMM dd')}
                        className="text-xs"
                      />
                      <YAxis className="text-xs" />
                      <Tooltip 
                        labelFormatter={(date) => format(new Date(date), 'MMM dd, yyyy')}
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
                </CardContent>
              </Card>

              {/* Referrals Chart */}
              <Card>
                <CardHeader>
                  <CardTitle>Referral Activity</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={analytics.referrals?.daily_breakdown || []}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis 
                        dataKey="date" 
                        tickFormatter={(date) => format(new Date(date), 'MMM dd')}
                        className="text-xs"
                      />
                      <YAxis className="text-xs" />
                      <Tooltip 
                        labelFormatter={(date) => format(new Date(date), 'MMM dd, yyyy')}
                        contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                      />
                      <Legend />
                      <Line 
                        type="monotone" 
                        dataKey="count" 
                        stroke="hsl(var(--chart-2))" 
                        strokeWidth={2}
                        name="Referrals"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Plan Upgrades Chart */}
              <Card>
                <CardHeader>
                  <CardTitle>Plan Upgrade Revenue</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={analytics.planUpgrades?.daily_breakdown || []}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis 
                        dataKey="date" 
                        tickFormatter={(date) => format(new Date(date), 'MMM dd')}
                        className="text-xs"
                      />
                      <YAxis className="text-xs" />
                      <Tooltip 
                        labelFormatter={(date) => format(new Date(date), 'MMM dd, yyyy')}
                        formatter={(value: any) => [`$${value.toLocaleString()}`, 'Revenue']}
                        contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                      />
                      <Legend />
                      <Bar 
                        dataKey="volume" 
                        fill="hsl(var(--chart-3))" 
                        name="Revenue"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </>
        )}
    </div>
  );
}
