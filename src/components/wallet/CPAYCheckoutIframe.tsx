import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle, XCircle, InfoIcon, ChevronDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/use-mobile";
import { useTranslation } from "react-i18next";

interface CPAYCheckoutIframeProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  checkoutUrl: string;
  transactionId: string;
  orderId: string;
  amount: number;
  currency: string;
  onSuccess: () => void;
}

export const CPAYCheckoutIframe = ({
  open,
  onOpenChange,
  checkoutUrl,
  transactionId,
  orderId,
  amount,
  currency,
  onSuccess,
}: CPAYCheckoutIframeProps) => {
  const { t } = useTranslation();
  const [transactionStatus, setTransactionStatus] = useState<"pending" | "completed" | "failed">("pending");
  const [loading, setLoading] = useState(true);
  const [pollingCount, setPollingCount] = useState(0);
  const [showingConfirmation, setShowingConfirmation] = useState(false); // ✅ NEW: Loading state during transition
  const [showScrollHint, setShowScrollHint] = useState(true);
  const isMobile = useIsMobile();
  const MAX_POLLS = 120; // Poll for 6 minutes (120 * 3 seconds) - increased for webhook processing time

  useEffect(() => {
    if (!open) {
      // Reset state when dialog closes
      setTransactionStatus("pending");
      setLoading(true);
      setPollingCount(0);
      setShowingConfirmation(false); // ✅ Reset confirmation state
      setShowScrollHint(true);
      return;
    }

    // Start polling for transaction status
    const pollInterval = setInterval(async () => {
      setPollingCount((prev) => {
        if (prev >= MAX_POLLS) {
          clearInterval(pollInterval);
          return prev;
        }
        return prev + 1;
      });

      try {
        // First check if original transaction was updated
        const { data: originalTxn, error: originalError } = await supabase
          .from("transactions")
          .select("status, amount, new_balance")
          .eq("id", transactionId)
          .single();

        if (originalError) {
          console.error("[CPAY-IFRAME] Error polling transaction:", originalError);
          return;
        }

        // Check for new completed transaction created by webhook
        const { data: newTxnArray, error: newError } = await supabase
          .from("transactions")
          .select("status, amount, new_balance, metadata")
          .eq("status", "completed")
          .eq("payment_gateway", "cpay")
          .contains("metadata", { original_transaction_id: transactionId })
          .order("created_at", { ascending: false })
          .limit(1);

        // Use the new transaction if it exists and is completed, otherwise use original
        const data = (newTxnArray && newTxnArray.length > 0) 
          ? newTxnArray[0] 
          : originalTxn;
        
        const wasNewTransaction = newTxnArray && newTxnArray.length > 0;

        if (data.status === "completed") {
          setShowingConfirmation(true); // ✅ Show our loading state immediately
          setTransactionStatus("completed");
          setLoading(false);
          clearInterval(pollInterval);
          
          console.log('✅ [CPAY-IFRAME] Deposit completed:', {
            transactionId,
            orderId,
            amount: data.amount,
            currency,
            newBalance: data.new_balance,
            wasNewTransaction,
            timestamp: new Date().toISOString()
          });
          
          // Enhanced success toast with detailed information
          toast.success(
            `Deposit successful! $${data.amount.toFixed(2)} ${currency} has been credited to your account.`,
            { duration: 4000 }
          );
          
          // ✅ Reduced delay for faster close (1.5s instead of 2s)
          setTimeout(() => {
            onSuccess(); // Triggers balance refresh
            onOpenChange(false); // Closes iframe
          }, 1500);
        } else if (data.status === "failed") {
          setTransactionStatus("failed");
          setLoading(false);
          clearInterval(pollInterval);
          toast.error(t("admin.toasts.paymentFailedOrCancelled"));
        }
      } catch (err) {
        console.error("[CPAY-IFRAME] Polling error:", err);
      }
    }, 3000); // Poll every 3 seconds

    // Cleanup on unmount or when dialog closes
    return () => {
      clearInterval(pollInterval);
    };
  }, [open, transactionId, onSuccess, onOpenChange]);

  const handleClose = () => {
    if (transactionStatus === "pending") {
      const confirmClose = window.confirm(
        "Your payment may still be processing. Are you sure you want to close this window?"
      );
      if (!confirmClose) return;
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className={`${isMobile ? 'max-w-full h-[95vh]' : 'max-w-4xl h-[90vh]'} flex flex-col p-0`}>
        <DialogHeader className={`${isMobile ? 'px-3 pt-4 pb-3' : 'px-6 pt-6 pb-4'} border-b`}>
          <DialogTitle className={`flex items-center justify-between ${isMobile ? 'text-lg' : ''}`}>
            <span>Complete Your Deposit</span>
            {transactionStatus === "pending" && (
              <span className="text-sm font-normal text-muted-foreground flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Waiting for payment...
              </span>
            )}
          </DialogTitle>
          <DialogDescription className="sr-only">
            Complete your deposit payment using the secure payment form below
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          {showingConfirmation && transactionStatus !== "completed" ? (
            <div className="h-full flex items-center justify-center p-6">
              <div className="text-center space-y-4">
                <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary" />
                <p className="text-muted-foreground">Processing confirmation...</p>
              </div>
            </div>
          ) : transactionStatus === "completed" ? (
            <div className="h-full flex items-center justify-center p-6">
              <div className="text-center space-y-4">
                <div className="h-16 w-16 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center mx-auto animate-in zoom-in">
                  <CheckCircle className="h-10 w-10 text-green-600 dark:text-green-400" />
                </div>
                <h3 className="text-2xl font-bold">Payment Successful!</h3>
                <p className="text-muted-foreground">
                  Your deposit of <span className="font-semibold text-green-600 dark:text-green-400">${amount.toFixed(2)} {currency}</span> has been credited to your Deposit Wallet.
                </p>
                <p className="text-xs text-muted-foreground">
                  Closing automatically...
                </p>
                <Button onClick={() => onOpenChange(false)} variant="outline">
                  Close Now
                </Button>
              </div>
            </div>
          ) : transactionStatus === "failed" ? (
            <div className="h-full flex items-center justify-center p-6">
              <div className="text-center space-y-4">
                <div className="h-16 w-16 rounded-full bg-red-100 flex items-center justify-center mx-auto">
                  <XCircle className="h-10 w-10 text-red-600" />
                </div>
                <h3 className="text-2xl font-bold">Payment Failed</h3>
                <p className="text-muted-foreground">
                  Your payment was not completed. Please try again.
                </p>
                <Button onClick={() => onOpenChange(false)}>
                  Close & Try Again
                </Button>
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col">
              <Alert className={`${isMobile ? 'mx-3 mt-2' : 'mx-6 mt-4'}`}>
                <InfoIcon className={isMobile ? 'h-3 w-3' : 'h-4 w-4'} />
                <AlertDescription className={isMobile ? 'text-[10px]' : ''}>
                  {isMobile ? (
                    <>
                      <div className="flex gap-1.5">
                        <strong>Order:</strong> <span className="font-mono text-[9px]">{orderId}</span>
                      </div>
                      <div className="flex gap-1.5 mt-0.5">
                        <strong>Amount:</strong> <span>${amount} {currency}</span>
                      </div>
                      <span className="text-[9px] text-muted-foreground mt-1 block">
                        Select crypto & pay. We credit exact amount received.
                      </span>
                    </>
                  ) : (
                    <>
                      <strong>Order ID:</strong> {orderId}
                      <br />
                      <strong>Amount:</strong> ${amount} {currency}
                      <br />
                      <span className="text-xs text-muted-foreground">
                        Select your preferred cryptocurrency and complete the payment. 
                        You can pay any amount - we'll credit the exact amount received.
                      </span>
                    </>
                  )}
                </AlertDescription>
              </Alert>

              {isMobile && showScrollHint && (
                <div className="mx-3 mt-2 flex items-center justify-center gap-1 text-[10px] text-muted-foreground animate-bounce">
                  <ChevronDown className="h-3 w-3" />
                  <span>Scroll to see all payment options</span>
                  <ChevronDown className="h-3 w-3" />
                </div>
              )}
              
              <div className={`flex-1 relative ${isMobile ? 'p-2 pt-2' : 'p-6 pt-4'}`}>
                <iframe
                  src={checkoutUrl}
                  className="w-full h-full border-0 rounded-lg"
                  title="CPAY Checkout"
                  sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox"
                  allow="clipboard-read; clipboard-write"
                  onLoad={() => {
                    setLoading(false);
                    if (isMobile) {
                      setTimeout(() => setShowScrollHint(false), 3000);
                    }
                  }}
                />
                
                {loading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-background/80">
                    <Loader2 className="h-8 w-8 animate-spin" />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {transactionStatus === "pending" && pollingCount >= MAX_POLLS && (
          <Alert className="mx-6 mb-6">
            <InfoIcon className="h-4 w-4" />
            <AlertDescription className="text-xs">
              Payment confirmation is taking longer than expected. 
              You can close this window - we'll credit your account once payment is confirmed.
            </AlertDescription>
          </Alert>
        )}
      </DialogContent>
    </Dialog>
  );
};
