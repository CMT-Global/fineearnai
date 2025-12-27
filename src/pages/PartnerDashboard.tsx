import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { PageLayout } from "@/components/layout/PageLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useIsPartner, usePartnerConfig, usePartnerVouchers, usePurchaseVoucher, useUpdatePaymentMethods } from "@/hooks/usePartner";
import { useProfile } from "@/hooks/useProfile";
import { useAuth } from "@/hooks/useAuth";
import { formatCurrency } from "@/lib/wallet-utils";
import { Loader2, Sparkles, DollarSign, Ticket, TrendingUp, Award, Settings, Plus, Trash2, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { useUsernameValidation } from "@/hooks/useUsernameValidation";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { RankProgressCard } from "@/components/partner/RankProgressCard";
import { PartnerLeaderboard } from "@/components/partner/PartnerLeaderboard";
import { WeeklyBonusProgressCard } from "@/components/partner/WeeklyBonusProgressCard";
import { BonusHistoryTable } from "@/components/partner/BonusHistoryTable";
import { PartnerOnboardingChecklist } from "@/components/partner/PartnerOnboardingChecklist";
import { PartnerDashboardSkeleton } from "@/components/partner/PartnerDashboardSkeleton";
import { PartnerErrorBoundary } from "@/components/partner/PartnerErrorBoundary";
import { VoucherHistoryTable } from "@/components/partner/VoucherHistoryTable";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const PRESET_AMOUNTS = [5, 10, 20, 50, 100, 200, 500];

const PartnerDashboard = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { data: isPartner, isLoading: checkingPartner } = useIsPartner();
  const { data: partnerConfig, isLoading: loadingConfig } = usePartnerConfig();
  const { data: profile } = useProfile(user?.id || '');
  const { data: vouchers, isLoading: loadingVouchers } = usePartnerVouchers();
  const purchaseMutation = usePurchaseVoucher();
  const updatePaymentMutation = useUpdatePaymentMethods();

  const [purchaseDialog, setPurchaseDialog] = useState(false);
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
  const [customAmount, setCustomAmount] = useState("");
  const [recipientUsername, setRecipientUsername] = useState("");

  const [paymentMethods, setPaymentMethods] = useState<any[]>([]);
  const [newPaymentMethod, setNewPaymentMethod] = useState({ type: "", details: "" });
  const [isNavigating, setIsNavigating] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingPurchase, setPendingPurchase] = useState<{ amount: number; costAmount: number; commissionRate: number } | null>(null);

  // Real-time username validation for voucher recipient
  // Phase 4 Fix: Using 'lookup' context - checking if username EXISTS in the system
  const { isAvailable, isChecking, error: usernameError } = useUsernameValidation(recipientUsername, 'lookup');
  
  // In 'lookup' context: isAvailable=false means username EXISTS (which is what we want)
  // Derive a clearer variable name to avoid confusion
  const usernameExists = isAvailable === false;
  const isUsernameValid = recipientUsername.trim().length >= 3 && usernameExists;
  
  // Phase 4: Enhanced balance validation
  const currentAmount = selectedAmount || parseFloat(customAmount) || 0;
  const currentCost = currentAmount * (1 - (partnerConfig?.use_global_commission ? 0.10 : partnerConfig?.commission_rate || 0.10));
  const hasInsufficientBalance = profile && currentCost > profile.deposit_wallet_balance;

  const { data: ranks, isLoading: loadingRanks } = useQuery({
    queryKey: ['partner-ranks'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('partner_ranks')
        .select('*')
        .order('rank_order', { ascending: true });

      if (error) throw error;
      return data;
    },
  });

  const { data: totalSales } = useQuery({
    queryKey: ['partner-total-sales', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vouchers')
        .select('voucher_amount')
        .eq('partner_id', user?.id)
        .eq('status', 'redeemed');

      if (error) throw error;
      return data?.reduce((sum, v) => sum + Number(v.voucher_amount), 0) || 0;
    },
    enabled: !!user?.id,
  });

  useEffect(() => {
    if (partnerConfig?.payment_methods) {
      setPaymentMethods(Array.isArray(partnerConfig.payment_methods) ? partnerConfig.payment_methods : []);
    }
  }, [partnerConfig]);

  // Effect-driven redirect - only runs after partner check is complete
  useEffect(() => {
    console.log('🔄 [PartnerDashboard] useEffect triggered:', { checkingPartner, isPartner });
    
    if (!checkingPartner && isPartner === false) {
      console.log('⚠️ [PartnerDashboard] NOT A PARTNER - Redirecting to become-partner');
      console.log('🔄 [PartnerDashboard] Setting isNavigating to true');
      setIsNavigating(true);
      console.log('🔄 [PartnerDashboard] Calling navigate to /become-partner');
      navigate('/become-partner', { replace: true });
    } else if (isPartner === true) {
      console.log('✅ [PartnerDashboard] IS A PARTNER - Staying on dashboard');
    }
  }, [checkingPartner, isPartner, navigate]);

  // Early return for navigation state - BEFORE loading checks
  if (isNavigating) {
    return (
      <PageLayout profile={profile} onSignOut={signOut}>
        <div className="flex justify-center items-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin" />
          <span className="ml-3 text-muted-foreground">Redirecting...</span>
        </div>
      </PageLayout>
    );
  }

  if (checkingPartner || loadingConfig) {
    return (
      <PageLayout profile={profile} onSignOut={signOut}>
        <PartnerDashboardSkeleton />
      </PageLayout>
    );
  }

  const handleInitiatePurchase = () => {
    const amount = selectedAmount || parseFloat(customAmount);
    
    // Phase 4: Enhanced validation with specific error messages
    if (!amount || amount <= 0 || isNaN(amount)) {
      toast.error(t("partner.toasts.enterValidAmount"));
      return;
    }

    if (amount > 10000) {
      toast.error(t("partner.toasts.maxVoucherAmount"));
      return;
    }

    if (!recipientUsername.trim()) {
      toast.error(t("partner.toasts.enterRecipientUsername"));
      return;
    }

    if (recipientUsername.trim().length < 3) {
      toast.error(t("partner.toasts.usernameMinLength"));
      return;
    }

    if (isChecking) {
      toast.error(t("partner.toasts.waitVerifyUsername"));
      return;
    }

    if (!isUsernameValid) {
      toast.error(usernameError || t("partner.toasts.usernameNotFound"));
      return;
    }

    const commissionRate = partnerConfig?.use_global_commission 
      ? 0.10 
      : partnerConfig?.commission_rate || 0.10;
    
    const costAmount = amount * (1 - commissionRate);

    // Phase 4: Enhanced balance validation
    if (!profile) {
      toast.error(t("partner.toasts.unableToLoadProfile"));
      return;
    }

    if (profile.deposit_wallet_balance < costAmount) {
      const shortfall = costAmount - profile.deposit_wallet_balance;
      toast.error(
        `Insufficient balance. You need ${formatCurrency(shortfall)} more in your deposit wallet.`,
        { duration: 5000 }
      );
      return;
    }

    // Store pending purchase details and show confirmation dialog
    setPendingPurchase({ amount, costAmount, commissionRate });
    setShowConfirmDialog(true);
  };

  const handleConfirmPurchase = () => {
    if (!pendingPurchase) return;

    purchaseMutation.mutate(
      {
        voucher_amount: pendingPurchase.amount,
        recipient_username: recipientUsername.trim(),
      },
      {
        onSuccess: () => {
          setShowConfirmDialog(false);
          setPurchaseDialog(false);
          setSelectedAmount(null);
          setCustomAmount("");
          setRecipientUsername("");
          setPendingPurchase(null);
        },
        onError: () => {
          setShowConfirmDialog(false);
        }
      }
    );
  };

  const addPaymentMethod = () => {
    if (!newPaymentMethod.type || !newPaymentMethod.details) {
      toast.error(t("partner.toasts.fillPaymentMethodFields"));
      return;
    }

    const updated = [...paymentMethods, newPaymentMethod];
    setPaymentMethods(updated);
    setNewPaymentMethod({ type: "", details: "" });
  };

  const removePaymentMethod = (index: number) => {
    const updated = paymentMethods.filter((_, i) => i !== index);
    setPaymentMethods(updated);
  };

  const savePaymentMethods = () => {
    updatePaymentMutation.mutate(paymentMethods);
  };

  const getRankBadge = (rank: string) => {
    const colors: Record<string, string> = {
      bronze: "bg-orange-500",
      silver: "bg-gray-400",
      gold: "bg-yellow-500",
      platinum: "bg-purple-500",
    };

    return (
      <Badge className={`${colors[rank] || colors.bronze} text-white`}>
        <Award className="h-3 w-3 mr-1" />
        {rank.toUpperCase()}
      </Badge>
    );
  };

  const commissionRate = partnerConfig?.use_global_commission 
    ? 0.10 
    : partnerConfig?.commission_rate || 0.10;

  return (
    <PartnerErrorBoundary
      fallbackMessage={t("partner.dashboard.errorLoadingDashboard")}
    >
      <PageLayout profile={profile} onSignOut={signOut}>
        <div className="container mx-auto px-4 py-6">
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <Sparkles className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold">{t("partner.dashboard.title")}</h1>
          </div>
          <p className="text-muted-foreground">
            {t("partner.dashboard.subtitle")}
          </p>
        </div>

        {/* Onboarding Checklist */}
        <div className="mb-6">
          <PartnerOnboardingChecklist />
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {t("partner.dashboard.currentRank")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {getRankBadge(partnerConfig?.current_rank || 'bronze')}
              <p className="text-xs text-muted-foreground mt-2">
                {t("partner.dashboard.commissionRate", { rate: (commissionRate * 100).toFixed(0) })}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {t("partner.dashboard.depositWallet")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatCurrency(profile?.deposit_wallet_balance || 0)}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {t("partner.dashboard.availableForPurchases")}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {t("partner.dashboard.todaysSales")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatCurrency(partnerConfig?.daily_sales || 0)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {t("partner.dashboard.totalVouchersSold")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {partnerConfig?.total_vouchers_sold || 0}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="mb-6 flex gap-3">
          <Button
            variant="outline"
            onClick={() => navigate('/partner/analytics')}
            className="w-full sm:w-auto"
          >
            <TrendingUp className="h-4 w-4 mr-2" />
            {t("partner.dashboard.viewAnalytics")}
          </Button>
        </div>

        {/* Leaderboard */}
        <div className="mb-6">
          <PartnerLeaderboard />
        </div>

        <Tabs defaultValue="purchase" className="space-y-6">
          <TabsList>
            <TabsTrigger value="purchase">
              <Plus className="h-4 w-4 mr-2" />
              {t("partner.dashboard.buyVouchers")}
            </TabsTrigger>
            <TabsTrigger value="vouchers">
              <Ticket className="h-4 w-4 mr-2" />
              {t("partner.dashboard.myVouchers")}
            </TabsTrigger>
            <TabsTrigger value="bonuses">
              <DollarSign className="h-4 w-4 mr-2" />
              {t("partner.dashboard.weeklyBonuses")}
            </TabsTrigger>
            <TabsTrigger value="rank-progress">
              <Award className="h-4 w-4 mr-2" />
              {t("partner.dashboard.rankProgress")}
            </TabsTrigger>
            <TabsTrigger value="payment-methods">
              <Settings className="h-4 w-4 mr-2" />
              {t("partner.dashboard.paymentMethods")}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="purchase">
            <Card>
              <CardHeader>
                <CardTitle>{t("partner.dashboard.purchaseVoucher")}</CardTitle>
                <CardDescription>
                  {t("partner.dashboard.purchaseDescription", { rate: (commissionRate * 100).toFixed(0) })}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <Label className="mb-3 block">{t("partner.voucher.selectAmount")}</Label>
                  <div className="grid grid-cols-4 gap-3">
                    {PRESET_AMOUNTS.map((amount) => {
                      const cost = amount * (1 - commissionRate);
                      const profit = amount - cost;
                      
                      return (
                        <Button
                          key={amount}
                          variant={selectedAmount === amount ? "default" : "outline"}
                          onClick={() => {
                            setSelectedAmount(amount);
                            setCustomAmount("");
                          }}
                          className="h-auto flex-col py-4"
                        >
                          <span className="text-lg font-bold">${amount}</span>
                          <span className="text-xs text-muted-foreground mt-1">
                            {t("partner.voucher.cost")}: ${cost.toFixed(2)}
                          </span>
                          <span className="text-xs text-green-600 font-semibold">
                            {t("partner.voucher.profit")}: ${profit.toFixed(2)}
                          </span>
                        </Button>
                      );
                    })}
                    <div className="flex flex-col gap-2">
                      <Label className="text-xs">Custom Amount</Label>
                      <Input
                        type="number"
                        placeholder="Custom"
                        value={customAmount}
                        onChange={(e) => {
                          setCustomAmount(e.target.value);
                          setSelectedAmount(null);
                        }}
                        min="1"
                        step="0.01"
                      />
                    </div>
                  </div>
                </div>

                {/* Phase 4: Balance warning alert */}
                {hasInsufficientBalance && currentAmount > 0 && (
                  <Alert className="border-amber-500/50 bg-amber-500/10">
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                    <AlertDescription>
                      <strong>{t("partner.dashboard.insufficientBalance")}</strong> {t("partner.dashboard.insufficientBalanceDescription", { needed: formatCurrency(currentCost), have: formatCurrency(profile?.deposit_wallet_balance || 0) })}
                    </AlertDescription>
                  </Alert>
                )}

                <Button 
                  size="lg" 
                  className="w-full"
                  onClick={() => setPurchaseDialog(true)}
                  disabled={!selectedAmount && !customAmount}
                >
                  <DollarSign className="h-5 w-5 mr-2" />
                  {t("partner.dashboard.continueToPurchase")}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="vouchers">
            <VoucherHistoryTable />
          </TabsContent>

          <TabsContent value="rank-progress">
            <RankProgressCard
              currentRank={partnerConfig?.current_rank || 'bronze'}
              totalSales={totalSales || 0}
              ranks={ranks || []}
              isLoading={loadingRanks}
            />
          </TabsContent>

          <TabsContent value="bonuses" className="space-y-6">
            <WeeklyBonusProgressCard />
            <BonusHistoryTable />
          </TabsContent>

          <TabsContent value="payment-methods">
            <Card>
              <CardHeader>
                <CardTitle>{t("partner.dashboard.paymentMethods")}</CardTitle>
                <CardDescription>
                  {t("partner.dashboard.paymentMethodsDescription")}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Payment Instructions Banner */}
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 p-6 rounded-lg border-2 border-blue-200 dark:border-blue-800">
                  <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-3 flex items-center gap-2">
                    <DollarSign className="h-5 w-5" />
                    {t("partner.dashboard.howCustomerPaymentsWork")}
                  </h4>
                  <div className="space-y-3 text-sm text-blue-800 dark:text-blue-200">
                    <div className="flex gap-3">
                      <span className="font-bold text-blue-600 dark:text-blue-400">1.</span>
                      <p>{t("partner.dashboard.customerPaymentStep1")}</p>
                    </div>
                    <div className="flex gap-3">
                      <span className="font-bold text-blue-600 dark:text-blue-400">2.</span>
                      <p>{t("partner.dashboard.customerPaymentStep2")}</p>
                    </div>
                    <div className="flex gap-3">
                      <span className="font-bold text-blue-600 dark:text-blue-400">3.</span>
                      <p>{t("partner.dashboard.customerPaymentStep3")}</p>
                    </div>
                    <div className="flex gap-3">
                      <span className="font-bold text-blue-600 dark:text-blue-400">4.</span>
                      <p>{t("partner.dashboard.customerPaymentStep4")}</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="font-semibold">{t("partner.dashboard.yourPaymentMethods")}</h4>
                  {paymentMethods.length === 0 ? (
                    <div className="text-center py-8 border-2 border-dashed rounded-lg">
                      <DollarSign className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
                      <p className="text-muted-foreground">{t("partner.dashboard.noPaymentMethods")}</p>
                      <p className="text-sm text-muted-foreground mt-1">{t("partner.dashboard.noPaymentMethodsDescription")}</p>
                    </div>
                  ) : (
                    paymentMethods.map((method, idx) => (
                      <div key={idx} className="flex items-center gap-4 p-4 border rounded-lg bg-card">
                        <div className="flex-1">
                          <p className="font-semibold">{method.type}</p>
                          <p className="text-sm text-muted-foreground">{method.details}</p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removePaymentMethod(idx)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))
                  )}
                </div>

                <div className="space-y-4 pt-4 border-t">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>{t("partner.dashboard.paymentMethodType")}</Label>
                      <Input
                        placeholder={t("partner.dashboard.paymentMethodTypePlaceholder")}
                        value={newPaymentMethod.type}
                        onChange={(e) =>
                          setNewPaymentMethod({ ...newPaymentMethod, type: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <Label>{t("partner.dashboard.paymentMethodDetails")}</Label>
                      <Input
                        placeholder={t("partner.dashboard.paymentMethodDetailsPlaceholder")}
                        value={newPaymentMethod.details}
                        onChange={(e) =>
                          setNewPaymentMethod({ ...newPaymentMethod, details: e.target.value })
                        }
                      />
                    </div>
                  </div>
                  <Button onClick={addPaymentMethod} variant="outline" className="w-full">
                    <Plus className="h-4 w-4 mr-2" />
                    {t("partner.dashboard.addPaymentMethod")}
                  </Button>
                </div>

                <Button 
                  onClick={savePaymentMethods} 
                  className="w-full"
                  disabled={updatePaymentMutation.isPending}
                >
                  {updatePaymentMutation.isPending && (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  )}
                  {t("partner.dashboard.savePaymentMethods")}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Purchase Confirmation Dialog */}
      <Dialog open={purchaseDialog} onOpenChange={setPurchaseDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("partner.dashboard.confirmVoucherPurchase")}</DialogTitle>
            <DialogDescription>
              {t("partner.dashboard.pleaseWaitProcessing")}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>{t("partner.voucher.recipientUsername")} *</Label>
              <div className="space-y-1.5">
                <Input
                  placeholder={t("partner.dashboard.enterRecipientUsername")}
                  value={recipientUsername}
                  onChange={(e) => setRecipientUsername(e.target.value)}
                  className={recipientUsername.trim() && !isChecking ? (isUsernameValid ? 'border-green-500 focus-visible:ring-green-500' : 'border-destructive focus-visible:ring-destructive') : ''}
                  disabled={purchaseMutation.isPending}
                />
                {/* Phase 4: Enhanced validation feedback */}
                {recipientUsername.trim().length > 0 && (
                  <div className="text-sm space-y-1">
                    {isChecking && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        <span>{t("partner.dashboard.verifyingUsername")}</span>
                      </div>
                    )}
                    {!isChecking && isUsernameValid && (
                      <div className="flex items-center gap-2 text-green-600 dark:text-green-500">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        <span className="font-medium">{t("partner.dashboard.userFound")}</span>
                      </div>
                    )}
                    {!isChecking && recipientUsername.trim().length >= 3 && !isUsernameValid && (
                      <div className="flex items-start gap-2 text-destructive">
                        <XCircle className="h-3.5 w-3.5 mt-0.5" />
                        <div>
                          <div className="font-medium">{usernameError || t("partner.dashboard.userNotFound")}</div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {t("partner.dashboard.doubleCheckSpelling")}
                          </div>
                        </div>
                      </div>
                    )}
                    {!isChecking && recipientUsername.trim().length < 3 && (
                      <div className="text-muted-foreground text-xs">
                        {t("partner.toasts.usernameMinLength")}
                      </div>
                    )}
                  </div>
                )}</div>
            </div>

            <div className="bg-muted p-4 rounded-lg space-y-2">
              <div className="flex justify-between">
                <span>{t("partner.voucher.amount")}:</span>
                <span className="font-bold">
                  {formatCurrency(selectedAmount || parseFloat(customAmount) || 0)}
                </span>
              </div>
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>{t("partner.voucher.cost")} ({(commissionRate * 100).toFixed(0)}% {t("partner.voucher.discount")}):</span>
                <span>
                  {formatCurrency(
                    (selectedAmount || parseFloat(customAmount) || 0) * (1 - commissionRate)
                  )}
                </span>
              </div>
              <div className="flex justify-between text-green-600 font-semibold pt-2 border-t">
                <span>{t("partner.voucher.profit")}:</span>
                <span>
                  {formatCurrency(
                    (selectedAmount || parseFloat(customAmount) || 0) * commissionRate
                  )}
                </span>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button 
              variant="outline" 
              onClick={() => setPurchaseDialog(false)}
              disabled={purchaseMutation.isPending}
            >
              {t("common.cancel")}
            </Button>
            <Button 
              onClick={handleInitiatePurchase}
              disabled={purchaseMutation.isPending || !isUsernameValid || isChecking || hasInsufficientBalance}
            >
              {purchaseMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {t("common.saving")}
                </>
              ) : (
                <>
                  <DollarSign className="h-4 w-4 mr-2" />
                  {t("partner.dashboard.reviewPurchase")}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog - Phase 4: Enhanced with loading states */}
      <Dialog open={showConfirmDialog} onOpenChange={(open) => {
        // Prevent closing during purchase
        if (!open && purchaseMutation.isPending) return;
        setShowConfirmDialog(open);
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {purchaseMutation.isPending ? (
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-amber-500" />
              )}
              {purchaseMutation.isPending ? t("partner.dashboard.processingPurchase") : t("partner.dashboard.confirmVoucherPurchase")}
            </DialogTitle>
            <DialogDescription>
              {purchaseMutation.isPending 
                ? t("partner.dashboard.pleaseWaitProcessing")
                : t("partner.dashboard.reviewCarefully")
              }
            </DialogDescription>
          </DialogHeader>

          <Alert className="border-amber-500/50 bg-amber-500/10">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <AlertDescription className="text-sm">
              <strong>{t("common.warning")}:</strong> {t("partner.dashboard.warningFinal")}
            </AlertDescription>
          </Alert>

          <div className="space-y-3">
            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-muted-foreground">{t("partner.voucher.recipientUsername")}:</span>
              <span className="font-semibold">{recipientUsername}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-muted-foreground">{t("partner.voucher.amount")}:</span>
              <span className="font-bold text-lg">
                {pendingPurchase && formatCurrency(pendingPurchase.amount)}
              </span>
            </div>
            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-muted-foreground">{t("partner.voucher.cost")}:</span>
              <span className="font-semibold">
                {pendingPurchase && formatCurrency(pendingPurchase.costAmount)}
              </span>
            </div>
            <div className="flex justify-between items-center py-2 bg-green-500/10 rounded-lg px-3">
              <span className="text-green-700 dark:text-green-400 font-medium">{t("partner.voucher.profit")}:</span>
              <span className="text-green-700 dark:text-green-400 font-bold">
                {pendingPurchase && formatCurrency(pendingPurchase.amount * pendingPurchase.commissionRate)}
              </span>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button 
              variant="outline" 
              onClick={() => setShowConfirmDialog(false)}
              disabled={purchaseMutation.isPending}
            >
              {t("common.cancel")}
            </Button>
            <Button 
              onClick={handleConfirmPurchase}
              disabled={purchaseMutation.isPending}
              className="bg-green-600 hover:bg-green-700"
            >
              {purchaseMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {t("common.saving")}
                </>
              ) : (
                t("partner.dashboard.confirmAndPurchase")
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageLayout>
    </PartnerErrorBoundary>
  );
};

export default PartnerDashboard;
