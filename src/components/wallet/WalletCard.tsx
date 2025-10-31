import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Wallet, ArrowUpRight, ArrowDownRight, Loader2, InfoIcon, AlertCircle, Crown, Sparkles } from "lucide-react";
import { CurrencyDisplay } from "@/components/ui/CurrencyDisplay";
import { CPAYCheckoutIframe } from "./CPAYCheckoutIframe";
import { useWithdrawalValidation } from "@/hooks/useWithdrawalValidation";
import { WithdrawalCountdown } from "./WithdrawalCountdown";
import { useCurrencyConversion } from '@/hooks/useCurrencyConversion';

interface PaymentProcessor {
  id: string;
  name: string;
  processor_type: string;
  is_active: boolean;
  fee_fixed: number;
  fee_percentage: number;
  min_amount: number;
  max_amount: number;
  config: any;
}

interface WalletCardProps {
  depositBalance: number;
  earningsBalance: number;
  onBalanceUpdate: () => void;
}

export const WalletCard = ({ depositBalance, earningsBalance, onBalanceUpdate }: WalletCardProps) => {
  const [depositAmount, setDepositAmount] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [depositMethod, setDepositMethod] = useState("");
  const [withdrawMethod, setWithdrawMethod] = useState("");
  const [accountDetails, setAccountDetails] = useState("");
  const [depositLoading, setDepositLoading] = useState(false);
  const [withdrawLoading, setWithdrawLoading] = useState(false);
  const [depositDialogOpen, setDepositDialogOpen] = useState(false);
  const [withdrawDialogOpen, setWithdrawDialogOpen] = useState(false);
  const [depositProcessors, setDepositProcessors] = useState<PaymentProcessor[]>([]);
  const [withdrawalProcessors, setWithdrawalProcessors] = useState<PaymentProcessor[]>([]);
  const [loadingProcessors, setLoadingProcessors] = useState(true);
  
  // CPAY iframe state
  const [showCpayIframe, setShowCpayIframe] = useState(false);
  const [cpayCheckoutUrl, setCpayCheckoutUrl] = useState("");
  const [cpayTransactionId, setCpayTransactionId] = useState("");
  const [cpayOrderId, setCpayOrderId] = useState("");
  const [cpayAmount, setCpayAmount] = useState(0);
  const [cpayCurrency, setCpayCurrency] = useState("");
  
  const { data: validation } = useWithdrawalValidation();
  const { convertAmount, userCurrency, exchangeRate } = useCurrencyConversion();

  useEffect(() => {
    loadPaymentProcessors();
  }, []);

  const loadPaymentProcessors = async () => {
    try {
      setLoadingProcessors(true);
      const { data, error } = await supabase
        .from("payment_processors")
        .select("*")
        .eq("is_active", true);

      if (error) throw error;

      // Filter deposit processors: exclude CPAY processors missing cpay_checkout_id
      const deposits = (data || [])
        .filter(p => p.processor_type === 'deposit')
        .filter(p => {
          // If it's a CPAY processor, ensure it has cpay_checkout_id in config
          const config = p.config as any;
          if (config?.processor === 'cpay') {
            return !!config?.cpay_checkout_id;
          }
          return true;
        });
      
      const withdrawals = (data || []).filter(p => 
        p.processor_type === 'withdrawal' || p.processor_type === 'manual'
      );

      setDepositProcessors(deposits);
      setWithdrawalProcessors(withdrawals);
    } catch (error) {
      console.error("Error loading payment processors:", error);
      toast.error("Failed to load payment methods");
    } finally {
      setLoadingProcessors(false);
    }
  };

  /**
   * Convert local currency amount to USD
   * @param localAmount - Amount in user's preferred currency
   * @returns Amount in USD (4 decimal precision)
   */
  const convertLocalToUSD = (localAmount: number): number => {
    if (userCurrency === 'USD' || exchangeRate === 1) {
      return localAmount;
    }
    // Reverse conversion: local / rate = USD
    const usdAmount = localAmount / exchangeRate;
    return parseFloat(usdAmount.toFixed(4)); // 4-decimal precision for backend
  };

  const handleDeposit = async () => {
    if (!depositAmount || !depositMethod) {
      toast.error("Please fill in all fields");
      return;
    }

    const amount = parseFloat(depositAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    // Global deposit limits (prevents extreme values before processor checks)
    const MIN_DEPOSIT = 1;
    const MAX_DEPOSIT = 10000;
    
    if (amount < MIN_DEPOSIT || amount > MAX_DEPOSIT) {
      toast.error(`Deposit amount must be between $${MIN_DEPOSIT} and $${MAX_DEPOSIT}`);
      return;
    }

    const processor = depositProcessors.find(p => p.name === depositMethod);
    if (!processor) {
      toast.error("Invalid payment method");
      return;
    }

    if (amount < processor.min_amount || amount > processor.max_amount) {
      toast.error(`Amount must be between $${processor.min_amount} and $${processor.max_amount}`);
      return;
    }

    try {
      setDepositLoading(true);

      // Check if it's a CPAY processor
      if (processor.config?.processor === 'cpay') {
        const { data, error } = await supabase.functions.invoke("cpay-deposit", {
          body: { 
            amount, 
            currency: processor.config.currency || 'USDT',
            processorId: processor.id
          },
        });

        if (error) throw error;

        if (data?.checkout_url) {
          // Open CPAY checkout in iframe
          setCpayCheckoutUrl(data.checkout_url);
          setCpayTransactionId(data.transaction_id);
          setCpayOrderId(data.order_id);
          setCpayAmount(amount);
          setCpayCurrency(data.currency || 'USDT');
          setDepositDialogOpen(false); // Close deposit dialog
          setShowCpayIframe(true); // Show iframe
          toast.success("Opening checkout...");
        } else {
          throw new Error("No checkout URL received");
        }
      } else {
        // Legacy deposit flow
        const { data, error } = await supabase.functions.invoke("deposit", {
          body: {
            amount,
            paymentMethod: depositMethod,
            gatewayTransactionId: `TXN-${Date.now()}`,
          },
        });

        if (error) throw error;

        toast.success("Deposit successful!");
        setDepositAmount("");
        setDepositMethod("");
        setDepositDialogOpen(false);
        onBalanceUpdate();
      }
    } catch (error: any) {
      console.error("Deposit error:", error);
      toast.error(error.message || "Failed to process deposit");
    } finally {
      setDepositLoading(false);
    }
  };

  const handleWithdraw = async () => {
    if (!withdrawAmount || !withdrawMethod || !accountDetails) {
      toast.error("Please fill in all fields");
      return;
    }

    const amount = parseFloat(withdrawAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    if (amount > earningsBalance) {
      toast.error("Insufficient balance");
      return;
    }
    
    // Frontend pre-validation (skip schedule check for VIP bypass)
    if (!validation?.hasBypass && validation && !validation.isAllowed) {
      toast.error(validation.message);
      return;
    }

    try {
      setWithdrawLoading(true);

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("You must be logged in to withdraw");
        return;
      }

      // Check for pending withdrawal (prevent duplicates)
      const { data: pendingWithdrawals, error: pendingError } = await supabase
        .from('withdrawal_requests')
        .select('id')
        .eq('user_id', user.id)
        .eq('status', 'pending')
        .maybeSingle();

      if (pendingError) {
        console.error("Error checking pending withdrawals:", pendingError);
      }

      if (pendingWithdrawals) {
        toast.error("You already have a pending withdrawal request. Please wait for it to be processed.");
        return;
      }

      // Get user profile and membership plan
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('membership_plan, earnings_wallet_balance')
        .eq('id', user.id)
        .single();

      if (profileError || !profile) {
        toast.error("Failed to load profile information");
        return;
      }

      // Get membership plan details
      const { data: plan, error: planError } = await supabase
        .from('membership_plans')
        .select('min_withdrawal, max_daily_withdrawal, min_daily_withdrawal')
        .eq('name', profile.membership_plan)
        .single();

      if (planError || !plan) {
        toast.error("Failed to load membership plan details");
        return;
      }

      // Convert local currency to USD for backend processing
      const amountUSD = convertLocalToUSD(amount);

      console.log('💱 Currency Conversion for Withdrawal:', {
        inputAmount: amount,
        inputCurrency: userCurrency,
        exchangeRate,
        convertedUSD: amountUSD,
        timestamp: new Date().toISOString()
      });

      // Validate minimum withdrawal (using USD)
      const minWithdrawal = typeof plan.min_withdrawal === 'number' 
        ? plan.min_withdrawal 
        : parseFloat(plan.min_withdrawal as string);
      if (amountUSD < minWithdrawal) {
        toast.error(`Minimum withdrawal is $${minWithdrawal.toFixed(2)} USD`);
        return;
      }

      // Validate minimum daily withdrawal (using USD)
      if (plan.min_daily_withdrawal) {
        const minDailyWithdrawal = typeof plan.min_daily_withdrawal === 'number'
          ? plan.min_daily_withdrawal
          : parseFloat(plan.min_daily_withdrawal as string);
        if (minDailyWithdrawal > 0 && amountUSD < minDailyWithdrawal) {
          toast.error(`Minimum daily withdrawal is $${minDailyWithdrawal.toFixed(2)} USD`);
          return;
        }
      }

      // Check daily withdrawal limit (using USD)
      const today = new Date().toISOString().split('T')[0];
      const { data: todayWithdrawals, error: todayError } = await supabase
        .from('withdrawal_requests')
        .select('amount')
        .eq('user_id', user.id)
        .gte('created_at', today)
        .in('status', ['pending', 'approved', 'processing', 'completed']);

      if (todayError) {
        console.error("Error checking daily withdrawals:", todayError);
      }

      const totalWithdrawnToday = todayWithdrawals?.reduce(
        (sum, t) => {
          const withdrawnAmount = typeof t.amount === 'number' ? t.amount : parseFloat(String(t.amount));
          return sum + withdrawnAmount;
        },
        0
      ) || 0;

      const maxDailyWithdrawal = typeof plan.max_daily_withdrawal === 'number'
        ? plan.max_daily_withdrawal
        : parseFloat(plan.max_daily_withdrawal as string);
      if (totalWithdrawnToday + amountUSD > maxDailyWithdrawal) {
        const remainingLimit = maxDailyWithdrawal - totalWithdrawnToday;
        toast.error(`Daily withdrawal limit exceeded. You can withdraw up to $${remainingLimit.toFixed(2)} USD more today.`);
        return;
      }

      // Check withdrawal schedule using the validation hook data (skip for VIP bypass)
      if (!validation?.hasBypass && !validation?.isAllowed) {
        toast.error(
          validation?.message || "Withdrawals are not currently available",
          {
            duration: 6000,
          }
        );
        return;
      }

      // All validations passed, proceed with withdrawal request
      // Validate processor selection
      const selectedProcessor = withdrawalProcessors.find(p => p.name === withdrawMethod);
      
      if (!selectedProcessor) {
        toast.error("Please select a valid withdrawal method");
        return;
      }

      console.log('🔄 Processing withdrawal with processor:', {
        id: selectedProcessor.id,
        name: selectedProcessor.name,
        feeFixed: selectedProcessor.fee_fixed,
        feePercentage: selectedProcessor.fee_percentage,
        amountUSD,
        originalAmount: amount,
        currency: userCurrency
      });
      
      const { data, error } = await supabase.functions.invoke("request-withdrawal", {
        body: {
          amount: amountUSD,
          paymentMethod: withdrawMethod,
          payoutAddress: accountDetails,
          paymentProcessorId: selectedProcessor.id, // UUID passed correctly
        },
      });

      if (error) throw error;

      toast.success(data.message || "Withdrawal request submitted!");
      setWithdrawAmount("");
      setWithdrawMethod("");
      setAccountDetails("");
      setWithdrawDialogOpen(false);
      onBalanceUpdate();
    } catch (error: any) {
      console.error("Withdrawal error:", error);
      toast.error(error.message || "Failed to process withdrawal");
    } finally {
      setWithdrawLoading(false);
    }
  };

  const handleCpaySuccess = () => {
    onBalanceUpdate();
    setDepositAmount("");
    setDepositMethod("");
  };

  return (
    <>
      <CPAYCheckoutIframe
        open={showCpayIframe}
        onOpenChange={setShowCpayIframe}
        checkoutUrl={cpayCheckoutUrl}
        transactionId={cpayTransactionId}
        orderId={cpayOrderId}
        amount={cpayAmount}
        currency={cpayCurrency}
        onSuccess={handleCpaySuccess}
      />
      
      <Card className="col-span-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            Wallet Balance
          </CardTitle>
          <CardDescription>Manage your deposits and earnings</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 border rounded-lg">
            <p className="text-sm text-muted-foreground mb-1">Deposit Wallet</p>
            <p className="text-2xl font-bold text-[hsl(var(--wallet-deposit))]">
              <CurrencyDisplay amountUSD={depositBalance} />
            </p>
            <p className="text-xs text-muted-foreground mb-3">For account upgrades</p>
            <Dialog open={depositDialogOpen} onOpenChange={setDepositDialogOpen}>
              <DialogTrigger asChild>
                <Button className="w-full" size="sm">
                  <ArrowDownRight className="mr-2 h-4 w-4" />
                  Deposit
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Make a Deposit</DialogTitle>
                  <DialogDescription>
                    Add funds to your deposit wallet
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="deposit-amount">Amount</Label>
                    <Input
                      id="deposit-amount"
                      type="number"
                      placeholder="Enter amount"
                      value={depositAmount}
                      onChange={(e) => setDepositAmount(e.target.value)}
                      min="0"
                      step="0.01"
                    />
                  </div>
                  <div>
                    <Label htmlFor="deposit-method">Payment Method</Label>
                    <Select value={depositMethod} onValueChange={setDepositMethod} disabled={loadingProcessors}>
                      <SelectTrigger id="deposit-method">
                        <SelectValue placeholder={loadingProcessors ? "Loading..." : "Select payment method"} />
                      </SelectTrigger>
                      <SelectContent>
                        {depositProcessors.length === 0 ? (
                          <SelectItem value="none" disabled>No payment methods available</SelectItem>
                        ) : (
                          depositProcessors.map((processor) => (
                            <SelectItem key={processor.id} value={processor.name}>
                              {processor.config?.display_name || processor.name}
                              {processor.fee_fixed > 0 && ` (Fee: $${processor.fee_fixed})`}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                    {depositMethod && depositProcessors.find(p => p.name === depositMethod)?.config?.description && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {depositProcessors.find(p => p.name === depositMethod)?.config?.description}
                      </p>
                    )}
                  </div>
                  <Button
                    onClick={handleDeposit}
                    disabled={depositLoading}
                    className="w-full"
                  >
                    {depositLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      "Confirm Deposit"
                    )}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <div className="p-4 border rounded-lg">
            <p className="text-sm text-muted-foreground mb-1">Earnings Wallet</p>
            <p className="text-2xl font-bold text-[hsl(var(--wallet-earnings))]">
              <CurrencyDisplay amountUSD={earningsBalance} />
            </p>
            <p className="text-xs text-muted-foreground mb-3">From tasks & referrals</p>
            <Dialog open={withdrawDialogOpen} onOpenChange={setWithdrawDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="w-full" size="sm">
                  <ArrowUpRight className="mr-2 h-4 w-4" />
                  Withdraw
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Request Withdrawal</DialogTitle>
                  <DialogDescription>
                    Withdraw funds from your earnings wallet
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  {/* PHASE 4: VIP Bypass Badge */}
                  {validation?.hasBypass && (
                    <Alert className="bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-950/20 dark:to-yellow-950/20 border-amber-200 dark:border-amber-800">
                      <div className="flex items-center gap-2">
                        <Crown className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                        <Sparkles className="h-4 w-4 text-amber-500 dark:text-amber-400" />
                      </div>
                      <AlertTitle className="text-amber-900 dark:text-amber-100 flex items-center gap-2">
                        VIP Withdrawal Access
                        <Badge variant="default" className="bg-amber-600 hover:bg-amber-700">
                          Unrestricted
                        </Badge>
                      </AlertTitle>
                      <AlertDescription className="text-amber-800 dark:text-amber-200">
                        Your account has Daily withdrawals access. You can withdraw any day at any time without schedule restrictions.
                      </AlertDescription>
                    </Alert>
                  )}

                  {/* Standard users: Show schedule restrictions */}
                  {!validation?.hasBypass && validation && !validation.isAllowed && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>{validation.message}</AlertDescription>
                    </Alert>
                  )}
                  
                  {/* Display countdown timer when withdrawals are closed (only for non-VIP) */}
                  {!validation?.hasBypass && validation && !validation.isAllowed && validation.countdownSeconds !== null && validation.nextWindow && (
                    <WithdrawalCountdown
                      secondsUntilNext={validation.countdownSeconds}
                      nextWindowDay={validation.nextWindow.next_day}
                      nextWindowTime={`${validation.nextWindow.start_time}-${validation.nextWindow.end_time}`}
                    />
                  )}
                  
                  <div>
                    <Label htmlFor="withdraw-amount">
                      Amount ({userCurrency})
                    </Label>
                    <Input
                      id="withdraw-amount"
                      type="number"
                      placeholder={`Enter amount in ${userCurrency}`}
                      value={withdrawAmount}
                      onChange={(e) => setWithdrawAmount(e.target.value)}
                      min="0"
                      step="0.01"
                      max={earningsBalance}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Available: <CurrencyDisplay amountUSD={earningsBalance} />
                      {userCurrency !== 'USD' && withdrawAmount && parseFloat(withdrawAmount) > 0 && (
                        <span className="ml-2 text-blue-600 dark:text-blue-400 font-medium">
                          ≈ ${convertLocalToUSD(parseFloat(withdrawAmount)).toFixed(2)} USD
                        </span>
                      )}
                    </p>
                  </div>
                  
                  {/* Withdrawal Fee Breakdown */}
                  {withdrawAmount && withdrawMethod && withdrawalProcessors.find(p => p.name === withdrawMethod) && parseFloat(withdrawAmount) > 0 && (() => {
                    const processor = withdrawalProcessors.find(p => p.name === withdrawMethod);
                    const amount = parseFloat(withdrawAmount);
                    const fixedFee = processor?.fee_fixed || 0;
                    const percentageFee = (amount * (processor?.fee_percentage || 0)) / 100;
                    const totalFee = fixedFee + percentageFee;
                    const netAmount = amount - totalFee;
                    
                    return (
                      <Alert className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
                        <InfoIcon className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                        <AlertDescription>
                          <div className="text-xs space-y-1">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Withdrawal Amount:</span>
                              <span className="font-semibold">
                                <CurrencyDisplay amountUSD={amount} />
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Processing Fee:</span>
                              <span className="font-semibold text-red-600 dark:text-red-400">
                                - <CurrencyDisplay amountUSD={totalFee} />
                              </span>
                            </div>
                            {percentageFee > 0 && (
                              <div className="flex justify-between text-[10px]">
                                <span className="text-muted-foreground ml-2">
                                  (Fixed: <CurrencyDisplay amountUSD={fixedFee} /> + {processor?.fee_percentage}%)
                                </span>
                              </div>
                            )}
                            <div className="border-t border-blue-200 dark:border-blue-800 pt-1 mt-1"></div>
                            <div className="flex justify-between">
                              <span className="font-semibold text-muted-foreground">You will receive:</span>
                              <span className="font-bold text-green-600 dark:text-green-400 text-sm">
                                <CurrencyDisplay amountUSD={netAmount} />
                              </span>
                            </div>
                          </div>
                        </AlertDescription>
                      </Alert>
                    );
                  })()}
                  
                  <div>
                    <Label htmlFor="withdraw-method">Withdrawal Method</Label>
                    <Select value={withdrawMethod} onValueChange={setWithdrawMethod} disabled={loadingProcessors}>
                      <SelectTrigger id="withdraw-method">
                        <SelectValue placeholder={loadingProcessors ? "Loading..." : "Select withdrawal method"} />
                      </SelectTrigger>
                      <SelectContent>
                        {withdrawalProcessors.length === 0 ? (
                          <SelectItem value="none" disabled>No withdrawal methods available</SelectItem>
                        ) : (
                          withdrawalProcessors.map((processor) => (
                            <SelectItem key={processor.id} value={processor.name}>
                              {processor.config?.display_name || processor.name}
                              {processor.fee_fixed > 0 && ` (Fee: $${processor.fee_fixed})`}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                    {withdrawMethod && withdrawalProcessors.find(p => p.name === withdrawMethod) && (
                      <Alert className="mt-2">
                        <InfoIcon className="h-4 w-4" />
                        <AlertDescription className="text-xs">
                          {withdrawalProcessors.find(p => p.name === withdrawMethod)?.config?.description}
                          <br />
                          <strong>Fee:</strong> ${withdrawalProcessors.find(p => p.name === withdrawMethod)?.fee_fixed || 0}
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="account-details">
                      {withdrawalProcessors.find(p => p.name === withdrawMethod)?.config?.address_label || "Account Details"}
                    </Label>
                    <Textarea
                      id="account-details"
                      placeholder={
                        withdrawalProcessors.find(p => p.name === withdrawMethod)?.config?.address_placeholder ||
                        "Enter your account details (bank account number, PayPal email, crypto address, etc.)"
                      }
                      value={accountDetails}
                      onChange={(e) => setAccountDetails(e.target.value)}
                      rows={3}
                    />
                  </div>
                  <Button
                    onClick={handleWithdraw}
                    disabled={withdrawLoading}
                    className="w-full"
                  >
                    {withdrawLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      "Request Withdrawal"
                    )}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </CardContent>
    </Card>
    </>
  );
};
