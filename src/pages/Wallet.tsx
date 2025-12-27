import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
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

const Wallet = () => {
  const { t } = useTranslation();
  const { user, loading, signOut } = useAuth();
  const { isAdmin } = useAdmin();
  const navigate = useNavigate();
  const [showEmailVerification, setShowEmailVerification] = useState(false);

  // ✅ NEW: React Query hooks for all data
  const { data: profile, isLoading: isProfileLoading, refetch: refetchProfile } = useProfile(user?.id);
  
  // PHASE 4: Check withdrawal validation (includes VIP bypass status)
  const { data: validation, isLoading: isValidationLoading = false } = useWithdrawalValidation();

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
        <LoadingSpinner size="lg" text={t("login.signingIn")} />
      </div>
    );
  }

  // ✅ Wait for all data to be fully loaded before rendering conditional content
  // This prevents flickering when data loads from cache then updates with real data
  // Only render conditional banners when ALL data is ready (not loading, not from cache placeholder)
  const isDataReady = !isProfileLoading && !isValidationLoading && profile && profile.earnerBadge && validation !== undefined;
  
  // Check if we're still using placeholder/cached data (React Query shows isLoading=false for cached data)
  // We need to ensure we have fresh data, not just cached placeholder
  const hasFreshData = profile && profile.earnerBadge && !isProfileLoading;

  return (
    <PageLayout
      profile={profile}
      isAdmin={isAdmin}
      onSignOut={signOut}
      isLoading={isProfileLoading || !profile}
      loadingText={t("wallet.loadingWallet")}
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
                  <h1 className="text-2xl font-bold">{t("wallet.title")}</h1>
                  <p className="text-muted-foreground">{t("wallet.subtitle")}</p>
                </div>
              </div>
            </header>

            <div className="p-4 lg:p-8 space-y-6">
              {/* PHASE 5.d: Email Verification Banner (if not verified and not admin) */}
              {!isAdmin && profile && !profile.email_verified && (
                <EmailVerificationBanner onVerifyClick={() => setShowEmailVerification(true)} />
              )}

              {/* PHASE 4: VIP Withdrawal Access Banner - Only render when data is ready */}
              {isDataReady && validation?.hasBypass && (
                <Alert className="bg-primary/10 border-primary/30">
                  <div className="flex items-center gap-2">
                    <Crown className="h-5 w-5 text-primary" />
                    <Sparkles className="h-4 w-4 text-primary" />
                  </div>
                  <AlertTitle className="text-foreground flex items-center gap-2">
                    {t("wallet.vipWithdrawalAccess")}
                    <Badge variant="default" className="bg-primary hover:bg-primary/90">
                      {t("wallet.vip24_7Access")}
                    </Badge>
                  </AlertTitle>
                  <AlertDescription className="text-muted-foreground">
                    {t("wallet.vipDescription")}
                  </AlertDescription>
                </Alert>
              )}

              {/* USDC Fee Savings Banner */}
              <USDCFeeSavingsBanner variant="banner" className="mb-6" />

              {/* Earner Status Banner - Unverified Users Only - Only render when data is ready */}
              {isDataReady && profile.earnerBadge && !profile.earnerBadge.isVerified && (
                <Alert className="mb-6 bg-orange-500/10 border-orange-500/20">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{profile.earnerBadge.icon}</span>
                    <AlertCircle className="h-5 w-5 text-orange-600 dark:text-orange-500" />
                  </div>
                  <AlertTitle className="text-orange-700 dark:text-orange-400">
                    {profile.earnerBadge.badgeText} - {t("wallet.limitedWithdrawalAccess")}
                  </AlertTitle>
                  <AlertDescription className="text-orange-800 dark:text-orange-300 space-y-3">
                    <p>{profile.earnerBadge.upgradePrompt}</p>
                    <Button 
                      onClick={() => navigate("/plans")}
                      className="w-full sm:w-auto bg-orange-600 hover:bg-orange-700 text-white font-semibold"
                    >
                      {t("wallet.becomeVerifiedEarner")}
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
                title={t("wallet.recentTransactions")}
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
