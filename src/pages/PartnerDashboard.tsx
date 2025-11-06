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
import { Loader2, Sparkles, DollarSign, Ticket, TrendingUp, Award, Settings, Plus, Trash2, CheckCircle2, XCircle } from "lucide-react";
import { useUsernameValidation } from "@/hooks/useUsernameValidation";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { RankProgressCard } from "@/components/partner/RankProgressCard";
import { PartnerLeaderboard } from "@/components/partner/PartnerLeaderboard";
import { WeeklyBonusProgressCard } from "@/components/partner/WeeklyBonusProgressCard";
import { BonusHistoryTable } from "@/components/partner/BonusHistoryTable";
import { PartnerOnboardingChecklist } from "@/components/partner/PartnerOnboardingChecklist";
import { PartnerDashboardSkeleton } from "@/components/partner/PartnerDashboardSkeleton";
import { PartnerErrorBoundary } from "@/components/partner/PartnerErrorBoundary";
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

  // Real-time username validation for voucher recipient
  const { isAvailable, isChecking, error: usernameError } = useUsernameValidation(recipientUsername);
  
  // For voucher sending: username must EXIST (isAvailable = false means username is taken/exists)
  const isUsernameValid = recipientUsername.trim().length >= 3 && isAvailable === false;

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

  const handlePurchaseVoucher = () => {
    const amount = selectedAmount || parseFloat(customAmount);
    
    if (!amount || amount <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    if (!recipientUsername.trim()) {
      toast.error("Please enter recipient username");
      return;
    }

    const commissionRate = partnerConfig?.use_global_commission 
      ? 0.10 
      : partnerConfig?.commission_rate || 0.10;
    
    const costAmount = amount * (1 - commissionRate);

    if (!profile || profile.deposit_wallet_balance < costAmount) {
      toast.error("Insufficient balance in deposit wallet");
      return;
    }

    purchaseMutation.mutate(
      {
        voucher_amount: amount,
        recipient_username: recipientUsername.trim(),
      },
      {
        onSuccess: () => {
          setPurchaseDialog(false);
          setSelectedAmount(null);
          setCustomAmount("");
          setRecipientUsername("");
        },
      }
    );
  };

  const addPaymentMethod = () => {
    if (!newPaymentMethod.type || !newPaymentMethod.details) {
      toast.error("Please fill in all payment method fields");
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
      fallbackMessage="There was an error loading your partner dashboard. Please try again."
    >
      <PageLayout profile={profile} onSignOut={signOut}>
        <div className="container mx-auto px-4 py-6">
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <Sparkles className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold">Partner Dashboard</h1>
          </div>
          <p className="text-muted-foreground">
            Manage your voucher sales and track your earnings
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
                Current Rank
              </CardTitle>
            </CardHeader>
            <CardContent>
              {getRankBadge(partnerConfig?.current_rank || 'bronze')}
              <p className="text-xs text-muted-foreground mt-2">
                {(commissionRate * 100).toFixed(0)}% Commission Rate
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Deposit Wallet
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatCurrency(profile?.deposit_wallet_balance || 0)}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Available for voucher purchases
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Today's Sales
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
                Total Vouchers Sold
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
            View Analytics Dashboard
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
              Buy Vouchers
            </TabsTrigger>
            <TabsTrigger value="vouchers">
              <Ticket className="h-4 w-4 mr-2" />
              My Vouchers
            </TabsTrigger>
            <TabsTrigger value="bonuses">
              <DollarSign className="h-4 w-4 mr-2" />
              Weekly Bonuses
            </TabsTrigger>
            <TabsTrigger value="rank-progress">
              <Award className="h-4 w-4 mr-2" />
              Rank Progress
            </TabsTrigger>
            <TabsTrigger value="payment-methods">
              <Settings className="h-4 w-4 mr-2" />
              Payment Methods
            </TabsTrigger>
          </TabsList>

          <TabsContent value="purchase">
            <Card>
              <CardHeader>
                <CardTitle>Purchase Top-Up Vouchers</CardTitle>
                <CardDescription>
                  Buy vouchers at {(commissionRate * 100).toFixed(0)}% discount and sell them for instant profit
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <Label className="mb-3 block">Select Amount or Enter Custom</Label>
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
                            Cost: ${cost.toFixed(2)}
                          </span>
                          <span className="text-xs text-green-600 font-semibold">
                            Profit: ${profit.toFixed(2)}
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

                <Button 
                  size="lg" 
                  className="w-full"
                  onClick={() => setPurchaseDialog(true)}
                  disabled={!selectedAmount && !customAmount}
                >
                  <DollarSign className="h-5 w-5 mr-2" />
                  Continue to Purchase
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="vouchers">
            <Card>
              <CardHeader>
                <CardTitle>Voucher History</CardTitle>
                <CardDescription>All vouchers you've purchased</CardDescription>
              </CardHeader>
              <CardContent>
                {loadingVouchers ? (
                  <div className="flex justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin" />
                  </div>
                ) : vouchers && vouchers.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Code</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Redeemed By</TableHead>
                        <TableHead>Created</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {vouchers.map((voucher: any) => (
                        <TableRow key={voucher.id}>
                          <TableCell className="font-mono">{voucher.voucher_code}</TableCell>
                          <TableCell className="font-bold">
                            {formatCurrency(voucher.voucher_amount)}
                          </TableCell>
                          <TableCell>
                            <Badge variant={voucher.status === 'redeemed' ? 'secondary' : 'default'}>
                              {voucher.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {voucher.redeemer?.username || '—'}
                          </TableCell>
                          <TableCell>
                            {formatDistanceToNow(new Date(voucher.created_at), { addSuffix: true })}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-12">
                    <Ticket className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-muted-foreground">No vouchers purchased yet</p>
                  </div>
                )}
              </CardContent>
            </Card>
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
                <CardTitle>Payment Methods</CardTitle>
                <CardDescription>
                  Configure how customers should pay you for vouchers
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Payment Instructions Banner */}
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 p-6 rounded-lg border-2 border-blue-200 dark:border-blue-800">
                  <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-3 flex items-center gap-2">
                    <DollarSign className="h-5 w-5" />
                    How Customer Payments Work
                  </h4>
                  <div className="space-y-3 text-sm text-blue-800 dark:text-blue-200">
                    <div className="flex gap-3">
                      <span className="font-bold text-blue-600 dark:text-blue-400">1.</span>
                      <p>Customer contacts you to purchase a voucher (via WhatsApp, Telegram, etc.)</p>
                    </div>
                    <div className="flex gap-3">
                      <span className="font-bold text-blue-600 dark:text-blue-400">2.</span>
                      <p>Customer sends payment using one of your configured methods below</p>
                    </div>
                    <div className="flex gap-3">
                      <span className="font-bold text-blue-600 dark:text-blue-400">3.</span>
                      <p>You purchase the voucher from your dashboard and send the code to customer</p>
                    </div>
                    <div className="flex gap-3">
                      <span className="font-bold text-blue-600 dark:text-blue-400">4.</span>
                      <p>Customer redeems the voucher and you keep your commission! 🎉</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="font-semibold">Your Payment Methods</h4>
                  {paymentMethods.length === 0 ? (
                    <div className="text-center py-8 border-2 border-dashed rounded-lg">
                      <DollarSign className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
                      <p className="text-muted-foreground">No payment methods added yet</p>
                      <p className="text-sm text-muted-foreground mt-1">Add methods below so customers know how to pay you</p>
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
                      <Label>Payment Type</Label>
                      <Input
                        placeholder="e.g., Bank Transfer, GCash"
                        value={newPaymentMethod.type}
                        onChange={(e) =>
                          setNewPaymentMethod({ ...newPaymentMethod, type: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <Label>Account Details</Label>
                      <Input
                        placeholder="Account number/details"
                        value={newPaymentMethod.details}
                        onChange={(e) =>
                          setNewPaymentMethod({ ...newPaymentMethod, details: e.target.value })
                        }
                      />
                    </div>
                  </div>
                  <Button onClick={addPaymentMethod} variant="outline" className="w-full">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Payment Method
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
                  Save Payment Methods
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
            <DialogTitle>Confirm Voucher Purchase</DialogTitle>
            <DialogDescription>
              Review details before purchasing the voucher
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Recipient Username *</Label>
              <Input
                placeholder="Enter username"
                value={recipientUsername}
                onChange={(e) => setRecipientUsername(e.target.value)}
                className={recipientUsername.trim() && !isChecking ? (isUsernameValid ? 'border-green-500' : 'border-destructive') : ''}
              />
              {recipientUsername.trim().length > 0 && (
                <div className="text-sm mt-1.5">
                  {isChecking && (
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Loader2 className="h-3 w-3 animate-spin" /> Checking username...
                    </span>
                  )}
                  {!isChecking && isUsernameValid && (
                    <span className="text-green-600 flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" /> Valid username - ready to send
                    </span>
                  )}
                  {!isChecking && recipientUsername.trim().length >= 3 && !isUsernameValid && (
                    <span className="text-destructive flex items-center gap-1">
                      <XCircle className="h-3 w-3" /> {usernameError || 'Username not found'}
                    </span>
                  )}
                  {!isChecking && recipientUsername.trim().length < 3 && (
                    <span className="text-muted-foreground text-xs">
                      Enter at least 3 characters
                    </span>
                  )}
                </div>
              )}
            </div>

            <div className="bg-muted p-4 rounded-lg space-y-2">
              <div className="flex justify-between">
                <span>Voucher Value:</span>
                <span className="font-bold">
                  {formatCurrency(selectedAmount || parseFloat(customAmount) || 0)}
                </span>
              </div>
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Your Cost ({(commissionRate * 100).toFixed(0)}% discount):</span>
                <span>
                  {formatCurrency(
                    (selectedAmount || parseFloat(customAmount) || 0) * (1 - commissionRate)
                  )}
                </span>
              </div>
              <div className="flex justify-between text-green-600 font-semibold pt-2 border-t">
                <span>Your Profit:</span>
                <span>
                  {formatCurrency(
                    (selectedAmount || parseFloat(customAmount) || 0) * commissionRate
                  )}
                </span>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPurchaseDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handlePurchaseVoucher}
              disabled={purchaseMutation.isPending || !isUsernameValid || isChecking}
            >
              {purchaseMutation.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Confirm Purchase
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageLayout>
    </PartnerErrorBoundary>
  );
};

export default PartnerDashboard;
