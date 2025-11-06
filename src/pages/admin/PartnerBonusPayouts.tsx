import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { DollarSign, Users, CheckCircle2, XCircle, Clock, Eye, PlayCircle, Calendar } from "lucide-react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface WeeklyBonus {
  id: string;
  partner_id: string;
  week_start_date: string;
  week_end_date: string;
  total_weekly_sales: number;
  qualified_tier_id: string | null;
  bonus_percentage: number;
  bonus_amount: number;
  status: string;
  paid_at: string | null;
  transaction_id: string | null;
  created_at: string;
  profiles?: {
    username: string;
    email: string;
  };
  partner_bonus_tiers?: {
    tier_name: string;
  };
}

export default function PartnerBonusPayouts() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [weekFilter, setWeekFilter] = useState<string>("all");
  const [selectedBonus, setSelectedBonus] = useState<WeeklyBonus | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  // Fetch weekly bonuses
  const { data: bonuses, isLoading } = useQuery({
    queryKey: ["partner-weekly-bonuses", statusFilter, weekFilter],
    queryFn: async () => {
      let query = supabase
        .from("partner_weekly_bonuses")
        .select(`
          *,
          partner_bonus_tiers(tier_name)
        `)
        .order("created_at", { ascending: false });

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      if (weekFilter !== "all") {
        query = query.eq("week_start_date", weekFilter);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Fetch profiles separately
      if (data && data.length > 0) {
        const partnerIds = [...new Set(data.map(b => b.partner_id))];
        const { data: profilesData } = await supabase
          .from("profiles")
          .select("id, username, email")
          .in("id", partnerIds);

        const profilesMap = new Map(profilesData?.map(p => [p.id, p]) || []);
        
        return data.map(bonus => ({
          ...bonus,
          profiles: profilesMap.get(bonus.partner_id) || { username: "Unknown", email: "" }
        })) as WeeklyBonus[];
      }

      return [];
    },
  });

  // Get unique weeks for filter
  const uniqueWeeks = Array.from(
    new Set(bonuses?.map(b => b.week_start_date) || [])
  ).sort((a, b) => b.localeCompare(a));

  // Calculate statistics
  const stats = {
    totalPending: bonuses?.filter(b => b.status === "calculated").length || 0,
    totalPaid: bonuses?.filter(b => b.status === "paid").length || 0,
    totalAmount: bonuses?.reduce((sum, b) => sum + (b.status === "calculated" ? b.bonus_amount : 0), 0) || 0,
    totalPaidAmount: bonuses?.reduce((sum, b) => sum + (b.status === "paid" ? b.bonus_amount : 0), 0) || 0,
    uniquePartners: new Set(bonuses?.map(b => b.partner_id)).size || 0,
  };

  // Manual trigger calculation
  const triggerCalculationMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("calculate-weekly-bonuses");
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["partner-weekly-bonuses"] });
      toast.success(`Calculation complete: ${data.bonuses_calculated} bonuses calculated`);
    },
    onError: (error: Error) => {
      toast.error(`Failed to calculate bonuses: ${error.message}`);
    },
  });

  // Manual trigger payout
  const triggerPayoutMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("process-weekly-bonus-payouts");
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["partner-weekly-bonuses"] });
      toast.success(`Payout complete: ${data.bonuses_paid} bonuses paid`);
      if (data.bonuses_failed > 0) {
        toast.warning(`${data.bonuses_failed} bonuses failed. Check logs for details.`);
      }
    },
    onError: (error: Error) => {
      toast.error(`Failed to process payouts: ${error.message}`);
    },
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "paid":
        return <Badge className="bg-success/10 text-success hover:bg-success/20"><CheckCircle2 className="h-3 w-3 mr-1" />Paid</Badge>;
      case "calculated":
        return <Badge className="bg-warning/10 text-warning hover:bg-warning/20"><Clock className="h-3 w-3 mr-1" />Ready</Badge>;
      case "pending":
        return <Badge variant="outline"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
      case "failed":
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Failed</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const handleViewDetails = (bonus: WeeklyBonus) => {
    setSelectedBonus(bonus);
    setIsDetailsOpen(true);
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Partner Bonus Payouts</h1>
            <p className="text-muted-foreground">Monitor and manage weekly bonus calculations and payouts</p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => triggerCalculationMutation.mutate()}
              disabled={triggerCalculationMutation.isPending}
            >
              <PlayCircle className="mr-2 h-4 w-4" />
              Calculate Bonuses
            </Button>
            <Button
              onClick={() => triggerPayoutMutation.mutate()}
              disabled={triggerPayoutMutation.isPending || stats.totalPending === 0}
            >
              <DollarSign className="mr-2 h-4 w-4" />
              Process Payouts ({stats.totalPending})
            </Button>
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="grid gap-4 md:grid-cols-5">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Payouts</CardTitle>
              <Clock className="h-4 w-4 text-warning" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalPending}</div>
              <p className="text-xs text-muted-foreground">${stats.totalAmount.toFixed(2)} total</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Bonuses Paid</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-success" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalPaid}</div>
              <p className="text-xs text-muted-foreground">This month</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Paid</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${stats.totalPaidAmount.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground">All time</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Partners</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.uniquePartners}</div>
              <p className="text-xs text-muted-foreground">Earning bonuses</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Bonus</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ${stats.totalPaid > 0 ? (stats.totalPaidAmount / stats.totalPaid).toFixed(2) : "0.00"}
              </div>
              <p className="text-xs text-muted-foreground">Per payout</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters and Table */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Weekly Bonuses</CardTitle>
                <CardDescription>View and manage all partner bonus records</CardDescription>
              </div>
              <div className="flex gap-2">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="calculated">Ready to Pay</SelectItem>
                    <SelectItem value="paid">Paid</SelectItem>
                    <SelectItem value="failed">Failed</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={weekFilter} onValueChange={setWeekFilter}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Filter by week" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Weeks</SelectItem>
                    {uniqueWeeks.map((week) => (
                      <SelectItem key={week} value={week}>
                        {format(new Date(week), "MMM d, yyyy")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="text-muted-foreground">Loading bonuses...</div>
              </div>
            ) : bonuses && bonuses.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Partner</TableHead>
                    <TableHead>Week Period</TableHead>
                    <TableHead>Total Sales</TableHead>
                    <TableHead>Tier</TableHead>
                    <TableHead>Bonus %</TableHead>
                    <TableHead>Bonus Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bonuses.map((bonus) => (
                    <TableRow key={bonus.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{bonus.profiles?.username}</div>
                          <div className="text-xs text-muted-foreground">{bonus.profiles?.email}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm">
                          <Calendar className="h-3 w-3" />
                          {format(new Date(bonus.week_start_date), "MMM d")} - {format(new Date(bonus.week_end_date), "MMM d, yyyy")}
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">${bonus.total_weekly_sales.toFixed(2)}</TableCell>
                      <TableCell>
                        {bonus.partner_bonus_tiers?.tier_name || "N/A"}
                      </TableCell>
                      <TableCell className="text-primary font-semibold">
                        {(bonus.bonus_percentage * 100).toFixed(2)}%
                      </TableCell>
                      <TableCell className="font-bold text-success">
                        ${bonus.bonus_amount.toFixed(2)}
                      </TableCell>
                      <TableCell>{getStatusBadge(bonus.status)}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewDetails(bonus)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <DollarSign className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Bonus Records</h3>
                <p className="text-muted-foreground mb-4">
                  {statusFilter !== "all" || weekFilter !== "all" 
                    ? "No bonuses match your filters" 
                    : "Trigger a bonus calculation to get started"
                  }
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Details Dialog */}
        <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Bonus Details</DialogTitle>
              <DialogDescription>Complete information about this weekly bonus</DialogDescription>
            </DialogHeader>
            {selectedBonus && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Partner</p>
                    <p className="font-medium">{selectedBonus.profiles?.username}</p>
                    <p className="text-xs text-muted-foreground">{selectedBonus.profiles?.email}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Week Period</p>
                    <p className="font-medium">
                      {format(new Date(selectedBonus.week_start_date), "MMM d")} - {format(new Date(selectedBonus.week_end_date), "MMM d, yyyy")}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Sales</p>
                    <p className="font-medium text-lg">${selectedBonus.total_weekly_sales.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Qualified Tier</p>
                    <p className="font-medium">{selectedBonus.partner_bonus_tiers?.tier_name || "None"}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Bonus Percentage</p>
                    <p className="font-medium text-primary text-lg">{(selectedBonus.bonus_percentage * 100).toFixed(2)}%</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Bonus Amount</p>
                    <p className="font-bold text-success text-lg">${selectedBonus.bonus_amount.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Status</p>
                    <div className="mt-1">{getStatusBadge(selectedBonus.status)}</div>
                  </div>
                  {selectedBonus.paid_at && (
                    <div>
                      <p className="text-sm text-muted-foreground">Paid At</p>
                      <p className="font-medium">{format(new Date(selectedBonus.paid_at), "MMM d, yyyy HH:mm")}</p>
                    </div>
                  )}
                </div>
                {selectedBonus.transaction_id && (
                  <div className="pt-4 border-t">
                    <p className="text-sm text-muted-foreground">Transaction ID</p>
                    <p className="font-mono text-xs">{selectedBonus.transaction_id}</p>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
