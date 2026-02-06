import { useState } from "react";
import { useNavigate } from "react-router-dom";
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
import { PartnerErrorBoundary } from "@/components/partner/PartnerErrorBoundary";
import { useTranslation } from "react-i18next";
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

const COLORS = ["#B9F94D", "#C9F158", "#56CCF2", "#F2C94C", "#EB5757", "#9DB8B1"];

const PartnerAnalytics = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { data: isPartner, isLoading: checkingPartner } = useIsPartner();
  const { data: profile } = useProfile(user?.id || '');
  const [dateRange, setDateRange] = useState<'week' | 'month' | 'quarter' | 'year'>('month');
  
  const { data: analytics, isLoading: loadingAnalytics } = usePartnerAnalytics({ date_range: dateRange });

  if (checkingPartner) {
    return (
      <>
        <PartnerAnalyticsSkeleton />
      </>
    );
  }

  if (!isPartner) {
    navigate('/become-partner');
    return null;
  }

  const getRangeLabel = () => {
    switch (dateRange) {
      case 'week': return t("partner.analytics.ranges.week");
      case 'quarter': return t("partner.analytics.ranges.quarter");
      case 'year': return t("partner.analytics.ranges.year");
      default: return t("partner.analytics.ranges.month");
    }
  };

  return (
    <PartnerErrorBoundary
      fallbackMessage={t("partner.analytics.errors.loadFailed")}
    >
      <>
        <div className="container mx-auto px-4 py-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <BarChart3 className="h-8 w-8 text-primary" />
              <h1 className="text-3xl font-bold">{t("partner.analytics.title")}</h1>
            </div>
            <p className="text-muted-foreground">
              {t("partner.analytics.subtitle")}
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
                    <TrendingUp className="h-4 w-4" />
                    {t("partner.analytics.overview.activeVouchers")}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-blue-600">
                    {analytics.overview.active_vouchers}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {t("partner.analytics.overview.expired", { count: analytics.overview.expired_vouchers })}
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
                      contentStyle={{ backgroundColor: "#123630", border: "none", borderRadius: "8px", color: "#EAF4F2" }}
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
                        contentStyle={{ backgroundColor: "#123630", border: "none", borderRadius: "8px", color: "#EAF4F2" }}
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
                      <Tooltip contentStyle={{ backgroundColor: "#123630", border: "none", borderRadius: "8px", color: "#EAF4F2" }} />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

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
    </>
    </PartnerErrorBoundary>
  );
};

export default PartnerAnalytics;
