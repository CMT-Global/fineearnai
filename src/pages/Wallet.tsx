import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Sidebar } from "@/components/layout/Sidebar";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { WalletCard } from "@/components/wallet/WalletCard";
import { WithdrawalHistoryCard } from "@/components/wallet/WithdrawalHistoryCard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  ArrowUpRight, 
  ArrowDownRight,
  Wallet as WalletIcon
} from "lucide-react";
import { formatCurrency, getTransactionTypeLabel, getTransactionStatusColor, getTransactionTypeColor } from "@/lib/wallet-utils";
import { format } from "date-fns";
import { handleError } from "@/lib/error-handler";

interface Transaction {
  id: string;
  type: string;
  amount: number;
  wallet_type: string;
  status: string;
  payment_gateway: string | null;
  new_balance: number;
  description: string | null;
  created_at: string;
}

interface WithdrawalRequest {
  id: string;
  amount: number;
  fee: number;
  net_amount: number;
  payment_method: string;
  payout_address: string;
  status: string;
  rejection_reason: string | null;
  created_at: string;
  processed_at: string | null;
}

const Wallet = () => {
  const { user, loading, signOut } = useAuth();
  const { isAdmin } = useAdmin();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<any>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [withdrawalRequests, setWithdrawalRequests] = useState<WithdrawalRequest[]>([]);
  const [loadingTransactions, setLoadingTransactions] = useState(true);
  const [loadingWithdrawals, setLoadingWithdrawals] = useState(true);
  const [filter, setFilter] = useState<"all" | "deposit" | "earnings" | "withdrawals">("all");

  useEffect(() => {
    if (!loading && !user) {
      navigate("/login");
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user) {
      loadWalletData();
    }
  }, [user]);

  const loadWithdrawalRequests = async () => {
    try {
      setLoadingWithdrawals(true);
      
      const { data: withdrawalsData } = await supabase
        .from("withdrawal_requests")
        .select("*")
        .eq("user_id", user?.id)
        .order("created_at", { ascending: false })
        .limit(50);

      if (withdrawalsData) {
        setWithdrawalRequests(withdrawalsData);
      }
    } catch (error) {
      handleError(error, "loading withdrawal requests");
    } finally {
      setLoadingWithdrawals(false);
    }
  };

  const loadWalletData = async () => {
    try {
      setLoadingTransactions(true);
      
      // Load profile
      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user?.id)
        .maybeSingle();
      
      if (profileData) {
        setProfile(profileData);
      }
      
      // Load transactions
      const { data: transactionsData } = await supabase
        .from("transactions")
        .select("*")
        .eq("user_id", user?.id)
        .order("created_at", { ascending: false })
        .limit(50);

      if (transactionsData) {
        setTransactions(transactionsData);
      }

      // Load withdrawal requests
      await loadWithdrawalRequests();
    } catch (error) {
      handleError(error, "loading wallet data");
    } finally {
      setLoadingTransactions(false);
    }
  };

  const filteredTransactions = transactions.filter((tx) => {
    if (filter === "all") return true;
    return tx.wallet_type === filter;
  });

  const isCredit = (type: string) => {
    return ['deposit', 'task_earning', 'referral_commission', 'adjustment'].includes(type);
  };

  if (loading || !user) {
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
              depositBalance={parseFloat(profile.deposit_wallet_balance)}
              earningsBalance={parseFloat(profile.earnings_wallet_balance)}
              onBalanceUpdate={loadWalletData}
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
              loadingWithdrawals ? (
                <div className="py-8 text-center">
                  <LoadingSpinner size="md" text="Loading withdrawal history..." />
                </div>
              ) : withdrawalRequests.length === 0 ? (
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
            ) : loadingTransactions ? (
              <div className="py-8 text-center">
                <LoadingSpinner size="md" text="Loading transactions..." />
              </div>
            ) : filteredTransactions.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-muted-foreground">No transactions found</p>
              </div>
            ) : (
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
                          {isCredit(tx.type) ? '+' : '-'}{formatCurrency(Math.abs(tx.amount))}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Balance: {formatCurrency(tx.new_balance)}
                        </p>
                        <p className={`text-xs capitalize ${getTransactionStatusColor(tx.status)}`}>
                          {tx.status}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </main>
    </div>
  );
};

export default Wallet;
