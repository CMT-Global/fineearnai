import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Ticket, Loader2, CheckCircle2, Info } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

interface VoucherRedemptionCardProps {
  userId: string;
  onRedemptionSuccess?: () => void;
}

export const VoucherRedemptionCard = ({ userId, onRedemptionSuccess }: VoucherRedemptionCardProps) => {
  const [voucherCode, setVoucherCode] = useState("");
  const [isRedeeming, setIsRedeeming] = useState(false);
  const queryClient = useQueryClient();

  const handleRedeem = async () => {
    if (!voucherCode.trim()) {
      toast.error("Please enter a voucher code");
      return;
    }

    setIsRedeeming(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast.error("Please log in to redeem vouchers");
        return;
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/redeem-voucher`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ voucher_code: voucherCode.trim().toUpperCase() }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to redeem voucher');
      }

      toast.success(
        `Voucher redeemed successfully!`,
        {
          description: `${result.voucher.voucher_amount} USD credited to your deposit wallet`,
          icon: <CheckCircle2 className="h-5 w-5 text-green-600" />,
        }
      );

      setVoucherCode("");
      
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      
      onRedemptionSuccess?.();

    } catch (error: any) {
      console.error('Voucher redemption error:', error);
      toast.error(error.message || 'Failed to redeem voucher');
    } finally {
      setIsRedeeming(false);
    }
  };

  return (
    <Card className="border-2 border-dashed border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Ticket className="h-5 w-5 text-primary" />
          </div>
          <div>
            <CardTitle>Redeem Voucher</CardTitle>
            <CardDescription>
              Enter your voucher code to add funds to your deposit wallet
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Auto-Redemption Notice */}
          <Alert className="border-blue-500 bg-blue-50 dark:bg-blue-950/20">
            <Info className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-xs text-blue-800 dark:text-blue-200">
              <strong>Note:</strong> New vouchers sent by partners are now automatically credited to your wallet. 
              This redemption form is only for older voucher codes received before the auto-redemption update.
            </AlertDescription>
          </Alert>

          <div>
            <Label htmlFor="voucher-code">Voucher Code</Label>
            <Input
              id="voucher-code"
              placeholder="FE-XXXX-XXXX-XXXX"
              value={voucherCode}
              onChange={(e) => setVoucherCode(e.target.value.toUpperCase())}
              maxLength={17}
              className="font-mono text-lg tracking-wider"
              disabled={isRedeeming}
            />
          </div>
          
          <Button 
            onClick={handleRedeem}
            disabled={isRedeeming || !voucherCode.trim()}
            className="w-full"
            size="lg"
          >
            {isRedeeming ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Redeeming...
              </>
            ) : (
              <>
                <Ticket className="h-4 w-4 mr-2" />
                Redeem Voucher
              </>
            )}
          </Button>

          <div className="bg-muted/50 p-3 rounded-lg">
            <p className="text-xs text-muted-foreground">
              💡 <strong>Tip:</strong> Purchase vouchers from Local Partners at discounted rates and redeem them here to add funds to your deposit wallet.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
