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
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  ArrowUpRight, 
  ArrowDownRight,
  AlertCircle,
  RefreshCw,
  Search,
  Filter,
  Calendar as CalendarIcon,
  X
} from "lucide-react";
import { formatCurrency, getTransactionTypeLabel, getTransactionStatusColor, getTransactionTypeColor } from "@/lib/wallet-utils";
import { format, subDays } from "date-fns";
import { TransactionSkeleton } from "@/components/transactions/TransactionSkeleton";
import { toast } from "@/hooks/use-toast";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

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
  
  // Advanced filters
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("newest");
  const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: undefined,
    to: undefined,
  });
  const [showFilters, setShowFilters] = useState(false);
  
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

  const filteredTransactions = transactions
    .filter((tx) => {
      // Wallet type filter (from tabs)
      if (filter !== "all" && tx.wallet_type !== filter) return false;
      
      // Transaction type filter
      if (typeFilter !== "all" && tx.type !== typeFilter) return false;
      
      // Status filter
      if (statusFilter !== "all" && tx.status !== statusFilter) return false;
      
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
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
      if (dateRange.from || dateRange.to) {
        const txDate = new Date(tx.created_at);
        if (dateRange.from && txDate < dateRange.from) return false;
        if (dateRange.to) {
          const endOfDay = new Date(dateRange.to);
          endOfDay.setHours(23, 59, 59, 999);
          if (txDate > endOfDay) return false;
        }
      }
      
      return true;
    })
    .sort((a, b) => {
      switch (sortBy) {
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
    });

  const clearAllFilters = () => {
    setSearchQuery("");
    setTypeFilter("all");
    setStatusFilter("all");
    setSortBy("newest");
    setDateRange({ from: undefined, to: undefined });
  };

  const activeFiltersCount = 
    (searchQuery ? 1 : 0) +
    (typeFilter !== "all" ? 1 : 0) +
    (statusFilter !== "all" ? 1 : 0) +
    (dateRange.from || dateRange.to ? 1 : 0) +
    (sortBy !== "newest" ? 1 : 0);

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

        {/* Search and Filters */}
        <Card className="p-4 mb-6">
          <div className="space-y-4">
            {/* Search Bar */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by description, ID, or payment gateway..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
                {searchQuery && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute right-1 top-1/2 transform -translate-y-1/2 h-7 w-7 p-0"
                    onClick={() => setSearchQuery("")}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <Button
                variant={showFilters ? "default" : "outline"}
                size="icon"
                onClick={() => setShowFilters(!showFilters)}
                className="relative"
              >
                <Filter className="h-4 w-4" />
                {activeFiltersCount > 0 && (
                  <Badge 
                    variant="destructive" 
                    className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center text-xs"
                  >
                    {activeFiltersCount}
                  </Badge>
                )}
              </Button>
            </div>

            {/* Advanced Filters */}
            {showFilters && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pt-4 border-t">
                {/* Transaction Type Filter */}
                <div>
                  <label className="text-sm font-medium mb-2 block">Transaction Type</label>
                  <Select value={typeFilter} onValueChange={setTypeFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="All types" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      <SelectItem value="deposit">Deposit</SelectItem>
                      <SelectItem value="withdrawal">Withdrawal</SelectItem>
                      <SelectItem value="task_earning">Task Earning</SelectItem>
                      <SelectItem value="referral_commission">Referral Commission</SelectItem>
                      <SelectItem value="plan_upgrade">Plan Upgrade</SelectItem>
                      <SelectItem value="transfer">Transfer</SelectItem>
                      <SelectItem value="adjustment">Adjustment</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Status Filter */}
                <div>
                  <label className="text-sm font-medium mb-2 block">Status</label>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="All statuses" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="failed">Failed</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Sort By */}
                <div>
                  <label className="text-sm font-medium mb-2 block">Sort By</label>
                  <Select value={sortBy} onValueChange={setSortBy}>
                    <SelectTrigger>
                      <SelectValue placeholder="Sort by" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="newest">Newest First</SelectItem>
                      <SelectItem value="oldest">Oldest First</SelectItem>
                      <SelectItem value="amount-high">Amount (High to Low)</SelectItem>
                      <SelectItem value="amount-low">Amount (Low to High)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Date Range Picker */}
                <div>
                  <label className="text-sm font-medium mb-2 block">Date Range</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !dateRange.from && !dateRange.to && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dateRange.from ? (
                          dateRange.to ? (
                            <>
                              {format(dateRange.from, "MMM dd")} - {format(dateRange.to, "MMM dd, yyyy")}
                            </>
                          ) : (
                            format(dateRange.from, "MMM dd, yyyy")
                          )
                        ) : (
                          <span>Pick a date range</span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <div className="p-3 border-b space-y-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full justify-start"
                          onClick={() => setDateRange({ from: subDays(new Date(), 7), to: new Date() })}
                        >
                          Last 7 days
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full justify-start"
                          onClick={() => setDateRange({ from: subDays(new Date(), 30), to: new Date() })}
                        >
                          Last 30 days
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full justify-start"
                          onClick={() => setDateRange({ from: subDays(new Date(), 90), to: new Date() })}
                        >
                          Last 90 days
                        </Button>
                        {(dateRange.from || dateRange.to) && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="w-full justify-start"
                            onClick={() => setDateRange({ from: undefined, to: undefined })}
                          >
                            <X className="h-4 w-4 mr-2" />
                            Clear dates
                          </Button>
                        )}
                      </div>
                      <Calendar
                        mode="range"
                        selected={{ from: dateRange.from, to: dateRange.to }}
                        onSelect={(range) => setDateRange({ from: range?.from, to: range?.to })}
                        numberOfMonths={2}
                        className="pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Clear All Filters */}
                {activeFiltersCount > 0 && (
                  <div className="md:col-span-2 lg:col-span-4 flex justify-end">
                    <Button variant="ghost" size="sm" onClick={clearAllFilters}>
                      <X className="h-4 w-4 mr-2" />
                      Clear all filters ({activeFiltersCount})
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </Card>

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
