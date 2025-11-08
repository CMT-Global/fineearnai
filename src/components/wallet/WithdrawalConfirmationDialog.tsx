import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle2, Copy } from "lucide-react";
import { CryptoCurrency } from "@/types/crypto-currencies";
import { toast } from "@/hooks/use-toast";

interface WithdrawalConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  amount: string;
  selectedCrypto: CryptoCurrency;
  address: string;
  isProcessing: boolean;
}

export const WithdrawalConfirmationDialog = ({
  open,
  onOpenChange,
  onConfirm,
  amount,
  selectedCrypto,
  address,
  isProcessing
}: WithdrawalConfirmationDialogProps) => {
  
  const copyAddress = () => {
    navigator.clipboard.writeText(address);
    toast({
      title: "Address Copied",
      description: "Withdrawal address copied to clipboard",
    });
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            <AlertDialogTitle>Confirm Withdrawal</AlertDialogTitle>
          </div>
          <AlertDialogDescription className="text-left space-y-4 pt-4">
            <div className="bg-muted/50 rounded-lg p-4 space-y-3">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Amount</p>
                <p className="text-2xl font-bold text-foreground">${amount}</p>
              </div>
              
              <div className="border-t border-border pt-3">
                <p className="text-xs text-muted-foreground mb-2">Cryptocurrency</p>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="font-semibold">
                    {selectedCrypto.symbol}
                  </Badge>
                  <span className="text-sm font-medium text-foreground">
                    {selectedCrypto.displayName}
                  </span>
                </div>
              </div>

              <div>
                <p className="text-xs text-muted-foreground mb-1">Network</p>
                <p className="text-sm font-medium text-foreground">{selectedCrypto.network}</p>
              </div>

              <div>
                <p className="text-xs text-muted-foreground mb-1">Withdrawal Address</p>
                <div className="bg-background rounded border border-border p-3 break-all">
                  <p className="text-xs font-mono text-foreground">{address}</p>
                </div>
                <button
                  onClick={copyAddress}
                  className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 mt-2 transition-colors"
                >
                  <Copy className="h-3 w-3" />
                  Copy Address
                </button>
              </div>
            </div>

            <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
              <div className="flex gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-amber-900 dark:text-amber-100">
                    Important Reminder
                  </p>
                  <p className="text-xs text-amber-800 dark:text-amber-200">
                    Please verify that the address above is correct. Cryptocurrency transactions are irreversible. 
                    Sending funds to the wrong address will result in permanent loss.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-start gap-2 text-xs text-muted-foreground">
              <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
              <p>
                Make sure you're using the <span className="font-semibold text-foreground">{selectedCrypto.network}</span> network 
                in your receiving wallet
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isProcessing}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={isProcessing}
            className="bg-primary hover:bg-primary/90"
          >
            {isProcessing ? "Processing..." : "Confirm Withdrawal"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
