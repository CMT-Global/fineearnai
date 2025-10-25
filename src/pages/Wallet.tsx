import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";
import { useProfile } from "@/hooks/useProfile";
import { useRealtimeTransactions } from "@/hooks/useRealtimeTransactions";
import { Sidebar } from "@/components/layout/Sidebar";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { WalletCard } from "@/components/wallet/WalletCard";
import { RecentTransactionsCard } from "@/components/transactions/RecentTransactionsCard";
import { Wallet as WalletIcon } from "lucide-react";

const Wallet = () => {
  const { user, loading, signOut } = useAuth();
  const { isAdmin } = useAdmin();
  const navigate = useNavigate();

  // ✅ NEW: React Query hooks for all data
  const { data: profile, isLoading: isProfileLoading, refetch: refetchProfile } = useProfile(user?.id);

  // Enable real-time transaction updates
  useRealtimeTransactions(user?.id);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/login");
    }
  }, [user, loading, navigate]);

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
          <RecentTransactionsCard 
            userId={user?.id || ''} 
            maxItems={10} 
            showPagination={true} 
            title="Recent Transactions"
          />
        </div>
      </main>
    </div>
  );
};

export default Wallet;
