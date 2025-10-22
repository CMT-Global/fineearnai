import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";
import { useProfile } from "@/hooks/useProfile";
import { useTransactions } from "@/hooks/useTransactions";
import { useWithdrawalRequests } from "@/hooks/useWithdrawalRequests";
import { Card } from "@/components/ui/card";
import { Sidebar } from "@/components/layout/Sidebar";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { WalletCard } from "@/components/wallet/WalletCard";
import { WithdrawalHistoryCard } from "@/components/wallet/WithdrawalHistoryCard";
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
  Wallet as WalletIcon
} from "lucide-react";
import { CurrencyDisplay } from "@/components/ui/CurrencyDisplay";
import { getTransactionTypeLabel, getTransactionStatusColor, getTransactionTypeColor } from "@/lib/wallet-utils";
import { format } from "date-fns";

const Wallet = () => {
  const { user, loading, signOut } = useAuth();
  const { isAdmin } = useAdmin();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<"all" | "deposit" | "earnings" | "withdrawals">("all");
  const [currentPage, setCurrentPage] = useState(1);
  
  const WALLET_PAGE_SIZE = 10;

  // ✅ NEW: React Query hooks for all data
  const { data: profile, isLoading: isProfileLoading, refetch: refetchProfile } = useProfile(user?.id);
  const { data: transactionsData, isLoading: isTransactionsLoading } = useTransactions(user?.id, currentPage, WALLET_PAGE_SIZE);
  const { data: withdrawalRequests, isLoading: isWithdrawalsLoading } = useWithdrawalRequests(user?.id);

  const transactions = transactionsData?.transactions || [];
  const totalPages = transactionsData?.totalPages || 1;
  const totalCount = transactionsData?.totalCount || 0;

  useEffect(() => {
    if (!loading && !user) {
      navigate("/login");
    }
  }, [user, loading, navigate]);

  const filteredTransactions = transactions.filter((tx) => {
    if (filter === "all") return true;
    return tx.wallet_type === filter;
  });

  const isCredit = (type: string) => {
    return ['deposit', 'task_earning', 'referral_commission', 'adjustment'].includes(type);
  };

  if (loading || !user || isProfileLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <LoadingSpinner size="lg" text="Loading wallet..." />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <LoadingSpinner size="lg" text="Loading profile..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col lg:flex-row">
      <Sidebar profile={profile} isAdmin={isAdmin} onSignOut={signOut} />
      
      <main className="flex-1 overflow-auto lg:mt-0 mt-16">
        {/* Header */}
        <header className="bg-card border-b px-4 lg:px-8 py-6">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-[hsl(var(--wallet-deposit))]/10 flex items-center justify-center">
              <WalletIcon className="h-5 w-5 text-[hsl(var(--wallet-deposit))]" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Wallet</h1>
              <p className="text-muted-foreground">Manage your deposits, earnings, and transactions</p>
            </div>
          </div>
        </header>

        <div className="p-4 lg:p-8 space-y-6">
          {/* Wallet Balances */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <WalletCard 
              depositBalance={Number(profile.deposit_wallet_balance)}
              earningsBalance={Number(profile.earnings_wallet_balance)}
              onBalanceUpdate={refetchProfile}
            />
          </div>

          {/* Recent Transactions */}
          <Card className="p-6">
            <div className="mb-6">
              <h2 className="text-xl font-semibold mb-1">Recent Transactions</h2>
              <p className="text-sm text-muted-foreground">View your wallet transaction history</p>
            </div>

            <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)} className="mb-6">
              <TabsList>
                <TabsTrigger value="all">All Transactions</TabsTrigger>
                <TabsTrigger value="deposit">Deposit Wallet</TabsTrigger>
                <TabsTrigger value="earnings">Earnings Wallet</TabsTrigger>
                <TabsTrigger value="withdrawals">Withdrawal History</TabsTrigger>
              </TabsList>
            </Tabs>

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
                {filteredTransactions.length > 0 && totalPages > 1 && (
                  <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t">
                    <p className="text-sm text-muted-foreground">
                      Showing {((currentPage - 1) * WALLET_PAGE_SIZE) + 1} to{' '}
                      {Math.min(currentPage * WALLET_PAGE_SIZE, totalCount)} of{' '}
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
        </div>
      </main>
    </div>
  );
};

export default Wallet;
