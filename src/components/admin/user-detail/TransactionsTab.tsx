import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Download, Eye, UserCog } from "lucide-react";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";
import { getTransactionTypeLabel } from "@/lib/wallet-utils";

interface TransactionsTabProps {
  userId: string;
  userData?: any;
  onChangeUpline?: () => void;
}

// Helper function to determine if transaction is a credit (positive) or debit (negative)
const isCredit = (type: string): boolean => {
  return ['deposit', 'task_earning', 'referral_commission', 'adjustment'].includes(type);
};

// Helper function to calculate which page numbers to show in pagination
const getPageNumber = (index: number, currentPage: number, totalPages: number): number => {
  if (totalPages <= 5) return index + 1;
  if (currentPage <= 3) return index + 1;
  if (currentPage >= totalPages - 2) return totalPages - 4 + index;
  return currentPage - 2 + index;
};

export const TransactionsTab = ({ userId, userData, onChangeUpline }: TransactionsTabProps) => {
  const navigate = useNavigate();
  const upline = userData?.upline;
  const [page, setPage] = useState(1);
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const limit = 50;

  // Fetch transactions
  const { data: transactionsData, isLoading } = useQuery({
    queryKey: ['admin-user-transactions', userId, page, typeFilter, statusFilter],
    queryFn: async () => {
      const from = (page - 1) * limit;
      const to = from + limit - 1;
      
      let query = supabase
        .from('transactions')
        .select('*', { count: 'exact' })
        .eq('user_id', userId);

      if (typeFilter !== 'all') {
        query = query.eq('type', typeFilter as any);
      }

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter as any);
      }

      const { data, error, count } = await query
        .order('created_at', { ascending: false })
        .range(from, to);

      if (error) throw error;

      return {
        transactions: data || [],
        totalCount: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      };
    },
    enabled: !!userId,
  });

  const handleExport = async () => {
    if (!transactionsData?.transactions) return;

    const csvHeaders = ['Date', 'Type', 'Amount', 'Wallet', 'Status', 'Description', 'New Balance'];
    const csvRows = transactionsData.transactions.map((t: any) => [
      format(new Date(t.created_at), 'yyyy-MM-dd HH:mm:ss'),
      t.type,
      t.amount,
      t.wallet_type,
      t.status,
      t.description || '',
      t.new_balance
    ]);

    const csvContent = [
      csvHeaders.join(','),
      ...csvRows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `user-${userId}-transactions.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Transaction History</CardTitle>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleExport}
              disabled={!transactionsData?.transactions || transactionsData.transactions.length === 0}
            >
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 mb-4">
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="deposit">Deposit</SelectItem>
                <SelectItem value="withdrawal">Withdrawal</SelectItem>
                <SelectItem value="task_earning">Task Earning</SelectItem>
                <SelectItem value="referral_commission">Referral Commission</SelectItem>
                <SelectItem value="plan_upgrade">Plan Upgrade</SelectItem>
                <SelectItem value="adjustment">Adjustment</SelectItem>
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <div className="space-y-2">
              {[...Array(10)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : transactionsData?.transactions && transactionsData.transactions.length > 0 ? (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Wallet</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>New Balance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactionsData.transactions.map((transaction: any) => (
                    <TableRow key={transaction.id}>
                      <TableCell className="text-sm">
                        {format(new Date(transaction.created_at), "PP p")}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{getTransactionTypeLabel(transaction.type)}</Badge>
                      </TableCell>
                      <TableCell className={`font-semibold ${isCredit(transaction.type) ? "text-green-600" : "text-red-600"}`}>
                        {isCredit(transaction.type) ? "+" : "-"}${(transaction.amount || 0).toFixed(2)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={transaction.wallet_type === 'deposit' ? 'default' : 'secondary'}>
                          {transaction.wallet_type}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            transaction.status === "completed"
                              ? "default"
                              : transaction.status === "pending"
                              ? "secondary"
                              : "destructive"
                          }
                        >
                          {transaction.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-xs truncate">
                        {transaction.description || "-"}
                      </TableCell>
                      <TableCell className="font-medium">
                        ${(transaction.new_balance || 0).toFixed(2)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">
              No transactions found
            </p>
          )}

          {/* Pagination Controls */}
          {transactionsData && transactionsData.totalPages > 1 && (
            <div className="flex items-center justify-between px-2 mt-4 pt-4 border-t">
              <div className="text-sm text-muted-foreground">
                Showing {((page - 1) * limit) + 1} to {Math.min(page * limit, transactionsData.totalCount)} of {transactionsData.totalCount} transactions
              </div>
              
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious 
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      className={page === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                    />
                  </PaginationItem>
                  
                  {/* Page numbers - show up to 5 pages */}
                  {Array.from({ length: Math.min(5, transactionsData.totalPages) }, (_, i) => {
                    const pageNum = getPageNumber(i, page, transactionsData.totalPages);
                    return (
                      <PaginationItem key={pageNum}>
                        <PaginationLink
                          onClick={() => setPage(pageNum)}
                          isActive={page === pageNum}
                          className="cursor-pointer"
                        >
                          {pageNum}
                        </PaginationLink>
                      </PaginationItem>
                    );
                  })}
                  
                  <PaginationItem>
                    <PaginationNext 
                      onClick={() => setPage(p => Math.min(transactionsData.totalPages, p + 1))}
                      className={page >= transactionsData.totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Upline Info (if exists) */}
      {upline && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>User's Upline</CardTitle>
              <Button variant="outline" size="sm" onClick={onChangeUpline}>
                <UserCog className="h-4 w-4 mr-2" />
                Change Upline
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Username</p>
                <p className="font-medium">{upline.username}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Email</p>
                <p className="font-medium">{upline.email}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Plan</p>
                <Badge variant="outline">{upline.membership_plan}</Badge>
              </div>
              <div className="flex items-center gap-2">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => navigate(`/admin/users/${upline.id}`)}
                >
                  <Eye className="h-4 w-4 mr-2" />
                  View Profile
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};