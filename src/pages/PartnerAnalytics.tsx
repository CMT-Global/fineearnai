import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageLayout } from "@/components/layout/PageLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useIsPartner } from "@/hooks/usePartner";
import { usePartnerAnalytics } from "@/hooks/usePartnerAnalytics";
import { useProfile } from "@/hooks/useProfile";
import { useAuth } from "@/hooks/useAuth";
import { formatCurrency } from "@/lib/wallet-utils";
import { Loader2, TrendingUp, DollarSign, Target, Award, BarChart3 } from "lucide-react";
import { PartnerAnalyticsSkeleton } from "@/components/partner/PartnerAnalyticsSkeleton";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];

const PartnerAnalytics = () => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { data: isPartner, isLoading: checkingPartner } = useIsPartner();
  const { data: profile } = useProfile(user?.id || '');
  const [dateRange, setDateRange] = useState<'week' | 'month' | 'quarter' | 'year'>('month');
  
  const { data: analytics, isLoading: loadingAnalytics } = usePartnerAnalytics({ date_range: dateRange });

  if (checkingPartner) {
    return (
      <PageLayout profile={profile} onSignOut={signOut}>
        <PartnerAnalyticsSkeleton />
      </PageLayout>
    );
  }

  if (!isPartner) {
    navigate('/become-partner');
    return null;
  }

  const getRangeLabel = () => {
    switch (dateRange) {
      case 'week': return 'Last 7 Days';
      case 'quarter': return 'Last 90 Days';
      case 'year': return 'Last Year';
      default: return 'Last 30 Days';
    }
  };

  return (
    <PageLayout profile={profile} onSignOut={signOut}>
      <div className="container mx-auto px-4 py-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <BarChart3 className="h-8 w-8 text-primary" />
              <h1 className="text-3xl font-bold">Partner Analytics</h1>
            </div>
            <p className="text-muted-foreground">
              Track your sales performance and earnings
            </p>
          </div>

          <Select value={dateRange} onValueChange={(value: any) => setDateRange(value)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="week">Last 7 Days</SelectItem>
              <SelectItem value="month">Last 30 Days</SelectItem>
              <SelectItem value="quarter">Last 90 Days</SelectItem>
              <SelectItem value="year">Last Year</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {loadingAnalytics ? (
          <PartnerAnalyticsSkeleton showHeader={false} />
        ) : analytics ? (
          <div className="space-y-6">
            {/* Overview Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <DollarSign className="h-4 w-4" />
                    Total Sales
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {formatCurrency(analytics.overview.total_sales)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {analytics.overview.total_vouchers} vouchers
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Award className="h-4 w-4" />
                    Commission Earned
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">
                    {formatCurrency(analytics.overview.total_commission)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatCurrency(analytics.overview.redeemed_sales)} redeemed
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Target className="h-4 w-4" />
                    Conversion Rate
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {analytics.overview.conversion_rate}%
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {analytics.overview.redeemed_vouchers} / {analytics.overview.total_vouchers} redeemed
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" />
                    Active Vouchers
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-blue-600">
                    {analytics.overview.active_vouchers}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {analytics.overview.expired_vouchers} expired
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Sales Trend Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Sales Trend - {getRangeLabel()}</CardTitle>
                <CardDescription>Daily sales and commission performance</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={analytics.sales_trend}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip 
                      formatter={(value: number) => formatCurrency(value)}
                    />
                    <Legend />
                    <Line 
                      type="monotone" 
                      dataKey="sales" 
                      stroke="#8884d8" 
                      strokeWidth={2}
                      name="Sales"
                    />
                    <Line 
                      type="monotone" 
                      dataKey="commission" 
                      stroke="#82ca9d" 
                      strokeWidth={2}
                      name="Commission"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Top Selling Amounts */}
              <Card>
                <CardHeader>
                  <CardTitle>Top Selling Voucher Amounts</CardTitle>
                  <CardDescription>Most popular voucher denominations</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={analytics.top_selling_amounts.slice(0, 5)}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="amount" tickFormatter={(value) => `$${value}`} />
                      <YAxis />
                      <Tooltip 
                        formatter={(value: number) => `${value} vouchers`}
                        labelFormatter={(label) => `Amount: ${formatCurrency(Number(label))}`}
                      />
                      <Bar dataKey="count" fill="#8884d8" name="Vouchers Sold" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Voucher Status Distribution */}
              <Card>
                <CardHeader>
                  <CardTitle>Voucher Status Distribution</CardTitle>
                  <CardDescription>Breakdown by redemption status</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={[
                          { name: 'Redeemed', value: analytics.overview.redeemed_vouchers },
                          { name: 'Active', value: analytics.overview.active_vouchers },
                          { name: 'Expired', value: analytics.overview.expired_vouchers },
                        ]}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                        outerRadius={100}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {[0, 1, 2].map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            {/* Commission Earnings Over Time */}
            <Card>
              <CardHeader>
                <CardTitle>Commission Earnings Timeline</CardTitle>
                <CardDescription>Track your earnings from redeemed vouchers</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={analytics.commission_trend}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip 
                      formatter={(value: number) => formatCurrency(value)}
                    />
                    <Bar dataKey="commission" fill="#82ca9d" name="Commission Earned" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        ) : (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">No analytics data available</p>
            </CardContent>
          </Card>
        )}
      </div>
    </PageLayout>
  );
};

export default PartnerAnalytics;
