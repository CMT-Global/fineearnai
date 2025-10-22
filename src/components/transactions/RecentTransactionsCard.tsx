import { useState } from "react";
import { useTransactions } from "@/hooks/useTransactions";
import { useWithdrawalRequests } from "@/hooks/useWithdrawalRequests";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { 
  ArrowUpRight, 
  ArrowDownRight,
} from "lucide-react";
import { CurrencyDisplay } from "@/components/ui/CurrencyDisplay";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { WithdrawalHistoryCard } from "@/components/wallet/WithdrawalHistoryCard";
import { getTransactionTypeLabel, getTransactionStatusColor, getTransactionTypeColor } from "@/lib/wallet-utils";
import { format } from "date-fns";

interface RecentTransactionsCardProps {
  userId: string;
  maxItems?: number;
  showPagination?: boolean;
  title?: string;
  externalFilter?: {
    searchQuery?: string;
    typeFilter?: string;
    statusFilter?: string;
    dateRange?: { from: Date | undefined; to: Date | undefined };
    sortBy?: string;
  };
  hideTitle?: boolean;
  hideTabs?: boolean;
}

export const RecentTransactionsCard = ({ 
  userId, 
  maxItems = 10, 
  showPagination = true,
  title = "Recent Transactions",
  externalFilter,
  hideTitle = false,
  hideTabs = false
}: RecentTransactionsCardProps) => {
  const [filter, setFilter] = useState<"all" | "deposit" | "earnings" | "withdrawals">("all");
  const [currentPage, setCurrentPage] = useState(1);

  const { data: transactionsData, isLoading: isTransactionsLoading } = useTransactions(userId, currentPage, maxItems);
  const { data: withdrawalRequests, isLoading: isWithdrawalsLoading } = useWithdrawalRequests(userId);

  const transactions = transactionsData?.transactions || [];
  const totalPages = transactionsData?.totalPages || 1;
  const totalCount = transactionsData?.totalCount || 0;

  const filteredTransactions = transactions
    .filter((tx) => {
      // Hide pending transactions from user view
      if (tx.status === "pending") return false;
      
      // Apply tab filter (if not using external filter)
      if (!externalFilter && filter !== "all" && tx.wallet_type !== filter) return false;
      
      // Apply external filters if provided
      if (externalFilter) {
        // Wallet type filter (from tabs)
        if (filter !== "all" && tx.wallet_type !== filter) return false;
        
        // Transaction type filter
        if (externalFilter.typeFilter && externalFilter.typeFilter !== "all" && tx.type !== externalFilter.typeFilter) return false;
        
        // Status filter
        if (externalFilter.statusFilter && externalFilter.statusFilter !== "all" && tx.status !== externalFilter.statusFilter) return false;
        
        // Search filter
        if (externalFilter.searchQuery) {
          const query = externalFilter.searchQuery.toLowerCase();
          const matchesDescription = tx.description?.toLowerCase().includes(query);
          const matchesId = tx.id.toLowerCase().includes(query);
          const matchesType = getTransactionTypeLabel(tx.type).toLowerCase().includes(query);
          const matchesGateway = tx.payment_gateway?.toLowerCase().includes(query);
          const matchesGatewayId = tx.gateway_transaction_id?.toLowerCase().includes(query);
          
          if (!matchesDescription && !matchesId && !matchesType && !matchesGateway && !matchesGatewayId) {
            return false;
          }
        }
        
        // Date range filter
        if (externalFilter.dateRange?.from || externalFilter.dateRange?.to) {
          const txDate = new Date(tx.created_at);
          if (externalFilter.dateRange.from && txDate < externalFilter.dateRange.from) return false;
          if (externalFilter.dateRange.to) {
            const endOfDay = new Date(externalFilter.dateRange.to);
            endOfDay.setHours(23, 59, 59, 999);
            if (txDate > endOfDay) return false;
          }
        }
      }
      
      return true;
    })
    .sort((a, b) => {
      // Apply external sort if provided
      if (externalFilter?.sortBy) {
        switch (externalFilter.sortBy) {
          case "oldest":
            return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
          case "amount-high":
            return Math.abs(b.amount) - Math.abs(a.amount);
          case "amount-low":
            return Math.abs(a.amount) - Math.abs(b.amount);
          case "newest":
          default:
            return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        }
      }
      // Default sort (newest first)
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

  const isCredit = (type: string) => {
    return ['deposit', 'task_earning', 'referral_commission', 'adjustment'].includes(type);
  };

  return (
    <Card className="p-6">
      {!hideTitle && (
        <div className="mb-6">
          <h2 className="text-xl font-semibold mb-1">{title}</h2>
          <p className="text-sm text-muted-foreground">View your wallet transaction history</p>
        </div>
      )}

      {!hideTabs && (
        <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)} className="mb-6">
          <TabsList>
            <TabsTrigger value="all">All Transactions</TabsTrigger>
            <TabsTrigger value="deposit">Deposit Wallet</TabsTrigger>
            <TabsTrigger value="earnings">Earnings Wallet</TabsTrigger>
            <TabsTrigger value="withdrawals">Withdrawal History</TabsTrigger>
          </TabsList>
        </Tabs>
      )}

      {filter === "withdrawals" ? (
        isWithdrawalsLoading ? (
          <div className="py-8 text-center">
            <LoadingSpinner size="md" text="Loading withdrawal history..." />
          </div>
        ) : !withdrawalRequests || withdrawalRequests.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-muted-foreground">No withdrawal requests found</p>
          </div>
        ) : (
          <div className="space-y-3">
            {withdrawalRequests.map((withdrawal) => (
              <WithdrawalHistoryCard key={withdrawal.id} withdrawal={withdrawal} />
            ))}
          </div>
        )
      ) : isTransactionsLoading ? (
        <div className="py-8 text-center">
          <LoadingSpinner size="md" text="Loading transactions..." />
        </div>
      ) : filteredTransactions.length === 0 ? (
        <div className="py-8 text-center">
          <p className="text-muted-foreground">No transactions found</p>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {filteredTransactions.map((tx) => (
              <div 
                key={tx.id} 
                className="p-4 rounded-lg border bg-card hover:shadow-sm transition-shadow"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div 
                      className={`h-10 w-10 rounded-full flex items-center justify-center ${
                        isCredit(tx.type) 
                          ? 'bg-[hsl(var(--wallet-earnings))]/10' 
                          : 'bg-destructive/10'
                      }`}
                    >
                      {isCredit(tx.type) ? (
                        <ArrowDownRight className="h-5 w-5 text-[hsl(var(--wallet-earnings))]" />
                      ) : (
                        <ArrowUpRight className="h-5 w-5 text-destructive" />
                      )}
                    </div>
                    <div>
                      <p className="font-semibold">{getTransactionTypeLabel(tx.type)}</p>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(tx.created_at), "MMM dd, yyyy 'at' hh:mm a")}
                      </p>
                      {tx.description && (
                        <p className="text-xs text-muted-foreground mt-1">{tx.description}</p>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-lg font-bold ${getTransactionTypeColor(tx.type)}`}>
                      {isCredit(tx.type) ? '+' : '-'}<CurrencyDisplay amountUSD={Math.abs(tx.amount)} />
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Balance: <CurrencyDisplay amountUSD={tx.new_balance} />
                    </p>
                    <p className={`text-xs capitalize ${getTransactionStatusColor(tx.status)}`}>
                      {tx.status}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination Controls */}
          {showPagination && filteredTransactions.length > 0 && totalPages > 1 && (
            <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t">
              <p className="text-sm text-muted-foreground">
                Showing {((currentPage - 1) * maxItems) + 1} to{' '}
                {Math.min(currentPage * maxItems, totalCount)} of{' '}
                {totalCount} transactions
              </p>
              
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious 
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      className={currentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                    />
                  </PaginationItem>
                  
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (currentPage <= 3) {
                      pageNum = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = currentPage - 2 + i;
                    }
                    
                    return (
                      <PaginationItem key={pageNum}>
                        <PaginationLink
                          onClick={() => setCurrentPage(pageNum)}
                          isActive={currentPage === pageNum}
                          className="cursor-pointer"
                        >
                          {pageNum}
                        </PaginationLink>
                      </PaginationItem>
                    );
                  })}
                  
                  {totalPages > 5 && currentPage < totalPages - 2 && (
                    <PaginationItem>
                      <PaginationEllipsis />
                    </PaginationItem>
                  )}
                  
                  <PaginationItem>
                    <PaginationNext 
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      className={currentPage === totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}
        </>
      )}
    </Card>
  );
};
