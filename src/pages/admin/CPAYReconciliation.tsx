import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RefreshCw, AlertTriangle, CheckCircle, Download } from "lucide-react";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { toast } from "sonner";
import { format } from "date-fns";
import { useTranslation } from "react-i18next";
import { useLanguage } from "@/contexts/LanguageContext";
import { useLanguageSync } from "@/hooks/useLanguageSync";

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
  const { t } = useTranslation();
  const { userLanguage, isLoading: isLanguageLoading } = useLanguage();
  useLanguageSync();
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
        const minutes = Math.round((Date.now() - new Date(tx.created_at).getTime()) / 60000);
        issues.push({
          id: `stuck-${tx.id}`,
          type: 'stuck_pending',
          severity: 'high',
          transaction_id: tx.id,
          user_id: tx.user_id,
          username: tx.profiles?.username || t("admin.cpayReconciliation.unknown"),
          amount: tx.amount,
          description: t("admin.cpayReconciliation.depositStuck", { minutes }),
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
        const hours = Math.round((Date.now() - new Date(wr.created_at).getTime()) / 3600000);
        issues.push({
          id: `stuck-wd-${wr.id}`,
          type: 'stuck_pending',
          severity: 'critical',
          transaction_id: wr.id,
          user_id: wr.user_id,
          username: wr.profiles?.username || t("admin.cpayReconciliation.unknown"),
          amount: wr.amount,
          description: t("admin.cpayReconciliation.withdrawalPending", { hours }),
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
      toast.success(t("admin.cpayReconciliation.successRefreshed"));
    } catch (error) {
      toast.error(t("admin.cpayReconciliation.errorFailedToRefresh"));
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    if (!issues || issues.length === 0) {
      toast.error(t("admin.cpayReconciliation.errorNoIssuesToExport"));
      return;
    }

    const csv = [
      [t("admin.cpayReconciliation.csv.type"), t("admin.cpayReconciliation.csv.severity"), t("admin.cpayReconciliation.csv.transactionId"), t("admin.cpayReconciliation.csv.user"), t("admin.cpayReconciliation.csv.amount"), t("admin.cpayReconciliation.csv.description"), t("admin.cpayReconciliation.csv.date")].join(','),
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
    toast.success(t("admin.cpayReconciliation.successExported"));
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
          <h1 className="text-3xl font-bold">{t("admin.cpayReconciliation.title")}</h1>
          <p className="text-muted-foreground">{t("admin.cpayReconciliation.subtitle")}</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleExport} variant="outline" disabled={!issues || issues.length === 0}>
            <Download className="h-4 w-4 mr-2" />
            {t("admin.cpayReconciliation.exportReport")}
          </Button>
          <Button onClick={handleRefresh} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            {t("common.refresh")}
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("admin.cpayReconciliation.stats.totalIssues")}</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{issues?.length || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("admin.cpayReconciliation.stats.critical")}</CardTitle>
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
            <CardTitle className="text-sm font-medium">{t("admin.cpayReconciliation.stats.highPriority")}</CardTitle>
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
            <CardTitle className="text-sm font-medium">{t("admin.cpayReconciliation.stats.status")}</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {issues?.length === 0 ? (
                <span className="text-green-500">{t("admin.cpayReconciliation.stats.healthy")}</span>
              ) : (
                <span className="text-orange-500">{t("admin.cpayReconciliation.stats.review")}</span>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Issues Table */}
      <Card>
        <CardHeader>
          <CardTitle>{t("admin.cpayReconciliation.detectedIssues")}</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <PageLoading text={t("admin.cpayReconciliation.loading")} />
          ) : issues && issues.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("admin.cpayReconciliation.table.type")}</TableHead>
                  <TableHead>{t("admin.cpayReconciliation.table.severity")}</TableHead>
                  <TableHead>{t("admin.cpayReconciliation.table.user")}</TableHead>
                  <TableHead>{t("admin.cpayReconciliation.table.amount")}</TableHead>
                  <TableHead>{t("admin.cpayReconciliation.table.description")}</TableHead>
                  <TableHead>{t("admin.cpayReconciliation.table.date")}</TableHead>
                  <TableHead>{t("admin.cpayReconciliation.table.action")}</TableHead>
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
                        {t("admin.cpayReconciliation.investigate")}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8">
              <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
              <p className="text-lg font-medium">{t("admin.cpayReconciliation.allClear")}</p>
              <p className="text-muted-foreground">{t("admin.cpayReconciliation.noIssuesDetected")}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
