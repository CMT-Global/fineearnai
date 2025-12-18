import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePartnerAnalytics } from "@/hooks/usePartnerAnalytics";
import { formatCurrency } from "@/lib/wallet-utils";
import { Loader2, TrendingUp, DollarSign, Target, Award, Users } from "lucide-react";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const COLORS = ["#B9F94D", "#C9F158", "#56CCF2", "#F2C94C", "#EB5757", "#9DB8B1"];

const AdminPartnerAnalytics = () => {
  const [dateRange, setDateRange] = useState<'week' | 'month' | 'quarter' | 'year'>('month');
  
  const { data: analytics, isLoading } = usePartnerAnalytics({ date_range: dateRange });

  const getRangeLabel = () => {
    switch (dateRange) {
      case 'week': return 'Last 7 Days';
      case 'quarter': return 'Last 90 Days';
      case 'year': return 'Last Year';
      default: return 'Last 30 Days';
    }
  };

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Partner Analytics Dashboard</h1>
          <p className="text-muted-foreground">
            Monitor partner performance and sales metrics across the platform
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

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : analytics ? (
        <div className="space-y-6">
          {/* Platform Overview Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Platform Sales
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCurrency(analytics.overview.total_sales)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {analytics.overview.total_vouchers} total vouchers
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Award className="h-4 w-4" />
                  Total Commissions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {formatCurrency(analytics.overview.total_commission)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Paid to partners
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
                  {analytics.overview.redeemed_vouchers} vouchers redeemed
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Active Partners
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">
                  {analytics.partner_performance.length}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Selling this period
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Sales Trend Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Platform Sales Trend - {getRangeLabel()}</CardTitle>
              <CardDescription>Daily sales and commission performance</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={350}>
                <LineChart data={analytics.sales_trend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip 
                    formatter={(value: number) => formatCurrency(value)}
                    contentStyle={{ backgroundColor: "#123630", border: "none", borderRadius: "8px", color: "#EAF4F2" }}
                  />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="sales" 
                    stroke="#B9F94D" 
                    strokeWidth={2}
                    name="Total Sales"
                  />
                  <Line 
                    type="monotone" 
                    dataKey="commission" 
                    stroke="#C9F158" 
                    strokeWidth={2}
                    name="Commission"
                  />
                  <Line 
                    type="monotone" 
                    dataKey="vouchers" 
                    stroke="#56CCF2" 
                    strokeWidth={2}
                    name="Vouchers Sold"
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
                <CardDescription>Most popular denominations across platform</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={analytics.top_selling_amounts.slice(0, 6)}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="amount" tickFormatter={(value) => `$${value}`} />
                    <YAxis />
                    <Tooltip 
                      formatter={(value: number) => `${value} vouchers`}
                      labelFormatter={(label) => `Amount: ${formatCurrency(Number(label))}`}
                      contentStyle={{ backgroundColor: "#123630", border: "none", borderRadius: "8px", color: "#EAF4F2" }}
                    />
                    <Bar dataKey="count" fill="#C9F158" name="Vouchers Sold" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Voucher Status Distribution */}
            <Card>
              <CardHeader>
                <CardTitle>Voucher Status Distribution</CardTitle>
                <CardDescription>Platform-wide voucher status</CardDescription>
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
                      fill="#C9F158"
                      dataKey="value"
                    >
                      {[0, 1, 2].map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: "#123630", border: "none", borderRadius: "8px", color: "#EAF4F2" }} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Top Performing Partners */}
          {analytics.partner_performance.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Top Performing Partners</CardTitle>
                <CardDescription>Partners ranked by total sales</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Rank</TableHead>
                      <TableHead>Partner</TableHead>
                      <TableHead className="text-right">Vouchers Sold</TableHead>
                      <TableHead className="text-right">Redeemed</TableHead>
                      <TableHead className="text-right">Total Sales</TableHead>
                      <TableHead className="text-right">Commission</TableHead>
                      <TableHead className="text-right">Conversion</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {analytics.partner_performance.map((partner, idx) => (
                      <TableRow key={partner.partner_id}>
                        <TableCell className="font-bold">#{idx + 1}</TableCell>
                        <TableCell className="font-medium">{partner.partner_name}</TableCell>
                        <TableCell className="text-right">{partner.total_vouchers}</TableCell>
                        <TableCell className="text-right">{partner.redeemed_vouchers}</TableCell>
                        <TableCell className="text-right font-bold">
                          {formatCurrency(partner.total_sales)}
                        </TableCell>
                        <TableCell className="text-right text-green-600 font-semibold">
                          {formatCurrency(partner.total_commission)}
                        </TableCell>
                        <TableCell className="text-right">
                          {partner.total_vouchers > 0 
                            ? `${((partner.redeemed_vouchers / partner.total_vouchers) * 100).toFixed(1)}%`
                            : '0%'
                          }
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">No analytics data available</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default AdminPartnerAnalytics;
