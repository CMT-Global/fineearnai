import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";
import { useProfile } from "@/hooks/useProfile";
import { useRealtimeTransactions } from "@/hooks/useRealtimeTransactions";
import { useWithdrawalValidation } from "@/hooks/useWithdrawalValidation";
import { PageLayout } from "@/components/layout/PageLayout";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { WalletCard } from "@/components/wallet/WalletCard";
import { RecentTransactionsCard } from "@/components/transactions/RecentTransactionsCard";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Wallet as WalletIcon, Crown, Sparkles } from "lucide-react";

const Wallet = () => {
  const { user, loading, signOut } = useAuth();
  const { isAdmin } = useAdmin();
  const navigate = useNavigate();

  // ✅ NEW: React Query hooks for all data
  const { data: profile, isLoading: isProfileLoading, refetch: refetchProfile } = useProfile(user?.id);
  
  // PHASE 4: Check withdrawal validation (includes VIP bypass status)
  const { data: validation } = useWithdrawalValidation();

  // Enable real-time transaction updates
  useRealtimeTransactions(user?.id);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/login");
    }
  }, [user, loading, navigate]);

  // Early return ONLY for auth loading (before we have user)
  if (loading || !user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <LoadingSpinner size="lg" text="Authenticating..." />
      </div>
    );
  }

  return (
    <PageLayout
      profile={profile}
      isAdmin={isAdmin}
      onSignOut={signOut}
      isLoading={isProfileLoading || !profile}
      loadingText="Loading wallet..."
    >
      {profile && (
        <>
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
              {/* PHASE 4: VIP Withdrawal Access Banner */}
              {validation?.hasBypass && (
                <Alert className="bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-950/20 dark:to-yellow-950/20 border-amber-200 dark:border-amber-800">
                  <div className="flex items-center gap-2">
                    <Crown className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                    <Sparkles className="h-4 w-4 text-amber-500 dark:text-amber-400" />
                  </div>
                  <AlertTitle className="text-amber-900 dark:text-amber-100 flex items-center gap-2">
                    VIP Withdrawal Access Enabled
                    <Badge variant="default" className="bg-amber-600 hover:bg-amber-700">
                      24/7 Access
                    </Badge>
                  </AlertTitle>
                  <AlertDescription className="text-amber-800 dark:text-amber-200">
                    Your account has unrestricted withdrawal access. You can withdraw any day at any time without schedule restrictions.
                  </AlertDescription>
                </Alert>
              )}

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
        </>
      )}
    </PageLayout>
  );
};

export default Wallet;
