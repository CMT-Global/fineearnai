import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { History, DollarSign, TrendingUp, Calendar, Award, ChevronLeft, ChevronRight, Download } from "lucide-react";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { BonusHistoryTableSkeleton } from "@/components/partner/BonusHistoryTableSkeleton";

interface WeeklyBonus {
  id: string;
  week_start_date: string;
  week_end_date: string;
  total_weekly_sales: number;
  qualified_tier_id: string | null;
  bonus_percentage: number;
  bonus_amount: number;
  status: string;
  paid_at: string | null;
  created_at: string;
  partner_bonus_tiers?: {
    tier_name: string;
  };
}

export function BonusHistoryTable() {
  const [statusFilter, setStatusFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(0);
  const [viewMode, setViewMode] = useState<"table" | "chart">("table");
  const pageSize = 10;

  // Fetch bonus history
  const { data: bonuses, isLoading } = useQuery({
    queryKey: ["partner-bonus-history"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      let query = supabase
        .from("partner_weekly_bonuses")
        .select(`
          *,
          partner_bonus_tiers(tier_name)
        `)
        .eq("partner_id", user.id)
        .order("week_start_date", { ascending: false });

      const { data, error } = await query;
      if (error) throw error;
      return data as WeeklyBonus[];
    },
  });

  // Filter bonuses
  const filteredBonuses = bonuses?.filter(bonus => {
    if (statusFilter === "all") return true;
    return bonus.status === statusFilter;
  }) || [];

  // Paginate
  const paginatedBonuses = filteredBonuses.slice(
    currentPage * pageSize,
    (currentPage + 1) * pageSize
  );

  const totalPages = Math.ceil(filteredBonuses.length / pageSize);

  // Calculate statistics
  const stats = {
    totalBonuses: bonuses?.filter(b => b.status === "paid").length || 0,
    totalAmount: bonuses?.filter(b => b.status === "paid").reduce((sum, b) => sum + b.bonus_amount, 0) || 0,
    avgBonus: bonuses?.filter(b => b.status === "paid").length 
      ? (bonuses.filter(b => b.status === "paid").reduce((sum, b) => sum + b.bonus_amount, 0) / bonuses.filter(b => b.status === "paid").length)
      : 0,
    totalSales: bonuses?.reduce((sum, b) => sum + b.total_weekly_sales, 0) || 0,
  };

  // Prepare chart data (last 12 weeks)
  const chartData = bonuses?.slice(0, 12).reverse().map(bonus => ({
    week: format(new Date(bonus.week_start_date), "MMM d"),
    sales: bonus.total_weekly_sales,
    bonus: bonus.bonus_amount,
    percentage: bonus.bonus_percentage * 100,
  })) || [];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "paid":
        return <Badge className="bg-success/10 text-success hover:bg-success/20">Paid</Badge>;
      case "calculated":
        return <Badge className="bg-warning/10 text-warning hover:bg-warning/20">Ready</Badge>;
      case "pending":
        return <Badge variant="outline">Pending</Badge>;
      case "failed":
        return <Badge variant="destructive">Failed</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5 text-primary" />
              Bonus History
            </CardTitle>
            <CardDescription>Track your weekly bonus earnings and performance</CardDescription>
          </div>
          <div className="flex gap-2">
            <Select value={viewMode} onValueChange={(value: "table" | "chart") => setViewMode(value)}>
              <SelectTrigger className="w-[130px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="table">Table View</SelectItem>
                <SelectItem value="chart">Chart View</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[130px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="calculated">Ready</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Statistics Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="border-primary/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Bonuses</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalBonuses}</div>
              <p className="text-xs text-muted-foreground">Weeks paid</p>
            </CardContent>
          </Card>

          <Card className="border-success/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Earned</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-success">${stats.totalAmount.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground">All-time bonuses</p>
            </CardContent>
          </Card>

          <Card className="border-warning/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Average Bonus</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-warning">${stats.avgBonus.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground">Per week</p>
            </CardContent>
          </Card>

          <Card className="border-muted">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Sales</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${stats.totalSales.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground">All-time volume</p>
            </CardContent>
          </Card>
        </div>

        {/* Chart View */}
        {viewMode === "chart" && chartData.length > 0 && (
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold mb-3">Weekly Sales & Bonus Trends (Last 12 Weeks)</h3>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="week" className="text-xs" />
                  <YAxis yAxisId="left" className="text-xs" />
                  <YAxis yAxisId="right" orientation="right" className="text-xs" />
                  <Tooltip
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                    labelStyle={{ color: 'hsl(var(--foreground))' }}
                  />
                  <Legend />
                  <Line yAxisId="left" type="monotone" dataKey="sales" stroke="hsl(var(--primary))" strokeWidth={2} name="Weekly Sales ($)" />
                  <Line yAxisId="right" type="monotone" dataKey="bonus" stroke="hsl(var(--success))" strokeWidth={2} name="Bonus Earned ($)" />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div>
              <h3 className="text-sm font-semibold mb-3">Bonus Percentage by Week</h3>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="week" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                    labelStyle={{ color: 'hsl(var(--foreground))' }}
                  />
                  <Bar dataKey="percentage" fill="hsl(var(--primary))" name="Bonus %" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Table View */}
        {viewMode === "table" && (
          <>
            {isLoading ? (
              <BonusHistoryTableSkeleton />
            ) : paginatedBonuses.length > 0 ? (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Week Period</TableHead>
                      <TableHead>Total Sales</TableHead>
                      <TableHead>Tier</TableHead>
                      <TableHead>Bonus %</TableHead>
                      <TableHead>Bonus Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Payment Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedBonuses.map((bonus) => (
                      <TableRow key={bonus.id}>
                        <TableCell>
                          <div className="flex items-center gap-1 text-sm">
                            <Calendar className="h-3 w-3 text-muted-foreground" />
                            {format(new Date(bonus.week_start_date), "MMM d")} - {format(new Date(bonus.week_end_date), "MMM d, yyyy")}
                          </div>
                        </TableCell>
                        <TableCell className="font-medium">${bonus.total_weekly_sales.toFixed(2)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Award className="h-3 w-3 text-primary" />
                            {bonus.partner_bonus_tiers?.tier_name || "N/A"}
                          </div>
                        </TableCell>
                        <TableCell className="text-primary font-semibold">
                          {(bonus.bonus_percentage * 100).toFixed(2)}%
                        </TableCell>
                        <TableCell className="font-bold text-success">
                          ${bonus.bonus_amount.toFixed(2)}
                        </TableCell>
                        <TableCell>{getStatusBadge(bonus.status)}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {bonus.paid_at ? format(new Date(bonus.paid_at), "MMM d, yyyy") : "-"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-muted-foreground">
                      Showing {currentPage * pageSize + 1} to {Math.min((currentPage + 1) * pageSize, filteredBonuses.length)} of {filteredBonuses.length} bonuses
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(p => Math.max(0, p - 1))}
                        disabled={currentPage === 0}
                      >
                        <ChevronLeft className="h-4 w-4" />
                        Previous
                      </Button>
                      <div className="text-sm">
                        Page {currentPage + 1} of {totalPages}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(p => Math.min(totalPages - 1, p + 1))}
                        disabled={currentPage >= totalPages - 1}
                      >
                        Next
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <History className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Bonus History</h3>
                <p className="text-muted-foreground">
                  {statusFilter !== "all" 
                    ? "No bonuses match your filter" 
                    : "Start selling vouchers to earn weekly bonuses!"
                  }
                </p>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
