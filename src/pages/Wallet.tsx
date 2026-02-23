import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";
import { useProfile } from "@/hooks/useProfile";
import { useRealtimeTransactions } from "@/hooks/useRealtimeTransactions";
import { useWithdrawalValidation } from "@/hooks/useWithdrawalValidation";
import { supabase } from "@/integrations/supabase/client";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { PageLoading } from "@/components/shared/PageLoading";
import { WalletCard } from "@/components/wallet/WalletCard";
import { RecentTransactionsCard } from "@/components/transactions/RecentTransactionsCard";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Wallet as WalletIcon, Crown, Sparkles, Info, ArrowDownToLine, Banknote } from "lucide-react";
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

  // Partner program config: voucher redemption only available when program is enabled (partners can sell vouchers)
  const { data: partnerProgramConfig, isFetched: isPartnerProgramFetched } = useQuery({
    queryKey: ["partner-program-config-wallet"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("platform_config")
        .select("value")
        .eq("key", "partner_program_config")
        .maybeSingle();
      if (error) throw error;
      return (data?.value as { isEnabled?: boolean }) ?? { isEnabled: true };
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
  });
  // Only show voucher block after config has loaded AND program is enabled (avoids flash when disabled)
  const isPartnerProgramEnabled = isPartnerProgramFetched && (partnerProgramConfig?.isEnabled === true);

  // User-to-user transfers (Deposit Wallet only): show Send Funds when enabled
  const { data: userTransfersConfig, isFetched: isUserTransfersConfigFetched } = useQuery({
    queryKey: ["user-transfers-config-wallet"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("platform_config")
        .select("value")
        .eq("key", "user_transfers_config")
        .maybeSingle();
      if (error) throw error;
      const v = (data?.value as { enabled?: boolean; min_amount?: number; max_amount?: number }) ?? {};
      return {
        enabled: v.enabled === true,
        min_amount: v.min_amount ?? 1,
        max_amount: v.max_amount ?? 100000,
      };
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
  });
  const userTransfersEnabled = isUserTransfersConfigFetched && (userTransfersConfig?.enabled === true);

  // Enable real-time transaction updates
  useRealtimeTransactions(user?.id);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/login");
    }
  }, [user, loading, navigate]);

  // Early return ONLY for auth loading (before we have user)
  if (loading || !user) {
    return <PageLoading text={t("login.signingIn")} />;
  }

  // ✅ Wait for all data to be fully loaded before rendering conditional content
  // This prevents flickering when data loads from cache then updates with real data
  // Only render conditional banners when ALL data is ready (not loading, not from cache placeholder)
  const isDataReady = !isProfileLoading && !isValidationLoading && profile && profile.earnerBadge && validation !== undefined;
  
  // Check if we're still using placeholder/cached data (React Query shows isLoading=false for cached data)
  // We need to ensure we have fresh data, not just cached placeholder
  const hasFreshData = profile && profile.earnerBadge && !isProfileLoading;

  if (isProfileLoading || !profile) {
    return <PageLoading text={t("wallet.loadingWallet")} />;
  }

  if (!isPartnerProgramFetched || !isUserTransfersConfigFetched) {
    return <PageLoading text={t("wallet.loadingWallet")} />;
  }

  return (
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

              {/* Wallet Balances */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <WalletCard 
                  depositBalance={Number(profile.deposit_wallet_balance)}
                  earningsBalance={Number(profile.earnings_wallet_balance)}
                  onBalanceUpdate={refetchProfile}
                  userTransfersEnabled={userTransfersEnabled}
                  minTransfer={userTransfersConfig?.min_amount ?? 1}
                  maxTransfer={userTransfersConfig?.max_amount ?? 100000}
                />
              </div>

              {/* Wallet usage info - attractive card */}
              <Card className="overflow-hidden border-2 border-primary/10 bg-gradient-to-br from-primary/5 via-background to-primary/5">
                <CardContent className="p-0">
                  <div className="flex items-center gap-2 px-5 pt-5 pb-2">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                      <Info className="h-5 w-5 text-primary" />
                    </div>
                    <p className="text-sm font-semibold text-foreground">
                      {t("wallet.walletInfo.title")}
                    </p>
                  </div>
                  <div className="grid gap-0 sm:grid-cols-2">
                    <div className="flex gap-4 border-t border-primary/10 px-5 py-4 sm:border-r sm:border-t-0 sm:px-6">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--wallet-deposit))]/15">
                        <ArrowDownToLine className="h-5 w-5 text-[hsl(var(--wallet-deposit))]" />
                      </div>
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          {t("wallet.walletInfo.depositLabel")}
                        </p>
                        <p className="mt-1 text-sm leading-relaxed text-foreground">
                          {t("wallet.walletInfo.depositWallet")}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-4 border-t border-primary/10 px-5 py-4 sm:border-t-0 sm:px-6">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--wallet-earnings))]/15">
                        <Banknote className="h-5 w-5 text-[hsl(var(--wallet-earnings))]" />
                      </div>
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          {t("wallet.walletInfo.earningsLabel")}
                        </p>
                        <p className="mt-1 text-sm leading-relaxed text-foreground">
                          {t("wallet.walletInfo.earningsWallet")}
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Voucher Redemption - only when Partner Program is enabled (approved partners sell vouchers) */}
              {isPartnerProgramEnabled && (
                <VoucherRedemptionCard 
                  userId={user?.id || ''} 
                  onRedemptionSuccess={refetchProfile}
                />
              )}

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
  );
};

export default Wallet;
