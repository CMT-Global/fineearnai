import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Copy, Check, Share2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

interface ReferralCodeCardProps {
  referralCode: string;
  username: string;
  platformName?: string;
}

export const ReferralCodeCard = ({ referralCode, username, platformName = "ProfitChips" }: ReferralCodeCardProps) => {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const referralUrl = `${window.location.origin}/signup?ref=${referralCode}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(referralUrl);
      setCopied(true);
      toast.success(t("referrals.toasts.referralLinkCopied"));
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error(t("referrals.toasts.failedToCopyLink"));
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Join ${platformName}`,
          text: `Join me on ${platformName} and earn money training AI! Use my referral code: ${referralCode}`,
          url: referralUrl,
        });
      } catch (error) {
        // User cancelled share
      }
    } else {
      handleCopy();
    }
  };

  return (
    <Card className="p-6">
      <h2 className="text-xl font-semibold mb-4">{t("referrals.yourReferralCode")}</h2>
      
      <div className="space-y-4">
        <div>
          <label className="text-sm text-muted-foreground mb-2 block">{t("referrals.referralCode")}</label>
          <div className="flex gap-2">
            <Input
              value={referralCode}
              readOnly
              className="font-mono text-lg font-semibold"
            />
            <Button
              variant="outline"
              size="icon"
              onClick={handleCopy}
              className="flex-shrink-0"
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        <div>
          <label className="text-sm text-muted-foreground mb-2 block">{t("referrals.referralLink")}</label>
          <div className="flex gap-2">
            <Input
              value={referralUrl}
              readOnly
              className="text-sm"
            />
            <Button
              variant="outline"
              size="icon"
              onClick={handleCopy}
              className="flex-shrink-0"
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            onClick={handleCopy}
            className="flex-1 bg-gradient-to-r from-[hsl(var(--wallet-deposit))] to-[hsl(var(--wallet-tasks))] text-white hover:opacity-90"
          >
            <Copy className="h-4 w-4 mr-2" />
            {t("referrals.copyLink")}
          </Button>
          <Button
            onClick={handleShare}
            variant="outline"
            className="flex-1"
          >
            <Share2 className="h-4 w-4 mr-2" />
            {t("referrals.share")}
          </Button>
        </div>

        <div className="bg-[hsl(var(--wallet-referrals))]/5 border border-[hsl(var(--wallet-referrals))]/20 rounded-lg p-4">
          <p className="text-sm text-muted-foreground">
            {t("referrals.shareLinkDescription")}
          </p>
        </div>
      </div>
    </Card>
  );
};
