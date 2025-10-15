import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sidebar } from "@/components/layout/Sidebar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  ArrowUpRight, 
  ArrowDownRight,
  AlertCircle,
  RefreshCw
} from "lucide-react";
import { formatCurrency, getTransactionTypeLabel, getTransactionStatusColor, getTransactionTypeColor } from "@/lib/wallet-utils";
import { format } from "date-fns";
import { TransactionSkeleton } from "@/components/transactions/TransactionSkeleton";
import { toast } from "@/hooks/use-toast";

interface Transaction {
  id: string;
  type: string;
  amount: number;
  wallet_type: string;
  status: string;
  payment_gateway: string | null;
  gateway_transaction_id: string | null;
  new_balance: number;
  description: string | null;
  metadata: any;
  created_at: string;
}

const Transactions = () => {
  const { user, loading, signOut } = useAuth();
  const { isAdmin } = useAdmin();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<any>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loadingTransactions, setLoadingTransactions] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "deposit" | "earnings">("all");
  const [totalCount, setTotalCount] = useState<number>(0);
  const [hasMore, setHasMore] = useState(true);
  
  const PAGE_SIZE = 50;

  useEffect(() => {
    if (!loading && !user) {
      navigate("/login");
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user) {
      loadTransactions();
    }
  }, [user]);

  // Real-time subscription for transactions
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('user-transactions')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'transactions',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setTransactions(prev => [payload.new as Transaction, ...prev]);
            toast({
              title: "New Transaction",
              description: `${getTransactionTypeLabel(payload.new.type)} - ${formatCurrency(payload.new.amount)}`,
            });
          } else if (payload.eventType === 'UPDATE') {
            setTransactions(prev =>
              prev.map(tx => tx.id === payload.new.id ? payload.new as Transaction : tx)
            );
          } else if (payload.eventType === 'DELETE') {
            setTransactions(prev => prev.filter(tx => tx.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const loadTransactions = async (append = false) => {
    try {
      if (append) {
        setLoadingMore(true);
      } else {
        setLoadingTransactions(true);
        setError(null);
      }
      
      // Load profile
      if (!append) {
        const { data: profileData, error: profileError } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user?.id)
          .single();
        
        if (profileError) throw profileError;
        
        if (profileData) {
          setProfile(profileData);
        }
      }
      
      // Get total count
      const { count } = await supabase
        .from("transactions")
        .select("*", { count: 'exact', head: true })
        .eq("user_id", user?.id);
      
      if (count !== null) {
        setTotalCount(count);
      }
      
      // Load transactions with pagination
      const from = append ? transactions.length : 0;
      const to = from + PAGE_SIZE - 1;
      
      const { data, error: txError } = await supabase
        .from("transactions")
        .select("*")
        .eq("user_id", user?.id)
        .order("created_at", { ascending: false })
        .range(from, to);

      if (txError) throw txError;

      if (data) {
        if (append) {
          setTransactions(prev => [...prev, ...data]);
        } else {
          setTransactions(data);
        }
        setHasMore(data.length === PAGE_SIZE);
      }
    } catch (err: any) {
      console.error("Error loading transactions:", err);
      setError(err.message || "Failed to load transactions");
      toast({
        title: "Error",
        description: "Failed to load transactions. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoadingTransactions(false);
      setLoadingMore(false);
    }
  };

  const loadMore = () => {
    if (!loadingMore && hasMore) {
      loadTransactions(true);
    }
  };

  const filteredTransactions = transactions.filter((tx) => {
    if (filter === "all") return true;
    return tx.wallet_type === filter;
  });

  const isCredit = (type: string) => {
    return ['deposit', 'task_earning', 'referral_commission', 'adjustment'].includes(type);
  };

  if (loading || !user || !profile) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col lg:flex-row">
      <Sidebar profile={profile} isAdmin={isAdmin} onSignOut={signOut} />
      
      <main className="flex-1 overflow-auto lg:mt-0 mt-16">
        <div className="container max-w-6xl mx-auto p-4 lg:p-8">
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Transaction History</h1>
              <p className="text-muted-foreground">
                View all your wallet transactions {totalCount > 0 && `(${totalCount} total)`}
              </p>
            </div>
          </div>
        </div>

        <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)} className="mb-6">
          <TabsList>
            <TabsTrigger value="all">All Transactions</TabsTrigger>
            <TabsTrigger value="deposit">Deposit Wallet</TabsTrigger>
            <TabsTrigger value="earnings">Earnings Wallet</TabsTrigger>
          </TabsList>
        </Tabs>

        {error ? (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="flex items-center justify-between">
              <span>{error}</span>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => loadTransactions()}
                className="ml-4"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Retry
              </Button>
            </AlertDescription>
          </Alert>
        ) : loadingTransactions ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <TransactionSkeleton key={i} />
            ))}
          </div>
        ) : filteredTransactions.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-muted-foreground">No transactions found</p>
          </Card>
        ) : (
          <div className="space-y-3">
            {filteredTransactions.map((tx) => (
              <Card key={tx.id} className="p-4 hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div 
                      className={`h-10 w-10 rounded-full flex items-center justify-center ${
                        isCredit(tx.type) ? 'bg-green-100' : 'bg-red-100'
                      }`}
                    >
                      {isCredit(tx.type) ? (
                        <ArrowDownRight className="h-5 w-5 text-green-600" />
                      ) : (
                        <ArrowUpRight className="h-5 w-5 text-red-600" />
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
              </Card>
            ))}
            
            {/* Load More Button */}
            {hasMore && filteredTransactions.length > 0 && (
              <div className="flex justify-center mt-6">
                <Button
                  onClick={() => loadMore()}
                  disabled={loadingMore}
                  variant="outline"
                  size="lg"
                >
                  {loadingMore ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Loading more...
                    </>
                  ) : (
                    <>Load More Transactions</>
                  )}
                </Button>
              </div>
            )}
            
            {/* Pagination Info */}
            {filteredTransactions.length > 0 && (
              <div className="text-center mt-4 text-sm text-muted-foreground">
                Showing {filteredTransactions.length} of {totalCount} transactions
              </div>
            )}
          </div>
        )}
        </div>
      </main>
    </div>
  );
};

export default Transactions;
