import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, CheckCircle2, Search, RefreshCw, TrendingUp, TrendingDown } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";

export default function CommissionAudit() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Fetch audit logs with filters
  const { data: auditLogs, isLoading, refetch } = useQuery({
    queryKey: ['commission-audit-logs', statusFilter, searchQuery],
    queryFn: async () => {
      let query = supabase
        .from('commission_audit_log')
        .select(`
          *,
          referrer:profiles!commission_audit_log_referrer_id_fkey(id, username, email),
          referred:profiles!commission_audit_log_referred_id_fkey(id, username, email),
          transaction:transactions!commission_audit_log_deposit_transaction_id_fkey(amount, created_at)
        `)
        .order('created_at', { ascending: false })
        .limit(100);
      
      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      const { data, error } = await query;
      
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 30000, // Auto-refresh every 30 seconds
  });

  // Calculate real-time stats
  const stats = {
    totalToday: auditLogs?.filter(log => {
      const today = new Date().toDateString();
      return new Date(log.created_at).toDateString() === today;
    }).length || 0,
    failedCount: auditLogs?.filter(log => log.status === 'failed').length || 0,
    successCount: auditLogs?.filter(log => log.status === 'success').length || 0,
    successRate: auditLogs?.length 
      ? Math.round((auditLogs.filter(log => log.status === 'success').length / auditLogs.length) * 100) 
      : 0,
  };

  // Filter logs by search query
  const filteredLogs = auditLogs?.filter(log => {
    if (!searchQuery) return true;
    const search = searchQuery.toLowerCase();
    return (
      log.referrer?.username?.toLowerCase().includes(search) ||
      log.referred?.username?.toLowerCase().includes(search) ||
      log.referrer?.email?.toLowerCase().includes(search) ||
      log.referred?.email?.toLowerCase().includes(search)
    );
  }) || [];

  const handleRefresh = () => {
    refetch();
    toast.success("Commission audit logs refreshed");
  };

  return (
    <div className="space-y-6 p-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Commission Audit</h1>
          <p className="text-muted-foreground mt-1">
            Track and monitor all commission processing attempts
          </p>
        </div>
        <Button onClick={handleRefresh} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Real-time Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Today's Commissions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalToday}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Processed in last 24 hours
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Success Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <div className="text-2xl font-bold">{stats.successRate}%</div>
              {stats.successRate >= 95 ? (
                <TrendingUp className="h-4 w-4 text-green-500" />
              ) : (
                <TrendingDown className="h-4 w-4 text-yellow-500" />
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.successCount} successful
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Failed Commissions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <div className="text-2xl font-bold">{stats.failedCount}</div>
              {stats.failedCount > 0 && (
                <Badge variant="destructive" className="text-xs">
                  Action Required
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Requires investigation
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Audited
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{auditLogs?.length || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              All-time commission attempts
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>
            Filter commission audit logs by status and search users
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Status Filter */}
            <div className="flex-1">
              <label className="text-sm font-medium mb-2 block">Status</label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="success">Success Only</SelectItem>
                  <SelectItem value="failed">Failed Only</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Search Filter */}
            <div className="flex-1">
              <label className="text-sm font-medium mb-2 block">Search User</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by username or email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Audit Logs Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Commission Audit Logs</CardTitle>
              <CardDescription>
                {filteredLogs.length} log{filteredLogs.length !== 1 ? 's' : ''} found
              </CardDescription>
            </div>
            {stats.failedCount > 0 && (
              <Badge variant="destructive" className="gap-1">
                <AlertCircle className="h-3 w-3" />
                {stats.failedCount} Failed
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="text-center py-12">
              <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-lg font-medium">No audit logs found</p>
              <p className="text-sm text-muted-foreground mt-1">
                {statusFilter !== 'all' || searchQuery 
                  ? "Try adjusting your filters" 
                  : "Commission audit logs will appear here once deposits are processed"}
              </p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Status</TableHead>
                    <TableHead>User (Referred)</TableHead>
                    <TableHead>Upline (Referrer)</TableHead>
                    <TableHead>Deposit Amount</TableHead>
                    <TableHead>Commission</TableHead>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLogs.map((log: any) => (
                    <TableRow key={log.id}>
                      {/* Status Badge */}
                      <TableCell>
                        {log.status === 'success' ? (
                          <Badge variant="default" className="gap-1 bg-green-500 hover:bg-green-600">
                            <CheckCircle2 className="h-3 w-3" />
                            Success
                          </Badge>
                        ) : (
                          <Badge variant="destructive" className="gap-1">
                            <AlertCircle className="h-3 w-3" />
                            Failed
                          </Badge>
                        )}
                      </TableCell>

                      {/* Referred User */}
                      <TableCell>
                        <div className="space-y-1">
                          <p className="font-medium">{log.referred?.username || 'N/A'}</p>
                          <p className="text-xs text-muted-foreground">{log.referred?.email || 'N/A'}</p>
                        </div>
                      </TableCell>

                      {/* Referrer */}
                      <TableCell>
                        {log.referrer ? (
                          <div className="space-y-1">
                            <p className="font-medium">{log.referrer.username}</p>
                            <p className="text-xs text-muted-foreground">{log.referrer.email}</p>
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">No Upline</span>
                        )}
                      </TableCell>

                      {/* Deposit Amount */}
                      <TableCell>
                        <span className="font-mono">
                          ${log.transaction?.amount?.toFixed(2) || '0.00'}
                        </span>
                      </TableCell>

                      {/* Commission Amount */}
                      <TableCell>
                        <span className={`font-mono ${log.status === 'success' ? 'text-green-600 font-medium' : 'text-muted-foreground'}`}>
                          ${log.commission_amount?.toFixed(2) || '0.00'}
                        </span>
                      </TableCell>

                      {/* Timestamp */}
                      <TableCell>
                        <div className="text-sm">
                          <p>{format(new Date(log.created_at), 'MMM dd, yyyy')}</p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(log.created_at), 'HH:mm:ss')}
                          </p>
                        </div>
                      </TableCell>

                      {/* Error Details (Expandable) */}
                      <TableCell>
                        {log.status === 'failed' && log.error_details ? (
                          <Collapsible>
                            <CollapsibleTrigger asChild>
                              <Button variant="ghost" size="sm" className="gap-1">
                                View
                                <ChevronDown className="h-3 w-3" />
                              </Button>
                            </CollapsibleTrigger>
                            <CollapsibleContent className="absolute z-10 mt-2 p-4 bg-card border rounded-lg shadow-lg max-w-md">
                              <div className="space-y-2">
                                <p className="text-sm font-medium">Error Details:</p>
                                <div className="text-xs space-y-1 text-muted-foreground">
                                  <p><strong>Reason:</strong> {log.error_details.reason}</p>
                                  <p><strong>Tracking ID:</strong> {log.error_details.tracking_id}</p>
                                  <p><strong>Payment ID:</strong> {log.error_details.payment_id}</p>
                                  <p><strong>Has Upline:</strong> {log.error_details.has_upline ? 'Yes' : 'No'}</p>
                                  <p><strong>Deposit:</strong> ${log.error_details.deposit_amount}</p>
                                  <p><strong>Time:</strong> {format(new Date(log.error_details.timestamp), 'PPpp')}</p>
                                </div>
                              </div>
                            </CollapsibleContent>
                          </Collapsible>
                        ) : (
                          <span className="text-muted-foreground text-sm">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
