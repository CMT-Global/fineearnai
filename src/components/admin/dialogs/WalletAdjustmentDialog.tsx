import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useUserManagement } from "@/hooks/useUserManagement";
import { validateWalletAdjustment, sanitizeUserInput } from "@/lib/admin-validation";
import { DollarSign, TrendingUp, TrendingDown } from "lucide-react";
import { toast } from "sonner";

interface WalletAdjustmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  username: string;
  currentBalance: {
    deposit: number;
    earnings: number;
  };
}

export const WalletAdjustmentDialog = ({
  open,
  onOpenChange,
  userId,
  username,
  currentBalance,
}: WalletAdjustmentDialogProps) => {
  const [walletType, setWalletType] = useState<"deposit" | "earnings">("deposit");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  
  const { adjustWalletBalance } = useUserManagement();

  const handleSubmit = () => {
    const parsedAmount = parseFloat(amount);
    
    // Validate using schema
    const validation = validateWalletAdjustment({
      wallet_type: walletType,
      amount: parsedAmount,
      reason: reason.trim(),
    });

    if (!validation.success) {
      const firstError = validation.error.errors[0];
      toast.error(firstError?.message || "Validation failed");
      return;
    }

    adjustWalletBalance.mutate(
      {
        userId,
        walletAdjustment: {
          wallet_type: walletType,
          amount: parsedAmount,
          reason: sanitizeUserInput(reason.trim()),
        },
      },
      {
        onSuccess: () => {
          onOpenChange(false);
          setAmount("");
          setReason("");
        },
      }
    );
  };

  const handleClose = () => {
    onOpenChange(false);
    setAmount("");
    setReason("");
  };

  const currentWalletBalance = walletType === "deposit" 
    ? currentBalance.deposit 
    : currentBalance.earnings;

  const newBalance = amount 
    ? (currentWalletBalance + parseFloat(amount)).toFixed(2)
    : currentWalletBalance.toFixed(2);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Adjust Wallet Balance
          </DialogTitle>
          <DialogDescription>
            Manually credit or debit {username}'s wallet balance
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Wallet Type Selection */}
          <div className="space-y-2">
            <Label>Wallet Type</Label>
            <RadioGroup value={walletType} onValueChange={(value: any) => setWalletType(value)}>
              <div className="flex items-center space-x-2 border rounded-lg p-3 hover:bg-accent/50 cursor-pointer">
                <RadioGroupItem value="deposit" id="deposit" />
                <Label htmlFor="deposit" className="flex-1 cursor-pointer">
                  <div className="font-medium">Deposit Wallet</div>
                  <div className="text-sm text-muted-foreground">
                    Current: ${currentBalance.deposit.toFixed(2)}
                  </div>
                </Label>
              </div>
              <div className="flex items-center space-x-2 border rounded-lg p-3 hover:bg-accent/50 cursor-pointer">
                <RadioGroupItem value="earnings" id="earnings" />
                <Label htmlFor="earnings" className="flex-1 cursor-pointer">
                  <div className="font-medium">Earnings Wallet</div>
                  <div className="text-sm text-muted-foreground">
                    Current: ${currentBalance.earnings.toFixed(2)}
                  </div>
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Amount Input */}
          <div className="space-y-2">
            <Label htmlFor="amount">
              Amount {parseFloat(amount) > 0 ? "(Credit)" : parseFloat(amount) < 0 ? "(Debit)" : ""}
            </Label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-muted-foreground">$</span>
              <Input
                id="amount"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="pl-7"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Use positive numbers to credit (add) or negative numbers to debit (subtract)
            </p>
          </div>

          {/* Preview New Balance */}
          {amount && (
            <div className="rounded-lg border bg-accent/50 p-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Current Balance:</span>
                <span className="font-medium">${currentWalletBalance.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between text-sm mt-1">
                <span className="text-muted-foreground">Adjustment:</span>
                <span className={`font-medium flex items-center gap-1 ${parseFloat(amount) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {parseFloat(amount) >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                  {parseFloat(amount) >= 0 ? '+' : ''}${parseFloat(amount).toFixed(2)}
                </span>
              </div>
              <div className="border-t mt-2 pt-2 flex items-center justify-between">
                <span className="font-medium">New Balance:</span>
                <span className="text-lg font-bold">${newBalance}</span>
              </div>
            </div>
          )}

          {/* Reason */}
          <div className="space-y-2">
            <Label htmlFor="reason">
              Reason <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="reason"
              placeholder="Explain why this adjustment is being made..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              maxLength={500}
            />
            <p className="text-xs text-muted-foreground">
              {reason.length}/500 characters
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={adjustWalletBalance.isPending}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={!amount || !reason.trim() || adjustWalletBalance.isPending}
          >
            {adjustWalletBalance.isPending ? "Processing..." : "Apply Adjustment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
