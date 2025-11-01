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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Wallet, ArrowUpRight, ArrowDownRight, Loader2, InfoIcon, AlertCircle, Crown, Sparkles, HelpCircle } from "lucide-react";
import { CurrencyDisplay } from "@/components/ui/CurrencyDisplay";
import { CPAYCheckoutIframe } from "./CPAYCheckoutIframe";
import { useWithdrawalValidation } from "@/hooks/useWithdrawalValidation";
import { WithdrawalCountdown } from "./WithdrawalCountdown";
import { useCurrencyConversion } from '@/hooks/useCurrencyConversion';
import { USDCFeeSavingsBanner } from "./USDCFeeSavingsBanner";

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

// Virtual withdrawal method options - all map to actual "Crypto Payout" processor
const VIRTUAL_WITHDRAWAL_METHODS = [
  {
    id: 'gcrypto',
    displayName: 'Gcrypto',
    description: 'Withdraw to your Gcrypto wallet',
    icon: '💳',
  },
  {
    id: 'binance',
    displayName: 'Binance',
    description: 'Withdraw to your Binance account',
    icon: '🔶',
  },
  {
    id: 'coinsph',
    displayName: 'Coins.Ph',
    description: 'Withdraw to your Coins.Ph wallet',
    icon: '🪙',
  },
  {
    id: 'bybit',
    displayName: 'ByBit',
    description: 'Withdraw to your ByBit account',
    icon: '📊',
  },
  {
    id: 'coinbase',
    displayName: 'CoinBase',
    description: 'Withdraw to your CoinBase wallet',
    icon: '🔷',
  },
  {
    id: 'kucoin',
    displayName: 'KuCoin',
    description: 'Withdraw to your KuCoin account',
    icon: '🟢',
  },
];

// Virtual deposit method options - all map to actual "CRYPTO Deposit" processor
const VIRTUAL_DEPOSIT_METHODS = [
  {
    id: 'gcrypto-deposit',
    displayName: 'Gcrypto',
    description: 'Deposit via your Gcrypto wallet',
    icon: '💳',
  },
  {
    id: 'binance-deposit',
    displayName: 'Binance',
    description: 'Deposit from your Binance account',
    icon: '🔶',
  },
  {
    id: 'coinsph-deposit',
    displayName: 'Coins.Ph',
    description: 'Deposit from your Coins.Ph wallet',
    icon: '🪙',
  },
  {
    id: 'bybit-deposit',
    displayName: 'ByBit',
    description: 'Deposit from your ByBit account',
    icon: '📊',
  },
  {
    id: 'coinbase-deposit',
    displayName: 'CoinBase',
    description: 'Deposit from your CoinBase wallet',
    icon: '🔷',
  },
  {
    id: 'kucoin-deposit',
    displayName: 'KuCoin',
    description: 'Deposit from your KuCoin account',
    icon: '🟢',
  },
];

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
  const [withdrawAmountError, setWithdrawAmountError] = useState<string | null>(null);
  const [depositLoading, setDepositLoading] = useState(false);
  const [withdrawLoading, setWithdrawLoading] = useState(false);
  const [depositDialogOpen, setDepositDialogOpen] = useState(false);
  const [withdrawDialogOpen, setWithdrawDialogOpen] = useState(false);
  const [depositProcessors, setDepositProcessors] = useState<PaymentProcessor[]>([]);
  const [withdrawalProcessors, setWithdrawalProcessors] = useState<PaymentProcessor[]>([]);
  const [loadingProcessors, setLoadingProcessors] = useState(true);
  const [actualCryptoProcessor, setActualCryptoProcessor] = useState<PaymentProcessor | null>(null);
  const [actualDepositProcessor, setActualDepositProcessor] = useState<PaymentProcessor | null>(null);
  
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
      
      // ✅ Identify the actual "Crypto Payout" processor for withdrawals
      // This will be used as the backend processor for all virtual withdrawal methods
      const cryptoProcessor = withdrawals.find(p => {
        const config = p.config as any;
        return p.name.toLowerCase().includes('crypto') || 
          p.name.toLowerCase().includes('payout') ||
          config?.display_name?.toLowerCase().includes('crypto');
      });
      
      if (cryptoProcessor) {
        setActualCryptoProcessor(cryptoProcessor);
        console.log('✅ Crypto withdrawal processor identified:', cryptoProcessor.name);
      } else {
        console.warn('⚠️ No crypto withdrawal processor found. Virtual withdrawal methods will not work.');
      }

      // ✅ NEW: Identify the actual "CRYPTO Deposit" processor for deposits
      // This will be used as the backend processor for all virtual deposit methods
      const depositProcessor = deposits.find(p => {
        const config = p.config as any;
        return p.name.toLowerCase().includes('crypto') || 
          p.name.toLowerCase().includes('deposit') ||
          config?.display_name?.toLowerCase().includes('crypto') ||
          config?.processor === 'cpay'; // Also match CPAY processors
      });
      
      if (depositProcessor) {
        setActualDepositProcessor(depositProcessor);
        console.log('✅ Crypto deposit processor identified:', depositProcessor.name);
      } else {
        console.warn('⚠️ No crypto deposit processor found. Virtual deposit methods will not work.');
      }
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

  /**
   * Convert USD amount to local currency
   * @param usdAmount - Amount in USD
   * @returns Amount in user's preferred currency
   */
  const convertUSDToLocal = (usdAmount: number): number => {
    if (userCurrency === 'USD' || exchangeRate === 1) {
      return usdAmount;
    }
    return usdAmount * exchangeRate;
  };

  /**
   * Real-time validation for withdrawal amount
   */
  const validateWithdrawAmountRealtime = (inputAmount: string): string | null => {
    if (!inputAmount || inputAmount.trim() === '') {
      return null; // No error for empty input
    }
    
    const amount = parseFloat(inputAmount);
    if (isNaN(amount) || amount <= 0) {
      return "Please enter a valid amount";
    }
    
    // Convert to USD for comparison
    const amountUSD = convertLocalToUSD(amount);
    
    // Check against balance
    if (amountUSD > earningsBalance) {
      const excessUSD = amountUSD - earningsBalance;
      const excessLocal = convertUSDToLocal(excessUSD);
      return `Insufficient balance. You are ${userCurrency} ${excessLocal.toFixed(2)} over your available balance.`;
    }
    
    return null; // No error
  };

  /**
   * Handler for "Withdraw All" button
   */
  const handleWithdrawAll = () => {
    // Convert USD balance to user's local currency
    const maxAmountLocal = convertUSDToLocal(earningsBalance);
    
    // Round to 2 decimal places for cleaner display
    const roundedAmount = maxAmountLocal.toFixed(2);
    
    // Set the withdraw amount
    setWithdrawAmount(roundedAmount);
    
    // Clear any validation errors since this is a valid amount
    setWithdrawAmountError(null);
    
    // Show success feedback
    toast.success(`Maximum amount set: ${userCurrency} ${roundedAmount}`);
  };

  const handleDeposit = async () => {
    if (!depositAmount || !depositMethod) {
      toast.error("Please fill in all fields");
      return;
    }

    const amountLocal = parseFloat(depositAmount);
    if (isNaN(amountLocal) || amountLocal <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    // ✅ Convert local currency to USD for backend processing
    const amountUSD = convertLocalToUSD(amountLocal);
    
    console.log(`💰 Deposit conversion: ${amountLocal} ${userCurrency} → $${amountUSD.toFixed(2)} USD`, {
      inputAmount: amountLocal,
      inputCurrency: userCurrency,
      exchangeRate,
      convertedUSD: amountUSD,
      timestamp: new Date().toISOString()
    });

    // Global deposit limits (in USD after conversion)
    const MIN_DEPOSIT = 1;
    const MAX_DEPOSIT = 10000;
    
    if (amountUSD < MIN_DEPOSIT || amountUSD > MAX_DEPOSIT) {
      toast.error(`Deposit amount must be between $${MIN_DEPOSIT} and $${MAX_DEPOSIT} USD`);
      return;
    }

    // ✅ NEW: Map virtual method to actual processor
    const virtualMethod = VIRTUAL_DEPOSIT_METHODS.find(vm => vm.id === depositMethod);
    
    let selectedProcessor: PaymentProcessor | undefined;
    let displayMethodName: string;
    
    if (virtualMethod && actualDepositProcessor) {
      // User selected a virtual method - use the actual crypto processor behind the scenes
      selectedProcessor = actualDepositProcessor;
      displayMethodName = virtualMethod.displayName; // Store user-friendly name for tracking
      console.log('🎭 Virtual deposit method selected:', {
        virtualMethodId: virtualMethod.id,
        displayName: virtualMethod.displayName,
        actualProcessorId: actualDepositProcessor.id,
        actualProcessorName: actualDepositProcessor.name,
        amountLocal: `${amountLocal} ${userCurrency}`,
        amountUSD: `$${amountUSD.toFixed(2)} USD`
      });
    } else {
      // User selected an actual processor (fallback for backwards compatibility)
      selectedProcessor = depositProcessors.find(p => p.name === depositMethod);
      displayMethodName = depositMethod;
    }
    
    if (!selectedProcessor) {
      toast.error("Invalid payment method");
      return;
    }

    // ✅ Validate against processor limits using USD amount
    if (amountUSD < selectedProcessor.min_amount || amountUSD > selectedProcessor.max_amount) {
      toast.error(`Amount must be between $${selectedProcessor.min_amount} and $${selectedProcessor.max_amount} USD`);
      return;
    }

    try {
      setDepositLoading(true);

      // Check if it's a CPAY processor
      if ((selectedProcessor.config as any)?.processor === 'cpay') {
        const { data, error } = await supabase.functions.invoke("cpay-deposit", {
          body: { 
            amount: amountUSD, // ✅ Send USD amount to backend
            currency: (selectedProcessor.config as any).currency || 'USDT',
            processorId: selectedProcessor.id // ✅ Use actual processor ID
          },
        });

        if (error) throw error;

        if (data?.checkout_url) {
          // Open CPAY checkout in iframe
          setCpayCheckoutUrl(data.checkout_url);
          setCpayTransactionId(data.transaction_id);
          setCpayOrderId(data.order_id);
          setCpayAmount(amountUSD); // ✅ Store USD amount
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
            amount: amountUSD, // ✅ Send USD amount to backend
            paymentMethod: displayMethodName, // ✅ Store user-friendly name for tracking
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

    // Convert local currency to USD immediately for all validations
    const amountUSD = convertLocalToUSD(amount);

    console.log('💱 Currency Conversion for Withdrawal (Early Check):', {
      inputAmount: amount,
      inputCurrency: userCurrency,
      exchangeRate,
      convertedUSD: amountUSD,
      timestamp: new Date().toISOString()
    });

    // Validate against earnings balance (in USD)
    if (amountUSD > earningsBalance) {
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

      console.log('🔍 Withdrawal Validation (Using USD):', {
        amountUSD,
        minWithdrawal: plan.min_withdrawal,
        minDailyWithdrawal: plan.min_daily_withdrawal,
        maxDailyWithdrawal: plan.max_daily_withdrawal,
        earningsBalance: profile.earnings_wallet_balance
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
      // ✅ NEW: Map virtual method to actual processor
      const virtualMethod = VIRTUAL_WITHDRAWAL_METHODS.find(vm => vm.id === withdrawMethod);
      
      let selectedProcessor: PaymentProcessor | undefined;
      let displayMethodName: string;
      
      if (virtualMethod && actualCryptoProcessor) {
        // User selected a virtual method - use the actual crypto processor behind the scenes
        selectedProcessor = actualCryptoProcessor;
        displayMethodName = virtualMethod.displayName; // Store user-friendly name for tracking
        console.log('🎭 Virtual method selected:', {
          virtualMethodId: virtualMethod.id,
          displayName: virtualMethod.displayName,
          actualProcessorId: actualCryptoProcessor.id,
          actualProcessorName: actualCryptoProcessor.name
        });
      } else {
        // User selected an actual processor (fallback for backwards compatibility)
        selectedProcessor = withdrawalProcessors.find(p => p.name === withdrawMethod);
        displayMethodName = withdrawMethod;
      }
      
      if (!selectedProcessor) {
        toast.error("Please select a valid withdrawal method");
        return;
      }

      console.log('🔄 Processing withdrawal with processor:', {
        id: selectedProcessor.id,
        name: selectedProcessor.name,
        displayMethodName,
        feeFixed: selectedProcessor.fee_fixed,
        feePercentage: selectedProcessor.fee_percentage,
        amountUSD,
        originalAmount: amount,
        currency: userCurrency
      });
      
      const { data, error } = await supabase.functions.invoke("request-withdrawal", {
        body: {
          amount: amountUSD,
          paymentMethod: displayMethodName, // ✅ Store user-friendly name for tracking
          payoutAddress: accountDetails,
          paymentProcessorId: selectedProcessor.id, // ✅ Use actual processor ID for fees/processing
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
                
                {/* ✅ USDC Fee Savings Inline Alert */}
                <USDCFeeSavingsBanner variant="inline" className="mt-2" />
                
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="deposit-amount">
                      Amount ({userCurrency})
                    </Label>
                    <Input
                      id="deposit-amount"
                      type="number"
                      placeholder={`Enter amount in ${userCurrency}`}
                      value={depositAmount}
                      onChange={(e) => setDepositAmount(e.target.value)}
                      min="0"
                      step="0.01"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Available: <CurrencyDisplay amountUSD={depositBalance} />
                      {userCurrency !== 'USD' && depositAmount && parseFloat(depositAmount) > 0 && (
                        <span className="ml-2 text-blue-600 dark:text-blue-400 font-medium">
                          ≈ ${convertLocalToUSD(parseFloat(depositAmount)).toFixed(2)} USD
                        </span>
                      )}
                    </p>
                  </div>
                  <div>
                    <TooltipProvider>
                      <div className="flex items-center gap-2 mb-2">
                        <Label htmlFor="deposit-method">Payment Method</Label>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button type="button" className="inline-flex">
                              <HelpCircle className="h-4 w-4 text-muted-foreground hover:text-foreground transition-colors" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="right" className="max-w-xs">
                            <div className="space-y-1">
                              <p className="font-semibold text-amber-600 dark:text-amber-400">
                                💡 Save on Fees!
                              </p>
                              <p className="text-sm">
                                For <strong>GCash/GCrypto</strong> users: Use <strong>USDC (Solana network)</strong> for the lowest transaction fees and fastest confirmations.
                              </p>
                              <p className="text-xs text-muted-foreground mt-1">
                                All other coins work normally too.
                              </p>
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    </TooltipProvider>
                    <Select value={depositMethod} onValueChange={setDepositMethod} disabled={loadingProcessors}>
                      <SelectTrigger id="deposit-method">
                        <SelectValue placeholder={loadingProcessors ? "Loading..." : "Select payment method"} />
                      </SelectTrigger>
                      <SelectContent>
                        {/* ✅ Show virtual methods if deposit processor exists */}
                        {actualDepositProcessor && VIRTUAL_DEPOSIT_METHODS.length > 0 ? (
                          VIRTUAL_DEPOSIT_METHODS.map((method) => {
                            // ✅ Mark GCrypto, Binance, and CoinBase as recommended for USDC
                            const isRecommended = ['gcrypto-deposit', 'binance-deposit', 'coinbase-deposit'].includes(method.id);
                            
                            return (
                              <SelectItem key={method.id} value={method.id}>
                                <div className="flex items-center justify-between gap-2 w-full">
                                  <div className="flex items-center gap-2">
                                    <span>{method.icon}</span>
                                    <span>{method.displayName}</span>
                                  </div>
                                  {isRecommended && (
                                    <Badge variant="secondary" className="ml-2 bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 text-[10px] px-1.5 py-0 shrink-0">
                                      ⚡ Low Fees
                                    </Badge>
                                  )}
                                </div>
                              </SelectItem>
                            );
                          })
                        ) : depositProcessors.length === 0 ? (
                          <SelectItem value="none" disabled>No payment methods available</SelectItem>
                        ) : (
                          depositProcessors.map((processor) => (
                            <SelectItem key={processor.id} value={processor.name}>
                              {processor.config?.display_name || processor.name}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                    {/* ✅ Display method-specific description */}
                    {depositMethod && (() => {
                      const virtualMethod = VIRTUAL_DEPOSIT_METHODS.find(vm => vm.id === depositMethod);
                      const processor = virtualMethod && actualDepositProcessor 
                        ? actualDepositProcessor 
                        : depositProcessors.find(p => p.name === depositMethod);
                      
                      if (!processor) return null;
                      
                      return (
                        <Alert className="mt-2">
                          <InfoIcon className="h-4 w-4" />
                          <AlertDescription className="text-xs space-y-1">
                            <div>
                              {virtualMethod ? virtualMethod.description : processor.config?.description}
                            </div>
                            
                            {/* ✅ USDC guidance for recommended methods */}
                            {virtualMethod && ['gcrypto-deposit', 'binance-deposit', 'coinbase-deposit'].includes(virtualMethod.id) && (
                              <div className="mt-2 pt-2 border-t border-muted">
                                <p className="font-semibold text-amber-600 dark:text-amber-400">
                                  💡 Tip: Use USDC (Solana) for lowest fees!
                                </p>
                              </div>
                            )}
                            
                            <div className="mt-1">
                              <strong>Processing:</strong> Instant confirmation
                            </div>
                          </AlertDescription>
                        </Alert>
                      );
                    })()}
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
                  
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="withdraw-amount">
                        Amount ({userCurrency})
                      </Label>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleWithdrawAll}
                        disabled={earningsBalance === 0 || withdrawLoading}
                        className="h-7 px-3 text-xs"
                      >
                        All
                      </Button>
                    </div>
                    <Input
                      id="withdraw-amount"
                      type="number"
                      placeholder={`Enter amount in ${userCurrency}`}
                      value={withdrawAmount}
                      onChange={(e) => {
                        const value = e.target.value;
                        setWithdrawAmount(value);
                        const error = validateWithdrawAmountRealtime(value);
                        setWithdrawAmountError(error);
                      }}
                      min="0"
                      step="0.01"
                      max={earningsBalance}
                      className={withdrawAmountError ? "border-red-500 focus-visible:ring-red-500" : ""}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Available: <CurrencyDisplay amountUSD={earningsBalance} />
                      {userCurrency !== 'USD' && withdrawAmount && parseFloat(withdrawAmount) > 0 && (
                        <span className="ml-2 text-blue-600 dark:text-blue-400 font-medium">
                          ≈ ${convertLocalToUSD(parseFloat(withdrawAmount)).toFixed(2)} USD
                        </span>
                      )}
                    </p>

                    {/* Real-time Balance Validation Error */}
                    {withdrawAmountError && (
                      <Alert variant="destructive" className="mt-2">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription className="text-sm">
                          {withdrawAmountError}
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                  
                  {/* Withdrawal Fee Breakdown */}
                  {withdrawAmount && withdrawMethod && parseFloat(withdrawAmount) > 0 && (() => {
                    // ✅ Find processor - could be virtual or actual
                    const virtualMethod = VIRTUAL_WITHDRAWAL_METHODS.find(vm => vm.id === withdrawMethod);
                    const processor = virtualMethod && actualCryptoProcessor 
                      ? actualCryptoProcessor 
                      : withdrawalProcessors.find(p => p.name === withdrawMethod);
                    
                    if (!processor) return null;
                    
                    const amountLocal = parseFloat(withdrawAmount);
                    
                    // Convert local currency amount to USD for fee calculations
                    const amountUSD = convertLocalToUSD(amountLocal);
                    
                    // Calculate fees in USD
                    const fixedFee = processor?.fee_fixed || 0;
                    const percentageFee = (amountUSD * (processor?.fee_percentage || 0)) / 100;
                    const totalFee = fixedFee + percentageFee;
                    const netAmountUSD = amountUSD - totalFee;
                    
                    return (
                      <Alert className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
                        <InfoIcon className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                        <AlertDescription>
                          <div className="text-xs space-y-1">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Withdrawal Amount:</span>
                              <span className="font-semibold">
                                <CurrencyDisplay amountUSD={amountUSD} />
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
                                <CurrencyDisplay amountUSD={netAmountUSD} />
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
                        {/* ✅ Show virtual methods if crypto processor exists */}
                        {actualCryptoProcessor && VIRTUAL_WITHDRAWAL_METHODS.length > 0 ? (
                          VIRTUAL_WITHDRAWAL_METHODS.map((method) => (
                            <SelectItem key={method.id} value={method.id}>
                              <div className="flex items-center gap-2">
                                <span>{method.icon}</span>
                                <span>{method.displayName}</span>
                              </div>
                            </SelectItem>
                          ))
                        ) : withdrawalProcessors.length === 0 ? (
                          <SelectItem value="none" disabled>No withdrawal methods available</SelectItem>
                        ) : (
                          withdrawalProcessors.map((processor) => (
                            <SelectItem key={processor.id} value={processor.name}>
                              {processor.config?.display_name || processor.name}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                    {/* ✅ Display method-specific description and fee */}
                    {withdrawMethod && (() => {
                      const virtualMethod = VIRTUAL_WITHDRAWAL_METHODS.find(vm => vm.id === withdrawMethod);
                      const processor = virtualMethod && actualCryptoProcessor 
                        ? actualCryptoProcessor 
                        : withdrawalProcessors.find(p => p.name === withdrawMethod);
                      
                      if (!processor) return null;
                      
                      return (
                        <Alert className="mt-2">
                          <InfoIcon className="h-4 w-4" />
                          <AlertDescription className="text-xs">
                            {virtualMethod ? virtualMethod.description : processor.config?.description}
                            <br />
                            <strong>Fee:</strong> ${processor.fee_fixed || 0}
                          </AlertDescription>
                        </Alert>
                      );
                    })()}
                  </div>
                  <div>
                    <Label htmlFor="account-details">
                      {(() => {
                        const virtualMethod = VIRTUAL_WITHDRAWAL_METHODS.find(vm => vm.id === withdrawMethod);
                        if (virtualMethod) {
                          // Method-specific labels for virtual methods
                          const labels: Record<string, string> = {
                            'gcrypto': 'USDC Solana (SPL) Wallet Address',
                            'binance': 'USDC Solana (SPL) Wallet Address',
                            'coinsph': 'USDC Solana (SPL) Wallet Address',
                            'bybit': 'USDC Solana (SPL) Wallet Address',
                            'coinbase': 'USDC Solana (SPL) Wallet Address',
                            'kucoin': 'USDC Solana (SPL) Wallet Address',
                          };
                          return labels[virtualMethod.id] || 'Account Details';
                        }
                        
                        // Fallback to actual processor label
                        const processor = withdrawalProcessors.find(p => p.name === withdrawMethod);
                        return processor?.config?.address_label || "USDC Solana (SPL) Wallet Address *";
                      })()}
                    </Label>
                    <Textarea
                      id="account-details"
                      placeholder={(() => {
                        const virtualMethod = VIRTUAL_WITHDRAWAL_METHODS.find(vm => vm.id === withdrawMethod);
                        if (virtualMethod) {
                          // Method-specific placeholders for virtual methods
                          const placeholders: Record<string, string> = {
                            'gcrypto': 'Enter your Gcrypto USDC Solana address. Log into Gcrypto, tap Wallet → USDC → Select Solana (SPL) Network → Copy Address → Paste here.',
                            'binance': 'Enter your Binance USDC Solana address. Go to Binance → Wallet → Deposit → Search "USDC" → Select Solana Network → Copy Address → Paste here.',
                            'coinsph': 'Enter your Coins.Ph USDC Solana address. Open Coins.Ph → Crypto Wallet → USDC → Select Solana Network → Copy Address → Paste here.',
                            'bybit': 'Enter your ByBit USDC Solana address. Go to ByBit → Assets → Deposit → Search "USDC" → Select Solana Network → Copy Address → Paste here.',
                            'coinbase': 'Enter your CoinBase USDC Solana address. Open CoinBase → USDC Wallet → Receive → Select Solana Network → Copy Address → Paste here.',
                            'kucoin': 'Enter your KuCoin USDC Solana address. Go to KuCoin → Assets → Deposit → Search "USDC" → Select Solana (SPL) → Copy Address → Paste here.',
                          };
                          return placeholders[virtualMethod.id] || "Enter your crypto wallet address";
                        }
                        
                        // Fallback to actual processor placeholder or default
                        const processor = withdrawalProcessors.find(p => p.name === withdrawMethod);
                        return processor?.config?.address_placeholder || 
                          "Enter your USDC Solana (SPL Network) address. Copy your USDC address from any exchange (Binance, Gcrypto, etc.). Make sure you select the Solana (SPL) network when copying the address. Paste it here.";
                      })()}
                      value={accountDetails}
                      onChange={(e) => setAccountDetails(e.target.value)}
                      rows={3}
                    />
                  </div>
                  <Button
                    onClick={handleWithdraw}
                    disabled={withdrawLoading || !!withdrawAmountError || !withdrawAmount || !withdrawMethod || !accountDetails}
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
