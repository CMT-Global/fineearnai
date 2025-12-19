import { useState, useEffect, useRef } from "react";
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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Wallet, ArrowUpRight, ArrowDownRight, Loader2, InfoIcon, AlertCircle, Crown, Sparkles, HelpCircle } from "lucide-react";
import { CurrencyDisplay } from "@/components/ui/CurrencyDisplay";
import { CPAYCheckoutIframe } from "./CPAYCheckoutIframe";
import { useWithdrawalValidation } from "@/hooks/useWithdrawalValidation";
import { WithdrawalCountdown } from "./WithdrawalCountdown";
import { useCurrencyConversion } from '@/hooks/useCurrencyConversion';
import { USDCFeeSavingsBanner } from "./USDCFeeSavingsBanner";
import { useProfile } from "@/hooks/useProfile";
import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";
import { 
  SUPPORTED_CRYPTOCURRENCIES, 
  getDefaultCrypto, 
  getCryptoById, 
  validateCryptoAddress,
  type CryptoCurrency 
} from "@/types/crypto-currencies";
import { WithdrawalConfirmationDialog } from "./WithdrawalConfirmationDialog";

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
  const { user } = useAuth();
  const { isAdmin } = useAdmin();
  const { data: profile } = useProfile(user?.id);
  
  const [depositAmount, setDepositAmount] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
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
  
  // PHASE 3: Cryptocurrency selection state
  const [selectedCrypto, setSelectedCrypto] = useState<CryptoCurrency>(getDefaultCrypto());
  const [cryptoAddressError, setCryptoAddressError] = useState<string | null>(null);
  
  // Phase 5.5: Withdrawal confirmation dialog state
  const [showWithdrawalConfirmation, setShowWithdrawalConfirmation] = useState(false);
  const [pendingWithdrawalData, setPendingWithdrawalData] = useState<{
    amount: string;
    address: string;
    cryptoId: string;
  } | null>(null);
  
  // CPAY iframe state
  const [showCpayIframe, setShowCpayIframe] = useState(false);
  const [cpayCheckoutUrl, setCpayCheckoutUrl] = useState("");
  const [cpayTransactionId, setCpayTransactionId] = useState("");
  const [cpayOrderId, setCpayOrderId] = useState("");
  const [cpayAmount, setCpayAmount] = useState(0);
  const [cpayCurrency, setCpayCurrency] = useState("");
  
  // PHASE 3: Scroll indicator state for withdrawal dialog
  const [showTopShadow, setShowTopShadow] = useState(false);
  const [showBottomShadow, setShowBottomShadow] = useState(false);
  const scrollViewportRef = useRef<HTMLDivElement>(null);
  
  const { data: validation } = useWithdrawalValidation();
  const { convertAmount, userCurrency, exchangeRate } = useCurrencyConversion();

  useEffect(() => {
    loadPaymentProcessors();
  }, []);

  // PHASE 3: Initialize scroll state when withdrawal dialog opens
  useEffect(() => {
    if (withdrawDialogOpen && scrollViewportRef.current) {
      const viewport = scrollViewportRef.current;
      const { scrollHeight, clientHeight } = viewport;
      setShowTopShadow(false);
      setShowBottomShadow(scrollHeight > clientHeight);
    }
  }, [withdrawDialogOpen]);

  // PHASE 3: Auto-fill crypto address from profile when dialog opens or crypto changes
  useEffect(() => {
    if (!withdrawDialogOpen || !profile) return;
    
    // Get saved address for selected crypto
    let savedAddress = '';
    if (selectedCrypto.id === 'usdc-solana' && profile.usdc_solana_address) {
      savedAddress = profile.usdc_solana_address;
    } else if (selectedCrypto.id === 'usdt-bep20' && profile.usdt_bep20_address) {
      savedAddress = profile.usdt_bep20_address;
    }
    
    // Auto-fill saved address when crypto changes
    if (savedAddress) {
      setAccountDetails(savedAddress);
      toast.success(`Auto-filled saved ${selectedCrypto.displayName} address`, { duration: 2000 });
    } else {
      // Clear if no saved address for this crypto
      setAccountDetails('');
    }
  }, [selectedCrypto.id, withdrawDialogOpen]);
  
  // PHASE 3: Reset crypto selection and clear address when dialog closes
  useEffect(() => {
    if (!withdrawDialogOpen) {
      setSelectedCrypto(getDefaultCrypto());
      setCryptoAddressError(null);
      setAccountDetails('');
    }
  }, [withdrawDialogOpen]);

  // PHASE 3: Scroll event handler for withdrawal dialog
  const handleScrollInWithdrawDialog = () => {
    const viewport = scrollViewportRef.current;
    if (!viewport) return;
    
    const { scrollTop, scrollHeight, clientHeight } = viewport;
    setShowTopShadow(scrollTop > 10);
    setShowBottomShadow(scrollTop + clientHeight < scrollHeight - 10);
  };

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
    if (!depositAmount) {
      toast.error("Please enter an amount");
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

    // ✅ Use the actual deposit processor (CPAY) directly
    if (!actualDepositProcessor) {
      toast.error("Payment processor not available. Please try again later.");
      return;
    }

    // ✅ Validate against processor limits using USD amount
    if (amountUSD < actualDepositProcessor.min_amount || amountUSD > actualDepositProcessor.max_amount) {
      toast.error(`Amount must be between $${actualDepositProcessor.min_amount} and $${actualDepositProcessor.max_amount} USD`);
      return;
    }

    try {
      setDepositLoading(true);

      // Check if it's a CPAY processor
      if ((actualDepositProcessor.config as any)?.processor === 'cpay') {
        const { data, error } = await supabase.functions.invoke("cpay-deposit", {
          body: { 
            amount: amountUSD, // ✅ Send USD amount to backend
            currency: (actualDepositProcessor.config as any).currency || 'USDT',
            processorId: actualDepositProcessor.id // ✅ Use actual processor ID
          },
        });

        if (error) throw error;

        if (data?.checkout_url) {
          // Open CPAY checkout in iframe - user will select coin here
          setCpayCheckoutUrl(data.checkout_url);
          setCpayTransactionId(data.transaction_id);
          setCpayOrderId(data.order_id);
          setCpayAmount(amountUSD); // ✅ Store USD amount
          setCpayCurrency(data.currency || 'USDT');
          setDepositDialogOpen(false); // Close deposit dialog
          setShowCpayIframe(true); // Show iframe - user selects coin in CPAY popup
          toast.success("Opening payment processor...");
        } else {
          throw new Error("No checkout URL received");
        }
      } else {
        // Legacy deposit flow (fallback)
        const { data, error } = await supabase.functions.invoke("deposit", {
          body: {
            amount: amountUSD, // ✅ Send USD amount to backend
            paymentMethod: actualDepositProcessor.name,
            gatewayTransactionId: `TXN-${Date.now()}`,
          },
        });

        if (error) throw error;

        toast.success("Deposit successful!");
        setDepositAmount("");
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
    if (!withdrawAmount || !accountDetails) {
      toast.error("Please fill in all fields");
      return;
    }
    
    // Validate crypto selection
    if (!selectedCrypto || !['usdc-solana', 'usdt-bep20'].includes(selectedCrypto.id)) {
      toast.error("Please select a valid withdrawal method (USDT-Bep20 or USDC-Solana)");
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
    
    // PHASE 5.d: Check email verification (admins bypass this check)
    if (!isAdmin && profile && !profile.email_verified) {
      toast.error("Email verification required. Please verify your email before requesting a withdrawal.");
      setWithdrawDialogOpen(false);
      return;
    }
    
    // Frontend pre-validation (skip schedule check for VIP bypass)
    // Note: Even if today is not a withdrawal day, we allow the request to go through
    // The backend will still receive it and admin can approve it
    // Only show warning for non-VIP users, but don't block
    if (!validation?.hasBypass && validation && !validation.isAllowed) {
      // Show warning but allow to proceed
      toast.warning(validation.message + " Your request will be submitted for admin approval.", {
        duration: 5000,
      });
      // Continue with withdrawal request - don't return
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

      // Note: Withdrawal schedule check removed - users can request withdrawal any time
      // The request will reach admin panel even if today is not a withdrawal day
      // Admin can approve it when appropriate

      // PHASE 3: Validate crypto address format
      if (accountDetails && !validateCryptoAddress(selectedCrypto.id, accountDetails)) {
        toast.error(`Invalid ${selectedCrypto.displayName} address format. Please check and try again.`);
        setCryptoAddressError(`Invalid ${selectedCrypto.displayName} address format`);
        return;
      }

      // All validations passed - show confirmation dialog
      setPendingWithdrawalData({
        amount: withdrawAmount,
        address: accountDetails.trim(),
        cryptoId: selectedCrypto.id
      });
      setShowWithdrawalConfirmation(true);
      
    } catch (error: any) {
      console.error("Withdrawal validation error:", error);
      toast.error(error.message || "Failed to validate withdrawal");
    } finally {
      setWithdrawLoading(false);
    }
  };

  const handleConfirmWithdrawal = async () => {
    if (!pendingWithdrawalData || !user || !profile) return;

    setWithdrawLoading(true);
    console.log('🔄 Starting confirmed withdrawal request...');

    try {
      // ✅ PHASE 2: Defensive validation for cryptoId
      if (!pendingWithdrawalData.cryptoId) {
        toast.error("Cryptocurrency selection is required");
        console.error('❌ Missing cryptoId:', pendingWithdrawalData);
        setWithdrawLoading(false);
        return;
      }

      // Validate cryptoId format
      const validCryptoIds = ['usdc-solana', 'usdt-bep20'];
      if (!validCryptoIds.includes(pendingWithdrawalData.cryptoId)) {
        toast.error("Invalid cryptocurrency selected. Please try again.");
        console.error('❌ Invalid cryptoId:', pendingWithdrawalData.cryptoId, 'Expected one of:', validCryptoIds);
        setWithdrawLoading(false);
        return;
      }

      console.log('✅ CryptoId validation passed:', pendingWithdrawalData.cryptoId);

      const amountUSD = convertLocalToUSD(parseFloat(pendingWithdrawalData.amount));

      // ✅ Use the actual crypto processor directly (no virtual methods)
      if (!actualCryptoProcessor) {
        toast.error("Withdrawal processor not available. Please try again later.");
        return;
      }
      
      const selectedProcessor = actualCryptoProcessor;
      // Use crypto name as display method (e.g., "USDT (BEP-20)" or "USDC (Solana)")
      const displayMethodName = selectedCrypto.displayName;

      console.log('🔄 Processing withdrawal with processor:', {
        id: selectedProcessor.id,
        name: selectedProcessor.name,
        displayMethodName,
        cryptocurrency: selectedCrypto.displayName,
        feeFixed: selectedProcessor.fee_fixed,
        feePercentage: selectedProcessor.fee_percentage,
        amountUSD,
        originalAmount: pendingWithdrawalData.amount,
        currency: userCurrency
      });
      
      const { data, error } = await supabase.functions.invoke("request-withdrawal", {
        body: {
          amount: amountUSD,
          paymentMethod: displayMethodName,
          payoutAddress: pendingWithdrawalData.address,
          paymentProcessorId: selectedProcessor.id,
          cryptoId: pendingWithdrawalData.cryptoId,
        },
      });

      if (error) throw error;

      toast.success(data.message || "Withdrawal request submitted!");
      setWithdrawAmount("");
      setAccountDetails("");
      setWithdrawDialogOpen(false);
      setShowWithdrawalConfirmation(false);
      setPendingWithdrawalData(null);
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
          <div className="p-4 border border-primary/20 bg-primary/5 rounded-lg">
            <p className="text-sm text-muted-foreground mb-1">Deposit Wallet</p>
            <p className="text-2xl font-bold text-primary">
              <CurrencyDisplay amountUSD={depositBalance} />
            </p>
            <p className="text-xs text-muted-foreground mb-3">For account upgrades</p>
            <Dialog open={depositDialogOpen} onOpenChange={setDepositDialogOpen}>
              <DialogTrigger asChild>
                <Button className="w-full bg-primary text-primary-foreground hover:bg-primary/90" size="sm">
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
                  {/* Payment method selection removed - user will select coin in CPAY popup */}
                  <Alert className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
                    <InfoIcon className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    <AlertDescription className="text-xs">
                      After clicking "Confirm Deposit", you'll be able to select your preferred cryptocurrency (Bitcoin, USDT, USDC, etc.) in the payment processor.
                    </AlertDescription>
                  </Alert>
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

          <div className="p-4 border border-primary/20 bg-primary/5 rounded-lg">
            <p className="text-sm text-muted-foreground mb-1">Earnings Wallet</p>
            <p className="text-2xl font-bold text-primary">
              <CurrencyDisplay amountUSD={earningsBalance} />
            </p>
            <p className="text-xs text-muted-foreground mb-3">From tasks & referrals</p>
            <Dialog open={withdrawDialogOpen} onOpenChange={setWithdrawDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="w-full border-primary/50 text-primary hover:bg-primary/10" size="sm">
                  <ArrowUpRight className="mr-2 h-4 w-4" />
                  Withdraw
                </Button>
              </DialogTrigger>
              <DialogContent className="p-0 gap-0 overflow-hidden max-h-[92vh] w-[96vw] max-w-[440px] sm:w-[90vw] sm:max-w-[520px] md:w-[600px] lg:w-[640px]">
                {/* Fixed Header */}
                <DialogHeader className="p-3 sm:p-4 md:p-6 border-b">
                  <DialogTitle>Request Withdrawal</DialogTitle>
                  <DialogDescription>
                    Withdraw funds from your earnings wallet
                  </DialogDescription>
                </DialogHeader>

                {/* Scrollable Content Area with Shadow Indicators */}
                <div className="relative flex-1 overflow-hidden">
                  {/* Top shadow gradient */}
                  <div 
                    className={cn(
                      "absolute top-0 left-0 right-0 h-6 bg-gradient-to-b from-background to-transparent pointer-events-none z-10 transition-opacity duration-200",
                      showTopShadow ? "opacity-100" : "opacity-0"
                    )}
                  />
                  
                  <ScrollArea 
                    className="max-h-[58vh] sm:max-h-[65vh] md:max-h-[70vh] lg:max-h-[75vh] h-full"
                    ref={scrollViewportRef}
                    onScrollCapture={handleScrollInWithdrawDialog}
                  >
                  <div className="p-3 sm:p-4 md:p-6 space-y-4">
                    {/* PHASE 5.d: Email Verification Alert */}
                    {!isAdmin && profile && !profile.email_verified && (
                      <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>Email Verification Required</AlertTitle>
                        <AlertDescription>
                          You must verify your email address before requesting a withdrawal. Please verify your email to proceed.
                        </AlertDescription>
                      </Alert>
                    )}
                    
                    {/* PHASE 4: VIP Bypass Badge */}
                    {validation?.hasBypass && (
                      <Alert className="bg-primary/10 border-primary/30">
                        <div className="flex items-center gap-2">
                          <Crown className="h-5 w-5 text-primary" />
                          <Sparkles className="h-4 w-4 text-primary" />
                        </div>
                        <AlertTitle className="text-foreground flex items-center gap-2">
                          VIP Withdrawal Access
                          <Badge variant="default" className="bg-primary hover:bg-primary/90">
                            Unrestricted
                          </Badge>
                        </AlertTitle>
                        <AlertDescription className="text-muted-foreground">
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
                    {withdrawAmount && selectedCrypto && actualCryptoProcessor && parseFloat(withdrawAmount) > 0 && (() => {
                      // ✅ Use the actual crypto processor
                      const processor = actualCryptoProcessor;
                      
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
                    
                    {/* PHASE 3: Cryptocurrency Selection - Only USDT-Bep20 or USDC-Solana */}
                    <div>
                      <Label htmlFor="crypto-selection">
                        Withdrawal Method (Select Cryptocurrency)
                      </Label>
                      <Select 
                        value={selectedCrypto.id} 
                        onValueChange={(cryptoId) => {
                          const crypto = getCryptoById(cryptoId);
                          if (crypto) {
                            setSelectedCrypto(crypto);
                            setCryptoAddressError(null);
                            
                            // Auto-fill address if saved for this crypto
                            if (profile) {
                              if (crypto.id === 'usdc-solana' && profile.usdc_solana_address) {
                                setAccountDetails(profile.usdc_solana_address);
                                toast.success(`Auto-filled saved ${crypto.displayName} address`);
                              } else if (crypto.id === 'usdt-bep20' && profile.usdt_bep20_address) {
                                setAccountDetails(profile.usdt_bep20_address);
                                toast.success(`Auto-filled saved ${crypto.displayName} address`);
                              }
                            }
                          }
                        }}
                      >
                        <SelectTrigger id="crypto-selection">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {SUPPORTED_CRYPTOCURRENCIES.map((crypto) => (
                            <SelectItem key={crypto.id} value={crypto.id}>
                              <div className="flex items-center justify-between gap-3 w-full">
                                <div className="flex items-center gap-2">
                                  <span className="text-lg">{crypto.icon}</span>
                                  <div className="flex flex-col items-start">
                                    <span className="font-medium">{crypto.displayName}</span>
                                    <span className="text-xs text-muted-foreground">{crypto.network}</span>
                                  </div>
                                </div>
                                {crypto.isDefault && (
                                  <Badge variant="secondary" className="ml-2 shrink-0">
                                    Recommended
                                  </Badge>
                                )}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Currency & Network Badge */}
                    <Alert className="bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
                      <InfoIcon className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                      <AlertTitle className="text-blue-900 dark:text-blue-100 flex items-center gap-2">
                        Withdrawal Currency & Network
                        <Badge variant="default" className="bg-blue-600 hover:bg-blue-700">
                          {selectedCrypto.icon} {selectedCrypto.displayName}
                        </Badge>
                      </AlertTitle>
                      <AlertDescription className="text-blue-800 dark:text-blue-200 text-sm">
                        Your withdrawal will be sent as <strong>{selectedCrypto.symbol}</strong> on the <strong>{selectedCrypto.network}</strong> network. 
                        Make sure your wallet supports {selectedCrypto.symbol} on {selectedCrypto.networkShort}.
                      </AlertDescription>
                    </Alert>

                    {/* Expandable Help Guide */}
                    <Collapsible className="w-full">
                      <CollapsibleTrigger className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
                        <HelpCircle className="h-4 w-4" />
                        <span className="underline">How to get your {selectedCrypto.displayName} address?</span>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="pt-3">
                        <div className="text-sm space-y-3 bg-muted/50 p-4 rounded-lg border border-border">
                          <p className="font-semibold text-foreground">Step-by-Step Guide:</p>
                          <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
                            <li>Open your crypto wallet or exchange (Binance, Gcrypto, Coinbase, etc.)</li>
                            <li>Navigate to <strong className="text-foreground">Deposit</strong> or <strong className="text-foreground">Receive</strong> section</li>
                            <li>Search for <strong className="text-foreground">{selectedCrypto.symbol}</strong> {selectedCrypto.id === 'usdc-solana' && '(not USDT)'}</li>
                            <li>When prompted to select a network, choose <strong className="text-foreground">{selectedCrypto.network}</strong></li>
                            <li>Copy the displayed wallet address</li>
                            <li>Paste the address in the field below</li>
                          </ol>
                          {selectedCrypto.addressExample && (
                            <div className="mt-2 p-2 bg-muted rounded border">
                              <p className="text-xs text-muted-foreground mb-1">Example address format:</p>
                              <code className="text-xs font-mono break-all">{selectedCrypto.addressExample}</code>
                            </div>
                          )}
                          <Alert className="bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800 mt-3">
                            <AlertDescription className="text-amber-800 dark:text-amber-200 font-medium text-xs">
                              ⚠️ <strong>Important:</strong> Always verify you've selected {selectedCrypto.network} network! Sending to the wrong network will result in loss of funds.
                            </AlertDescription>
                          </Alert>
                        </div>
                      </CollapsibleContent>
                    </Collapsible>

                    <div>
                      <Label htmlFor="account-details">
                        {selectedCrypto.symbol} {selectedCrypto.networkShort} Wallet Address *
                      </Label>
                      <Textarea
                        id="account-details"
                        placeholder={selectedCrypto.addressPlaceholder}
                        value={accountDetails}
                        onChange={(e) => {
                          const value = e.target.value;
                          setAccountDetails(value);
                          
                          // Real-time address validation
                          if (value && !validateCryptoAddress(selectedCrypto.id, value)) {
                            setCryptoAddressError(`Invalid ${selectedCrypto.displayName} address format`);
                          } else {
                            setCryptoAddressError(null);
                          }
                        }}
                        rows={3}
                        className={cryptoAddressError ? "border-red-500 focus-visible:ring-red-500" : ""}
                      />
                      {cryptoAddressError && (
                        <Alert variant="destructive" className="mt-2">
                          <AlertCircle className="h-4 w-4" />
                          <AlertDescription className="text-sm">
                            {cryptoAddressError}
                          </AlertDescription>
                        </Alert>
                      )}
                      <p className="text-xs text-muted-foreground mt-2">
                        Enter your {selectedCrypto.displayName} wallet address where you want to receive funds.
                      </p>
                    </div>
                  </div>
                  </ScrollArea>
                  
                  {/* Bottom shadow gradient */}
                  <div 
                    className={cn(
                      "absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-background to-transparent pointer-events-none z-10 transition-opacity duration-200",
                      showBottomShadow ? "opacity-100" : "opacity-0"
                    )}
                  />
                </div>

                {/* Fixed Footer with Withdrawal Button */}
                <div className="p-3 sm:p-4 md:p-6 border-t bg-background">
                  <Button
                    onClick={handleWithdraw}
                    disabled={
                      withdrawLoading || 
                      !!withdrawAmountError || 
                      !!cryptoAddressError ||
                      !withdrawAmount || 
                      !selectedCrypto ||
                      !accountDetails ||
                      (!isAdmin && profile && !profile.email_verified)
                    }
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

    <WithdrawalConfirmationDialog
      open={showWithdrawalConfirmation}
      onOpenChange={(open) => {
        setShowWithdrawalConfirmation(open);
        if (!open) {
          setPendingWithdrawalData(null);
        }
      }}
      onConfirm={handleConfirmWithdrawal}
      amount={pendingWithdrawalData?.amount || '0'}
      selectedCrypto={selectedCrypto}
      address={pendingWithdrawalData?.address || ''}
      isProcessing={withdrawLoading}
    />
    </>
  );
};
