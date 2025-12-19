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
import { Button } from "@/components/ui/button";
import { Wallet as WalletIcon, Crown, Sparkles, AlertCircle, ArrowRight } from "lucide-react";
import { USDCFeeSavingsBanner } from "@/components/wallet/USDCFeeSavingsBanner";
import { EmailVerificationBanner } from "@/components/dashboard/EmailVerificationBanner";
import { EmailVerificationDialog } from "@/components/dashboard/EmailVerificationDialog";
import { VoucherRedemptionCard } from "@/components/wallet/VoucherRedemptionCard";
import { useState } from "react";

const Wallet = () => {
  const { user, loading, signOut } = useAuth();
  const { isAdmin } = useAdmin();
  const navigate = useNavigate();
  const [showEmailVerification, setShowEmailVerification] = useState(false);

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
              {/* PHASE 5.d: Email Verification Banner (if not verified and not admin) */}
              {!isAdmin && profile && !profile.email_verified && (
                <EmailVerificationBanner onVerifyClick={() => setShowEmailVerification(true)} />
              )}

              {/* PHASE 4: VIP Withdrawal Access Banner */}
              {validation?.hasBypass && (
                <Alert className="bg-primary/10 border-primary/30">
                  <div className="flex items-center gap-2">
                    <Crown className="h-5 w-5 text-primary" />
                    <Sparkles className="h-4 w-4 text-primary" />
                  </div>
                  <AlertTitle className="text-foreground flex items-center gap-2">
                    VIP Withdrawal Access Enabled
                    <Badge variant="default" className="bg-primary hover:bg-primary/90">
                      24/7 Access
                    </Badge>
                  </AlertTitle>
                  <AlertDescription className="text-muted-foreground">
                    Your account has unrestricted withdrawal access. You can withdraw any day at any time without schedule restrictions.
                  </AlertDescription>
                </Alert>
              )}

              {/* USDC Fee Savings Banner */}
              <USDCFeeSavingsBanner variant="banner" className="mb-6" />

              {/* Earner Status Banner - Unverified Users Only */}
              {profile.earnerBadge && !profile.earnerBadge.isVerified && (
                <Alert className="mb-6 bg-orange-500/10 border-orange-500/20">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{profile.earnerBadge.icon}</span>
                    <AlertCircle className="h-5 w-5 text-orange-600 dark:text-orange-500" />
                  </div>
                  <AlertTitle className="text-orange-700 dark:text-orange-400">
                    {profile.earnerBadge.badgeText} - Limited Withdrawal Access
                  </AlertTitle>
                  <AlertDescription className="text-orange-800 dark:text-orange-300 space-y-3">
                    <p>{profile.earnerBadge.upgradePrompt}</p>
                    <Button 
                      onClick={() => navigate("/plans")}
                      className="w-full sm:w-auto bg-orange-600 hover:bg-orange-700 text-white font-semibold"
                    >
                      Become a Verified Earner
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
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

              {/* Voucher Redemption */}
              <VoucherRedemptionCard 
                userId={user?.id || ''} 
                onRedemptionSuccess={refetchProfile}
              />

              {/* Recent Transactions */}
              <RecentTransactionsCard 
                userId={user?.id || ''} 
                maxItems={10} 
                showPagination={true} 
                title="Recent Transactions"
              />
            </div>

            {/* PHASE 5.d: Email Verification Dialog */}
            <EmailVerificationDialog 
              open={showEmailVerification}
              onOpenChange={setShowEmailVerification}
              userEmail={profile?.email || ''}
              onVerificationSuccess={() => {
                refetchProfile();
                setShowEmailVerification(false);
              }}
            />
        </>
      )}
    </PageLayout>
  );
};

export default Wallet;
