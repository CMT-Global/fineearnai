import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { DollarSign, TrendingUp, Users, Award, CheckCircle, Mail, PieChart as PieChartIcon } from "lucide-react";
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function PartnerBonusMonitoring() {
  const currentMonth = new Date();
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);

  // Fetch bonus metrics
  const { data: metrics, isLoading: metricsLoading } = useQuery({
    queryKey: ["bonus-monitoring-metrics", format(monthStart, 'yyyy-MM-dd')],
    queryFn: async () => {
      // Get this month's bonuses
      const { data: bonuses, error } = await supabase
        .from("partner_weekly_bonuses")
        .select(`
          *,
          partner_bonus_tiers(tier_name)
        `)
        .gte('week_start_date', format(monthStart, 'yyyy-MM-dd'))
        .lte('week_end_date', format(monthEnd, 'yyyy-MM-dd'));

      if (error) throw error;

      // Calculate metrics
      const paidBonuses = bonuses.filter(b => b.status === 'paid');
      const totalPaid = paidBonuses.reduce((sum, b) => sum + Number(b.bonus_amount), 0);
      const uniquePartners = new Set(bonuses.map(b => b.partner_id)).size;
      const avgBonus = uniquePartners > 0 ? totalPaid / uniquePartners : 0;
      
      const totalBonuses = bonuses.length;
      const successRate = totalBonuses > 0 ? (paidBonuses.length / totalBonuses) * 100 : 0;

      // Tier distribution
      const tierCounts = bonuses.reduce((acc: any, b) => {
        const tier = b.partner_bonus_tiers?.tier_name || 'No Tier';
        acc[tier] = (acc[tier] || 0) + 1;
        return acc;
      }, {});

      return {
        totalPaid,
        avgBonus,
        uniquePartners,
        totalBonuses,
        paidCount: paidBonuses.length,
        calculatedCount: bonuses.filter(b => b.status === 'calculated').length,
        pendingCount: bonuses.filter(b => b.status === 'pending').length,
        failedCount: bonuses.filter(b => b.status === 'failed').length,
        successRate,
        tierDistribution: Object.entries(tierCounts).map(([name, value]) => ({
          name,
          value
        })),
      };
    },
  });

  // Fetch top partners
  const { data: topPartners, isLoading: partnersLoading } = useQuery({
    queryKey: ["bonus-top-partners", format(monthStart, 'yyyy-MM-dd')],
    queryFn: async () => {
      const { data: bonuses, error } = await supabase
        .from("partner_weekly_bonuses")
        .select("partner_id, bonus_amount")
        .eq('status', 'paid')
        .gte('week_start_date', format(monthStart, 'yyyy-MM-dd'))
        .lte('week_end_date', format(monthEnd, 'yyyy-MM-dd'));

      if (error) throw error;

      // Group by partner
      const partnerTotals = bonuses.reduce((acc: any, b) => {
        const id = b.partner_id;
        if (!acc[id]) {
          acc[id] = {
            partner_id: id,
            total_bonus: 0,
          };
        }
        acc[id].total_bonus += Number(b.bonus_amount);
        return acc;
      }, {});

      // Get unique partner IDs
      const partnerIds = Object.keys(partnerTotals);

      // Fetch profile data separately
      const { data: profiles, error: profileError } = await supabase
        .from("profiles")
        .select("id, username, email")
        .in('id', partnerIds);

      if (profileError) throw profileError;

      // Merge profile data with totals
      const profileMap = profiles.reduce((acc: any, p) => {
        acc[p.id] = p;
        return acc;
      }, {});

      return Object.entries(partnerTotals)
        .map(([id, data]: [string, any]) => ({
          partner_id: id,
          username: profileMap[id]?.username || 'Unknown',
          email: profileMap[id]?.email || 'N/A',
          total_bonus: data.total_bonus,
        }))
        .sort((a: any, b: any) => b.total_bonus - a.total_bonus)
        .slice(0, 10);
    },
  });

  // Fetch weekly trend
  const { data: weeklyTrend, isLoading: trendLoading } = useQuery({
    queryKey: ["bonus-weekly-trend"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("partner_weekly_bonuses")
        .select("week_start_date, bonus_amount, status")
        .eq('status', 'paid')
        .gte('week_start_date', format(new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'))
        .order('week_start_date', { ascending: true });

      if (error) throw error;

      // Group by week
      const weeklyData = data.reduce((acc: any, item) => {
        const week = item.week_start_date;
        if (!acc[week]) {
          acc[week] = { week, total: 0, count: 0 };
        }
        acc[week].total += Number(item.bonus_amount);
        acc[week].count += 1;
        return acc;
      }, {});

      return Object.values(weeklyData).map((w: any) => ({
        week: format(new Date(w.week), 'MMM dd'),
        total: w.total,
        count: w.count,
        average: w.count > 0 ? w.total / w.count : 0,
      }));
    },
  });

  // Fetch email delivery stats
  const { data: emailStats, isLoading: emailLoading } = useQuery({
    queryKey: ["bonus-email-stats", format(monthStart, 'yyyy-MM-dd')],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("email_logs")
        .select("status, sent_at")
        .or(`template_id.eq.${null},metadata->template_type.like.%bonus%,metadata->template_type.like.%partner%`)
        .gte('sent_at', monthStart.toISOString())
        .lte('sent_at', monthEnd.toISOString());

      if (error) throw error;

      const sent = data.filter(e => e.status === 'sent').length;
      const failed = data.filter(e => e.status === 'failed').length;
      const total = data.length;
      const deliveryRate = total > 0 ? (sent / total) * 100 : 0;

      return { sent, failed, total, deliveryRate };
    },
  });

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

  if (metricsLoading || partnersLoading || trendLoading || emailLoading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-8 w-64 mb-2" />
            <Skeleton className="h-4 w-96" />
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-4 rounded-full" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-32 mb-1" />
                <Skeleton className="h-3 w-40" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Bonus System Monitoring</h1>
          <p className="text-muted-foreground">
            Real-time metrics and analytics for {format(currentMonth, 'MMMM yyyy')}
          </p>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Bonuses Paid</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${metrics?.totalPaid.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">
              {metrics?.paidCount} bonuses paid this month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Per Partner</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${metrics?.avgBonus.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">
              Across {metrics?.uniquePartners} active partners
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Payout Success Rate</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.successRate.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">
              {metrics?.paidCount} of {metrics?.totalBonuses} bonuses
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Email Delivery Rate</CardTitle>
            <Mail className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{emailStats?.deliveryRate.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">
              {emailStats?.sent} of {emailStats?.total} emails sent
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Status Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Bonus Status Breakdown</CardTitle>
          <CardDescription>Current status of all bonuses this month</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-4">
            <div className="text-center p-4 bg-green-50 dark:bg-green-950 rounded-lg">
              <div className="text-2xl font-bold text-green-700 dark:text-green-300">{metrics?.paidCount}</div>
              <div className="text-sm text-green-600 dark:text-green-400">Paid</div>
            </div>
            <div className="text-center p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
              <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">{metrics?.calculatedCount}</div>
              <div className="text-sm text-blue-600 dark:text-blue-400">Calculated</div>
            </div>
            <div className="text-center p-4 bg-yellow-50 dark:bg-yellow-950 rounded-lg">
              <div className="text-2xl font-bold text-yellow-700 dark:text-yellow-300">{metrics?.pendingCount}</div>
              <div className="text-sm text-yellow-600 dark:text-yellow-400">Pending</div>
            </div>
            <div className="text-center p-4 bg-red-50 dark:bg-red-950 rounded-lg">
              <div className="text-2xl font-bold text-red-700 dark:text-red-300">{metrics?.failedCount}</div>
              <div className="text-sm text-red-600 dark:text-red-400">Failed</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Charts Row */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Weekly Trend */}
        <Card>
          <CardHeader>
            <CardTitle>Weekly Bonus Trend</CardTitle>
            <CardDescription>Last 12 weeks of bonus payments</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={weeklyTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="week" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="total" stroke="#8884d8" name="Total Bonuses ($)" />
                <Line type="monotone" dataKey="count" stroke="#82ca9d" name="Bonus Count" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Tier Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Tier Distribution</CardTitle>
            <CardDescription>Bonuses by tier this month</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={metrics?.tierDistribution}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={(entry) => `${entry.name}: ${entry.value}`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {metrics?.tierDistribution.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Top Partners */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Award className="h-5 w-5" />
            Top 10 Earning Partners
          </CardTitle>
          <CardDescription>Highest bonus earners this month</CardDescription>
        </CardHeader>
        <CardContent>
          {topPartners && topPartners.length > 0 ? (
            <div className="space-y-3">
              {topPartners.map((partner: any, index: number) => (
                <div
                  key={partner.partner_id}
                  className="flex items-center justify-between p-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex items-center justify-center w-8 h-8 rounded-full font-bold ${
                        index === 0
                          ? 'bg-yellow-500 text-white'
                          : index === 1
                          ? 'bg-gray-400 text-white'
                          : index === 2
                          ? 'bg-orange-600 text-white'
                          : 'bg-muted-foreground/20'
                      }`}
                    >
                      {index + 1}
                    </div>
                    <div>
                      <div className="font-medium">{partner.username}</div>
                      <div className="text-sm text-muted-foreground">{partner.email}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-lg text-green-600 dark:text-green-400">
                      ${partner.total_bonus.toFixed(2)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <Alert>
              <AlertDescription>No bonus data available for this month yet.</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Email Statistics */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Email Notification Statistics
          </CardTitle>
          <CardDescription>Partner notification delivery metrics for this month</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="text-center p-4 border rounded-lg">
              <div className="text-3xl font-bold text-green-600 dark:text-green-400">{emailStats?.sent}</div>
              <div className="text-sm text-muted-foreground mt-1">Successfully Sent</div>
            </div>
            <div className="text-center p-4 border rounded-lg">
              <div className="text-3xl font-bold text-red-600 dark:text-red-400">{emailStats?.failed}</div>
              <div className="text-sm text-muted-foreground mt-1">Failed</div>
            </div>
            <div className="text-center p-4 border rounded-lg">
              <div className="text-3xl font-bold">{emailStats?.total}</div>
              <div className="text-sm text-muted-foreground mt-1">Total Attempts</div>
            </div>
          </div>
          <div className="mt-4">
            <ResponsiveContainer width="100%" height={150}>
              <BarChart data={[emailStats]}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="sent" fill="#10b981" name="Sent" />
                <Bar dataKey="failed" fill="#ef4444" name="Failed" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
