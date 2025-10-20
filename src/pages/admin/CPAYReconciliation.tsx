import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RefreshCw, AlertTriangle, CheckCircle, Download } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface ReconciliationIssue {
  id: string;
  type: 'missing_webhook' | 'balance_mismatch' | 'stuck_pending' | 'orphaned_transaction';
  severity: 'low' | 'medium' | 'high' | 'critical';
  transaction_id: string;
  user_id: string;
  username: string;
  amount: number;
  description: string;
  created_at: string;
  gateway_transaction_id?: string;
}

export default function CPAYReconciliation() {
  const [loading, setLoading] = useState(false);

  const { data: issues, isLoading, refetch } = useQuery({
    queryKey: ['cpay-reconciliation'],
    queryFn: async () => {
      const issues: ReconciliationIssue[] = [];

      // Check for pending deposits older than 30 minutes
      const { data: stuckDeposits } = await supabase
        .from('transactions')
        .select(`
          id,
          user_id,
          amount,
          created_at,
          gateway_transaction_id,
          profiles:user_id(username)
        `)
        .eq('type', 'deposit')
        .eq('payment_gateway', 'cpay')
        .eq('status', 'pending')
        .lt('created_at', new Date(Date.now() - 30 * 60 * 1000).toISOString());

      stuckDeposits?.forEach((tx: any) => {
        issues.push({
          id: `stuck-${tx.id}`,
          type: 'stuck_pending',
          severity: 'high',
          transaction_id: tx.id,
          user_id: tx.user_id,
          username: tx.profiles?.username || 'Unknown',
          amount: tx.amount,
          description: `Deposit stuck in pending for ${Math.round((Date.now() - new Date(tx.created_at).getTime()) / 60000)} minutes`,
          created_at: tx.created_at,
          gateway_transaction_id: tx.gateway_transaction_id,
        });
      });

      // Check for withdrawal requests older than 24 hours
      const { data: stuckWithdrawals } = await supabase
        .from('withdrawal_requests')
        .select(`
          id,
          user_id,
          amount,
          created_at,
          payment_method,
          profiles:user_id(username)
        `)
        .eq('payment_method', 'cpay_withdrawal_usdt_trc20')
        .eq('status', 'pending')
        .lt('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

      stuckWithdrawals?.forEach((wr: any) => {
        issues.push({
          id: `stuck-wd-${wr.id}`,
          type: 'stuck_pending',
          severity: 'critical',
          transaction_id: wr.id,
          user_id: wr.user_id,
          username: wr.profiles?.username || 'Unknown',
          amount: wr.amount,
          description: `Withdrawal pending for ${Math.round((Date.now() - new Date(wr.created_at).getTime()) / 3600000)} hours`,
          created_at: wr.created_at,
        });
      });

      return issues;
    },
  });

  const handleRefresh = async () => {
    setLoading(true);
    try {
      await refetch();
      toast.success('Reconciliation refreshed');
    } catch (error) {
      toast.error('Failed to refresh');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    if (!issues || issues.length === 0) {
      toast.error('No issues to export');
      return;
    }

    const csv = [
      ['Type', 'Severity', 'Transaction ID', 'User', 'Amount', 'Description', 'Date'].join(','),
      ...issues.map(issue => [
        issue.type,
        issue.severity,
        issue.transaction_id,
        issue.username,
        issue.amount,
        `"${issue.description}"`,
        format(new Date(issue.created_at), 'yyyy-MM-dd HH:mm:ss'),
      ].join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cpay-reconciliation-${format(new Date(), 'yyyy-MM-dd-HHmmss')}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    toast.success('Report exported');
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'destructive';
      case 'high': return 'destructive';
      case 'medium': return 'default';
      case 'low': return 'secondary';
      default: return 'default';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'stuck_pending': return <AlertTriangle className="h-4 w-4" />;
      case 'missing_webhook': return <AlertTriangle className="h-4 w-4" />;
      case 'balance_mismatch': return <AlertTriangle className="h-4 w-4" />;
      case 'orphaned_transaction': return <AlertTriangle className="h-4 w-4" />;
      default: return null;
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">CPAY Reconciliation</h1>
          <p className="text-muted-foreground">Detect and resolve payment issues</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleExport} variant="outline" disabled={!issues || issues.length === 0}>
            <Download className="h-4 w-4 mr-2" />
            Export Report
          </Button>
          <Button onClick={handleRefresh} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Issues</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{issues?.length || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Critical</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">
              {issues?.filter(i => i.severity === 'critical').length || 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">High Priority</CardTitle>
            <AlertTriangle className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-500">
              {issues?.filter(i => i.severity === 'high').length || 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Status</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {issues?.length === 0 ? (
                <span className="text-green-500">Healthy</span>
              ) : (
                <span className="text-orange-500">Review</span>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Issues Table */}
      <Card>
        <CardHeader>
          <CardTitle>Detected Issues</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">Loading reconciliation data...</div>
          ) : issues && issues.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {issues.map((issue) => (
                  <TableRow key={issue.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getTypeIcon(issue.type)}
                        <span className="capitalize">{issue.type.replace('_', ' ')}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getSeverityColor(issue.severity) as any}>
                        {issue.severity}
                      </Badge>
                    </TableCell>
                    <TableCell>{issue.username}</TableCell>
                    <TableCell>${issue.amount.toFixed(2)}</TableCell>
                    <TableCell className="max-w-xs truncate">{issue.description}</TableCell>
                    <TableCell>{format(new Date(issue.created_at), 'MMM dd, HH:mm')}</TableCell>
                    <TableCell>
                      <Button size="sm" variant="outline">
                        Investigate
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8">
              <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
              <p className="text-lg font-medium">All Clear!</p>
              <p className="text-muted-foreground">No reconciliation issues detected</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
