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
import { useTranslation } from "react-i18next";
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
import { SendFundsDialog } from "./SendFundsDialog";
import { SendHorizontal } from "lucide-react";

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
  userTransfersEnabled?: boolean;
  minTransfer?: number;
  maxTransfer?: number;
}

export const WalletCard = ({
  depositBalance,
  earningsBalance,
  onBalanceUpdate,
  userTransfersEnabled = false,
  minTransfer = 1,
  maxTransfer = 100000,
}: WalletCardProps) => {
  const { t } = useTranslation();
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
  const [sendFundsDialogOpen, setSendFundsDialogOpen] = useState(false);
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
      toast.success(t("toasts.wallet.autoFilledSavedAddress", { crypto: selectedCrypto.displayName }), { duration: 2000 });
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
      toast.error(t("toasts.wallet.failedToLoadPaymentMethods"));
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
    toast.success(t("toasts.wallet.maximumAmountSet", { currency: userCurrency, amount: roundedAmount }));
  };

  const handleDeposit = async () => {
    if (!depositAmount) {
      toast.error(t("toasts.wallet.pleaseEnterAmount"));
      return;
    }

    const amountLocal = parseFloat(depositAmount);
    if (isNaN(amountLocal) || amountLocal <= 0) {
      toast.error(t("toasts.wallet.pleaseEnterValidAmount"));
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
      toast.error(t("toasts.wallet.depositAmountBetween", { min: MIN_DEPOSIT, max: MAX_DEPOSIT }));
      return;
    }

    // ✅ Use the actual deposit processor (CPAY) directly
    if (!actualDepositProcessor) {
      toast.error(t("toasts.wallet.paymentProcessorNotAvailable"));
      return;
    }

    // ✅ Validate against processor limits using USD amount
    if (amountUSD < actualDepositProcessor.min_amount || amountUSD > actualDepositProcessor.max_amount) {
      toast.error(t("toasts.wallet.amountBetween", { min: actualDepositProcessor.min_amount, max: actualDepositProcessor.max_amount }));
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
          toast.success(t("toasts.wallet.openingPaymentProcessor"));
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

        toast.success(t("toasts.wallet.depositSuccessful"));
        setDepositAmount("");
        setDepositDialogOpen(false);
        onBalanceUpdate();
      }
    } catch (error: any) {
      console.error("Deposit error:", error);
      toast.error(error.message || t("toasts.wallet.failedToProcessDeposit"));
    } finally {
      setDepositLoading(false);
    }
  };

  const handleWithdraw = async () => {
    if (!withdrawAmount || !accountDetails) {
      toast.error(t("toasts.wallet.fillAllFields"));
      return;
    }
    
    // Validate crypto selection
    if (!selectedCrypto || !['usdc-solana', 'usdt-bep20'].includes(selectedCrypto.id)) {
      toast.error(t("toasts.wallet.selectValidWithdrawalMethod"));
      return;
    }

    const amount = parseFloat(withdrawAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error(t("toasts.wallet.pleaseEnterValidAmount"));
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
      toast.error(t("toasts.wallet.insufficientBalance"));
      return;
    }
    
    // PHASE 5.d: Check email verification (admins bypass this check)
    if (!isAdmin && profile && !profile.email_verified) {
      toast.error(t("toasts.wallet.emailVerificationRequired"));
      setWithdrawDialogOpen(false);
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
        toast.error(t("toasts.wallet.mustBeLoggedIn"));
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
        toast.error(t("toasts.wallet.pendingWithdrawalExists"));
        return;
      }

      // Get user profile and membership plan
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('membership_plan, earnings_wallet_balance')
        .eq('id', user.id)
        .single();

      if (profileError || !profile) {
        toast.error(t("toasts.wallet.failedToLoadProfile"));
        return;
      }

      // Get membership plan details
      const { data: plan, error: planError } = await supabase
        .from('membership_plans')
        .select('min_withdrawal, max_daily_withdrawal, min_daily_withdrawal')
        .eq('name', profile.membership_plan)
        .single();

      if (planError || !plan) {
        toast.error(t("toasts.wallet.failedToLoadMembershipPlan"));
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
        toast.error(t("toasts.wallet.minimumWithdrawal", { amount: minWithdrawal.toFixed(2) }));
        return;
      }

      // Validate minimum daily withdrawal (using USD)
      if (plan.min_daily_withdrawal) {
        const minDailyWithdrawal = typeof plan.min_daily_withdrawal === 'number'
          ? plan.min_daily_withdrawal
          : parseFloat(plan.min_daily_withdrawal as string);
        if (minDailyWithdrawal > 0 && amountUSD < minDailyWithdrawal) {
          toast.error(t("toasts.wallet.minimumDailyWithdrawal", { amount: minDailyWithdrawal.toFixed(2) }));
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
        toast.error(t("toasts.wallet.dailyLimitExceeded", { amount: remainingLimit.toFixed(2) }));
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

      // PHASE 3: Validate crypto address format
      if (accountDetails && !validateCryptoAddress(selectedCrypto.id, accountDetails)) {
        const msg = t("toasts.wallet.invalidAddressFormat", { crypto: selectedCrypto.displayName });
        toast.error(msg);
        setCryptoAddressError(msg);
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
      toast.error(error.message || t("toasts.wallet.failedToValidateWithdrawal"));
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
        toast.error(t("toasts.wallet.cryptocurrencySelectionRequired"));
        console.error('❌ Missing cryptoId:', pendingWithdrawalData);
        setWithdrawLoading(false);
        return;
      }

      // Validate cryptoId format
      const validCryptoIds = ['usdc-solana', 'usdt-bep20'];
      if (!validCryptoIds.includes(pendingWithdrawalData.cryptoId)) {
        toast.error(t("toasts.wallet.invalidCryptocurrency"));
        console.error('❌ Invalid cryptoId:', pendingWithdrawalData.cryptoId, 'Expected one of:', validCryptoIds);
        setWithdrawLoading(false);
        return;
      }

      console.log('✅ CryptoId validation passed:', pendingWithdrawalData.cryptoId);

      const amountUSD = convertLocalToUSD(parseFloat(pendingWithdrawalData.amount));

      // ✅ Use the actual crypto processor directly (no virtual methods)
      if (!actualCryptoProcessor) {
        toast.error(t("toasts.wallet.withdrawalProcessorNotAvailable"));
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

      toast.success(data.message || t("toasts.wallet.withdrawalRequestSubmitted"));
      setWithdrawAmount("");
      setAccountDetails("");
      setWithdrawDialogOpen(false);
      setShowWithdrawalConfirmation(false);
      setPendingWithdrawalData(null);
      onBalanceUpdate();
    } catch (error: any) {
      console.error("Withdrawal error:", error);
      toast.error(error.message || t("toasts.wallet.failedToProcessWithdrawal"));
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
            {t("wallet.components.walletBalance")}
          </CardTitle>
          <CardDescription>{t("wallet.components.manageDepositsEarnings")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 border border-primary/20 bg-primary/5 rounded-lg">
            <p className="text-sm text-muted-foreground mb-1">{t("wallet.components.depositWallet")}</p>
            <p className="text-2xl font-bold text-primary">
              <CurrencyDisplay amountUSD={depositBalance} />
            </p>
            <p className="text-xs text-muted-foreground mb-3">{t("wallet.components.forAccountUpgrades")}</p>
            <div className="flex flex-col gap-2">
              <Dialog open={depositDialogOpen} onOpenChange={setDepositDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="w-full bg-primary text-primary-foreground hover:bg-primary/90" size="sm">
                    <ArrowDownRight className="mr-2 h-4 w-4" />
                    {t("wallet.components.deposit")}
                  </Button>
                </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t("wallet.components.makeDeposit")}</DialogTitle>
                  <DialogDescription>
                    {t("wallet.components.addFundsToDepositWallet")}
                  </DialogDescription>
                </DialogHeader>
                
                {/* ✅ USDC Fee Savings Inline Alert */}
                <USDCFeeSavingsBanner variant="inline" className="mt-2" />
                
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="deposit-amount">
                      {t("wallet.components.amount")} ({userCurrency})
                    </Label>
                    <Input
                      id="deposit-amount"
                      type="number"
                      placeholder={t("wallet.components.enterAmountInCurrency", { currency: userCurrency })}
                      value={depositAmount}
                      onChange={(e) => setDepositAmount(e.target.value)}
                      min="0"
                      step="0.01"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      {t("wallet.components.available")}: <CurrencyDisplay amountUSD={depositBalance} />
                      {userCurrency !== 'USD' && depositAmount && parseFloat(depositAmount) > 0 && (
                        <span className="ml-2 text-blue-600 dark:text-blue-400 font-medium">
                          ≈ ${convertLocalToUSD(parseFloat(depositAmount)).toFixed(2)} USD
                        </span>
                      )}
                    </p>
                  </div>
                  {/* Payment method selection removed - user will select coin in CPAY popup */}
                  <Alert className="bg-blue-500/10 dark:bg-blue-500/20 border-blue-500/30 dark:border-blue-500/30">
                    <InfoIcon className="h-4 w-4 text-blue-500 dark:text-blue-400" />
                    <AlertDescription className="text-xs text-foreground">
                      {t("wallet.components.afterClickingConfirm")}
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
                        {t("wallet.components.processing")}
                      </>
                    ) : (
                      t("wallet.components.confirmDeposit")
                    )}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
              {userTransfersEnabled && (
                <>
                  <Button
                    variant="outline"
                    className="w-full border-primary/50 text-primary hover:bg-primary/10"
                    size="sm"
                    onClick={() => setSendFundsDialogOpen(true)}
                  >
                    <SendHorizontal className="mr-2 h-4 w-4" />
                    {t("wallet.components.sendFunds") ?? "Send Funds"}
                  </Button>
                  <SendFundsDialog
                    open={sendFundsDialogOpen}
                    onOpenChange={setSendFundsDialogOpen}
                    depositBalance={depositBalance}
                    minTransfer={minTransfer}
                    maxTransfer={maxTransfer}
                    onSuccess={onBalanceUpdate}
                  />
                </>
              )}
            </div>
          </div>

          <div className="p-4 border border-primary/20 bg-primary/5 rounded-lg">
            <p className="text-sm text-muted-foreground mb-1">{t("wallet.components.earningsWallet")}</p>
            <p className="text-2xl font-bold text-primary">
              <CurrencyDisplay amountUSD={earningsBalance} />
            </p>
            <p className="text-xs text-muted-foreground mb-3">{t("wallet.components.fromTasksReferrals")}</p>
            <Dialog open={withdrawDialogOpen} onOpenChange={setWithdrawDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="w-full border-primary/50 text-primary hover:bg-primary/10" size="sm">
                  <ArrowUpRight className="mr-2 h-4 w-4" />
                  {t("wallet.components.withdraw")}
                </Button>
              </DialogTrigger>
              <DialogContent className="p-0 gap-0 overflow-hidden max-h-[92vh] w-[96vw] max-w-[440px] sm:w-[90vw] sm:max-w-[520px] md:w-[600px] lg:w-[640px]">
                {/* Fixed Header */}
                <DialogHeader className="p-3 sm:p-4 md:p-6 border-b">
                  <DialogTitle>{t("wallet.components.requestWithdrawal")}</DialogTitle>
                  <DialogDescription>
                    {t("wallet.components.withdrawFundsFromEarningsWallet")}
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
                        <AlertTitle>{t("wallet.components.emailVerificationRequired")}</AlertTitle>
                        <AlertDescription>
                          {t("wallet.components.emailVerificationRequiredDescription")}
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
                          {t("wallet.components.vipWithdrawalAccess")}
                          <Badge variant="default" className="bg-primary hover:bg-primary/90">
                            {t("wallet.components.unrestricted")}
                          </Badge>
                        </AlertTitle>
                        <AlertDescription className="text-muted-foreground">
                          {t("wallet.components.vipWithdrawalDescription")}
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
                          {t("wallet.components.amount")} ({userCurrency})
                        </Label>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={handleWithdrawAll}
                          disabled={earningsBalance === 0 || withdrawLoading}
                          className="h-7 px-3 text-xs"
                        >
                          {t("wallet.components.all")}
                        </Button>
                      </div>
                      <Input
                        id="withdraw-amount"
                        type="number"
                        placeholder={t("wallet.components.enterAmountInCurrency", { currency: userCurrency })}
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
                        {t("wallet.components.available")}: <CurrencyDisplay amountUSD={earningsBalance} />
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
                        <Alert className="bg-blue-500/10 dark:bg-blue-500/20 border-blue-500/30 dark:border-blue-500/30">
                          <InfoIcon className="h-4 w-4 text-blue-500 dark:text-blue-400" />
                          <AlertDescription className="text-foreground">
                            <div className="text-xs space-y-1">
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">{t("wallet.components.withdrawalAmount")}:</span>
                                <span className="font-semibold">
                                  <CurrencyDisplay amountUSD={amountUSD} />
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">{t("wallet.components.processingFee")}</span>
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
                                <span className="font-semibold text-muted-foreground">{t("wallet.components.youWillReceive")}</span>
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
                        {t("wallet.components.withdrawalMethodSelect")}
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
                                toast.success(t("toasts.wallet.autoFilledSavedAddress", { crypto: crypto.displayName }));
                              } else if (crypto.id === 'usdt-bep20' && profile.usdt_bep20_address) {
                                setAccountDetails(profile.usdt_bep20_address);
                                toast.success(t("toasts.wallet.autoFilledSavedAddress", { crypto: crypto.displayName }));
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
                                    {t("wallet.components.recommended")}
                                  </Badge>
                                )}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Currency & Network Badge */}
                    <Alert className="bg-blue-500/10 dark:bg-blue-500/20 border-blue-500/30 dark:border-blue-500/30">
                      <InfoIcon className="h-4 w-4 text-blue-500 dark:text-blue-400" />
                      <AlertTitle className="text-foreground flex items-center gap-2">
                        {t("wallet.components.withdrawalCurrencyNetwork")}
                        <Badge variant="default" className="bg-blue-600 hover:bg-blue-700">
                          {selectedCrypto.icon} {selectedCrypto.displayName}
                        </Badge>
                      </AlertTitle>
                      <AlertDescription className="text-foreground text-sm">
                        {t("wallet.components.withdrawalCurrencyDescription", {
                          symbol: selectedCrypto.symbol,
                          network: selectedCrypto.network,
                          networkShort: selectedCrypto.networkShort
                        })}
                      </AlertDescription>
                    </Alert>

                    {/* Expandable Help Guide */}
                    <Collapsible className="w-full">
                      <CollapsibleTrigger className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
                        <HelpCircle className="h-4 w-4" />
                        <span className="underline">{t("wallet.components.howToGetAddress", { crypto: selectedCrypto.displayName })}</span>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="pt-3">
                        <div className="text-sm space-y-3 bg-muted/50 p-4 rounded-lg border border-border">
                          <p className="font-semibold text-foreground">{t("wallet.components.stepByStepGuide")}</p>
                          <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
                            <li>{t("wallet.components.step1")}</li>
                            <li>{t("wallet.components.step2")}</li>
                            <li>{t("wallet.components.step3", { symbol: selectedCrypto.symbol })} {selectedCrypto.id === 'usdc-solana' && '(not USDT)'}</li>
                            <li>{t("wallet.components.step4", { network: selectedCrypto.network })}</li>
                            <li>{t("wallet.components.step5")}</li>
                            <li>{t("wallet.components.step6")}</li>
                          </ol>
                          {selectedCrypto.addressExample && (
                            <div className="mt-2 p-2 bg-muted rounded border">
                              <p className="text-xs text-muted-foreground mb-1">{t("wallet.components.exampleAddressFormat")}</p>
                              <code className="text-xs font-mono break-all">{selectedCrypto.addressExample}</code>
                            </div>
                          )}
                          <Alert className="bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800 mt-3">
                            <AlertDescription className="text-amber-800 dark:text-amber-200 font-medium text-xs">
                              ⚠️ <strong>{t("wallet.components.important")}</strong> {t("wallet.components.importantDescription", { network: selectedCrypto.network })}
                            </AlertDescription>
                          </Alert>
                        </div>
                      </CollapsibleContent>
                    </Collapsible>

                    <div>
                      <Label htmlFor="account-details">
                        {t("wallet.components.walletAddress", {
                          symbol: selectedCrypto.symbol,
                          networkShort: selectedCrypto.networkShort
                        })}
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
                        {t("wallet.components.enterWalletAddress", { crypto: selectedCrypto.displayName })}
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
                        {t("wallet.components.processing")}
                      </>
                    ) : (
                      t("wallet.components.requestWithdrawal")
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
