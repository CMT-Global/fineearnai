import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle, XCircle, InfoIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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
  const [transactionStatus, setTransactionStatus] = useState<"pending" | "completed" | "failed">("pending");
  const [loading, setLoading] = useState(true);
  const [pollingCount, setPollingCount] = useState(0);
  const MAX_POLLS = 120; // Poll for 6 minutes (120 * 3 seconds) - increased for webhook processing time

  useEffect(() => {
    if (!open) {
      // Reset state when dialog closes
      setTransactionStatus("pending");
      setLoading(true);
      setPollingCount(0);
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
        const { data, error } = await supabase
          .from("transactions")
          .select("status, amount, new_balance")
          .eq("id", transactionId)
          .single();

        if (error) {
          console.error("[CPAY-IFRAME] Error polling transaction:", error);
          return;
        }

        if (data.status === "completed") {
          setTransactionStatus("completed");
          setLoading(false);
          clearInterval(pollInterval);
          
          console.log('✅ [CPAY-IFRAME] Deposit completed:', {
            transactionId,
            orderId,
            amount: data.amount,
            currency,
            newBalance: data.new_balance,
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
          toast.error("Payment failed or was cancelled.");
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
      <DialogContent className="max-w-4xl h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <DialogTitle className="flex items-center justify-between">
            <span>Complete Your Deposit</span>
            {transactionStatus === "pending" && (
              <span className="text-sm font-normal text-muted-foreground flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Waiting for payment...
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          {transactionStatus === "completed" ? (
            <div className="h-full flex items-center justify-center p-6">
              <div className="text-center space-y-4">
                <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center mx-auto">
                  <CheckCircle className="h-10 w-10 text-green-600" />
                </div>
                <h3 className="text-2xl font-bold">Payment Successful!</h3>
                <p className="text-muted-foreground">
                  Your deposit of ${amount} {currency} has been credited to your account.
                </p>
                <Button onClick={() => onOpenChange(false)}>
                  Close
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
              <Alert className="mx-6 mt-4">
                <InfoIcon className="h-4 w-4" />
                <AlertDescription>
                  <strong>Order ID:</strong> {orderId}
                  <br />
                  <strong>Amount:</strong> ${amount} {currency}
                  <br />
                  <span className="text-xs text-muted-foreground">
                    Select your preferred cryptocurrency and complete the payment. 
                    You can pay any amount - we'll credit the exact amount received.
                  </span>
                </AlertDescription>
              </Alert>
              
              <div className="flex-1 p-6 pt-4">
                <iframe
                  src={checkoutUrl}
                  className="w-full h-full border-0 rounded-lg"
                  title="CPAY Checkout"
                  sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox"
                  onLoad={() => setLoading(false)}
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
