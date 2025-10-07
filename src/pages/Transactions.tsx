import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  ArrowLeft, 
  ArrowUpRight, 
  ArrowDownRight,
  Filter 
} from "lucide-react";
import { formatCurrency, getTransactionTypeLabel, getTransactionStatusColor, getTransactionTypeColor } from "@/lib/wallet-utils";
import { format } from "date-fns";

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

const Transactions = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loadingTransactions, setLoadingTransactions] = useState(true);
  const [filter, setFilter] = useState<"all" | "deposit" | "earnings">("all");

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

  const loadTransactions = async () => {
    setLoadingTransactions(true);
    const { data, error } = await supabase
      .from("transactions")
      .select("*")
      .eq("user_id", user?.id)
      .order("created_at", { ascending: false });

    if (data) {
      setTransactions(data);
    }
    setLoadingTransactions(false);
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
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-6xl mx-auto p-8">
        <div className="mb-6">
          <Button 
            variant="ghost" 
            onClick={() => navigate("/dashboard")}
            className="mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
          <h1 className="text-3xl font-bold">Transaction History</h1>
          <p className="text-muted-foreground">View all your wallet transactions</p>
        </div>

        <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)} className="mb-6">
          <TabsList>
            <TabsTrigger value="all">All Transactions</TabsTrigger>
            <TabsTrigger value="deposit">Deposit Wallet</TabsTrigger>
            <TabsTrigger value="earnings">Earnings Wallet</TabsTrigger>
          </TabsList>
        </Tabs>

        {loadingTransactions ? (
          <Card className="p-8 text-center">
            <p className="text-muted-foreground">Loading transactions...</p>
          </Card>
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
          </div>
        )}
      </div>
    </div>
  );
};

export default Transactions;
