import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useLanguageSync } from "@/hooks/useLanguageSync";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePartnerAnalytics } from "@/hooks/usePartnerAnalytics";
import { formatCurrency } from "@/lib/wallet-utils";
import { Loader2, TrendingUp, DollarSign, Target, Award, Users, BarChart3, ArrowLeft } from "lucide-react";
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
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";

const COLORS = ["#B9F94D", "#C9F158", "#56CCF2", "#F2C94C", "#EB5757", "#9DB8B1"];

const AdminPartnerAnalytics = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  useLanguageSync(); // Sync language and force re-render when language changes
  
  const [dateRange, setDateRange] = useState<'week' | 'month' | 'quarter' | 'year'>('month');
  
  const { data: analytics, isLoading } = usePartnerAnalytics({ date_range: dateRange });

  const getRangeLabel = () => {
    switch (dateRange) {
      case 'week': return t("partner.analytics.ranges.week");
      case 'quarter': return t("partner.analytics.ranges.quarter");
      case 'year': return t("partner.analytics.ranges.year");
      default: return t("partner.analytics.ranges.month");
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <LoadingSpinner size="lg" text={t("common.loading")} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <Button variant="ghost" onClick={() => navigate("/admin")} className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t("admin.backToAdmin")}
          </Button>

          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <BarChart3 className="h-8 w-8 text-primary" />
                <h1 className="text-3xl font-bold">{t("admin.partnerAnalytics.title") || "Partner Analytics"}</h1>
              </div>
              <p className="text-muted-foreground">
                {t("admin.partnerAnalytics.subtitle") || "View analytics and performance metrics for all partners"}
              </p>
            </div>

            <Select value={dateRange} onValueChange={(value: any) => setDateRange(value)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder={t("partner.analytics.selectRange")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="week">{t("partner.analytics.ranges.week")}</SelectItem>
                <SelectItem value="month">{t("partner.analytics.ranges.month")}</SelectItem>
                <SelectItem value="quarter">{t("partner.analytics.ranges.quarter")}</SelectItem>
                <SelectItem value="year">{t("partner.analytics.ranges.year")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {analytics ? (
          <div className="space-y-6">
            {/* Overview Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <DollarSign className="h-4 w-4" />
                    {t("partner.analytics.overview.totalSales")}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {formatCurrency(analytics.overview.total_sales)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {t("partner.analytics.overview.vouchers", { count: analytics.overview.total_vouchers })}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Award className="h-4 w-4" />
                    {t("partner.analytics.overview.commissionEarned")}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">
                    {formatCurrency(analytics.overview.total_commission)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {t("partner.analytics.overview.redeemed", {
                      amount: formatCurrency(analytics.overview.redeemed_sales),
                    })}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Target className="h-4 w-4" />
                    {t("partner.analytics.overview.conversionRate")}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {analytics.overview.conversion_rate}%
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {t("partner.analytics.overview.redeemedRatio", {
                      redeemed: analytics.overview.redeemed_vouchers,
                      total: analytics.overview.total_vouchers,
                    })}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    {t("admin.partnerAnalytics.totalPartners") || "Total Partners"}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-blue-600">
                    {analytics.partner_performance?.length || 0}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {t("admin.partnerAnalytics.activePartners") || "Active partners"}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Sales Trend Chart */}
            <Card>
              <CardHeader>
                <CardTitle>{t("partner.analytics.charts.salesTrendTitle", { range: getRangeLabel() })}</CardTitle>
                <CardDescription>{t("partner.analytics.charts.salesTrendDescription")}</CardDescription>
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
                      stroke="#B9F94D" 
                      strokeWidth={2}
                      name={t("partner.analytics.charts.salesSeries")}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="commission" 
                      stroke="#C9F158" 
                      strokeWidth={2}
                      name={t("partner.analytics.charts.commissionSeries")}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Top Selling Amounts */}
              <Card>
                <CardHeader>
                  <CardTitle>{t("partner.analytics.charts.topSellingAmountsTitle")}</CardTitle>
                  <CardDescription>{t("partner.analytics.charts.topSellingAmountsDescription")}</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={analytics.top_selling_amounts.slice(0, 5)}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="amount" tickFormatter={(value) => `$${value}`} />
                      <YAxis />
                      <Tooltip 
                        formatter={(value: number) => t("partner.analytics.charts.vouchersTooltip", { count: value })}
                        labelFormatter={(label) =>
                          t("partner.analytics.charts.amountLabel", { amount: formatCurrency(Number(label)) })
                        }
                      />
                      <Bar dataKey="count" fill="#C9F158" name={t("partner.analytics.charts.vouchersSold")} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Voucher Status Distribution */}
              <Card>
                <CardHeader>
                  <CardTitle>{t("partner.analytics.charts.voucherStatusDistributionTitle")}</CardTitle>
                  <CardDescription>{t("partner.analytics.charts.voucherStatusDistributionDescription")}</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={[
                          { name: t("partner.analytics.charts.status.redeemed"), value: analytics.overview.redeemed_vouchers },
                          { name: t("partner.analytics.charts.status.active"), value: analytics.overview.active_vouchers },
                          { name: t("partner.analytics.charts.status.expired"), value: analytics.overview.expired_vouchers },
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
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            {/* Partner Performance Table */}
            {analytics.partner_performance && analytics.partner_performance.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>{t("admin.partnerAnalytics.partnerPerformance") || "Partner Performance"}</CardTitle>
                  <CardDescription>
                    {t("admin.partnerAnalytics.partnerPerformanceDescription") || "Individual partner performance metrics"}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("admin.partnerAnalytics.partnerName") || "Partner Name"}</TableHead>
                        <TableHead>{t("partner.analytics.overview.totalSales")}</TableHead>
                        <TableHead>{t("partner.analytics.overview.commissionEarned")}</TableHead>
                        <TableHead>{t("partner.analytics.overview.vouchers", { count: 0 }).replace("0", "")}</TableHead>
                        <TableHead>{t("partner.analytics.charts.status.redeemed")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {analytics.partner_performance.map((partner) => (
                        <TableRow key={partner.partner_id}>
                          <TableCell className="font-medium">{partner.partner_name}</TableCell>
                          <TableCell>{formatCurrency(partner.total_sales)}</TableCell>
                          <TableCell className="text-green-600">{formatCurrency(partner.total_commission)}</TableCell>
                          <TableCell>{partner.total_vouchers}</TableCell>
                          <TableCell>{partner.redeemed_vouchers}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}

            {/* Commission Earnings Over Time */}
            <Card>
              <CardHeader>
                <CardTitle>{t("partner.analytics.charts.commissionTimelineTitle")}</CardTitle>
                <CardDescription>{t("partner.analytics.charts.commissionTimelineDescription")}</CardDescription>
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
                    <Bar dataKey="commission" fill="#82ca9d" name={t("partner.analytics.charts.commissionSeries")} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        ) : (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">{t("partner.analytics.noData")}</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default AdminPartnerAnalytics;