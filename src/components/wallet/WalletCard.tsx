import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Wallet, ArrowUpRight, ArrowDownRight, Loader2 } from "lucide-react";
import { formatCurrency } from "@/lib/wallet-utils";

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

    try {
      setDepositLoading(true);
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

    try {
      setWithdrawLoading(true);
      const { data, error } = await supabase.functions.invoke("withdraw", {
        body: {
          amount,
          withdrawalMethod: withdrawMethod,
          accountDetails,
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

  return (
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
              {formatCurrency(depositBalance)}
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
                    <Select value={depositMethod} onValueChange={setDepositMethod}>
                      <SelectTrigger id="deposit-method">
                        <SelectValue placeholder="Select payment method" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                        <SelectItem value="card">Credit/Debit Card</SelectItem>
                        <SelectItem value="paypal">PayPal</SelectItem>
                        <SelectItem value="crypto">Cryptocurrency</SelectItem>
                      </SelectContent>
                    </Select>
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
              {formatCurrency(earningsBalance)}
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
                  <div>
                    <Label htmlFor="withdraw-amount">Amount</Label>
                    <Input
                      id="withdraw-amount"
                      type="number"
                      placeholder="Enter amount"
                      value={withdrawAmount}
                      onChange={(e) => setWithdrawAmount(e.target.value)}
                      min="0"
                      step="0.01"
                      max={earningsBalance}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Available: {formatCurrency(earningsBalance)}
                    </p>
                  </div>
                  <div>
                    <Label htmlFor="withdraw-method">Withdrawal Method</Label>
                    <Select value={withdrawMethod} onValueChange={setWithdrawMethod}>
                      <SelectTrigger id="withdraw-method">
                        <SelectValue placeholder="Select withdrawal method" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                        <SelectItem value="paypal">PayPal</SelectItem>
                        <SelectItem value="crypto">Cryptocurrency</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="account-details">Account Details</Label>
                    <Textarea
                      id="account-details"
                      placeholder="Enter your account details (bank account number, PayPal email, crypto address, etc.)"
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
  );
};
