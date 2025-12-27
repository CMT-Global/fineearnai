import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Ticket, Loader2, CheckCircle2, Info } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { CurrencyDisplay } from "@/components/ui/CurrencyDisplay";

interface VoucherRedemptionCardProps {
  userId: string;
  onRedemptionSuccess?: () => void;
}

export const VoucherRedemptionCard = ({ userId, onRedemptionSuccess }: VoucherRedemptionCardProps) => {
  const { t } = useTranslation();
  const [voucherCode, setVoucherCode] = useState("");
  const [isRedeeming, setIsRedeeming] = useState(false);
  const queryClient = useQueryClient();

  const handleRedeem = async () => {
    if (!voucherCode.trim()) {
      toast.error(t("wallet.voucherRedemption.pleaseEnterCode"));
      return;
    }

    setIsRedeeming(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast.error(t("wallet.voucherRedemption.pleaseLogIn"));
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
        t("wallet.voucherRedemption.redeemedSuccessfully"),
        {
          description: t("wallet.voucherRedemption.creditedToWallet", { amount: result.voucher.voucher_amount }),
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
      toast.error(error.message || t("wallet.voucherRedemption.failedToRedeem"));
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
            <CardTitle>{t("wallet.voucherRedemption.title")}</CardTitle>
            <CardDescription>
              {t("wallet.voucherRedemption.description")}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            <Label htmlFor="voucher-code">{t("wallet.voucherRedemption.voucherCode")}</Label>
            <Input
              id="voucher-code"
              placeholder={t("wallet.voucherRedemption.voucherCodePlaceholder")}
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
                {t("wallet.voucherRedemption.redeeming")}
              </>
            ) : (
              <>
                <Ticket className="h-4 w-4 mr-2" />
                {t("wallet.voucherRedemption.redeem")}
              </>
            )}
          </Button>

          <div className="bg-muted/50 p-3 rounded-lg">
            <p className="text-xs text-muted-foreground">
              {t("wallet.voucherRedemption.tip")}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
