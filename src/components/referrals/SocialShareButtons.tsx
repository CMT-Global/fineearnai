import { Button } from "@/components/ui/button";
import { MessageCircle, Send, Twitter, Facebook } from "lucide-react";
import { useTranslation } from "react-i18next";

interface SocialShareButtonsProps {
  referralUrl: string;
  username: string;
  platformName?: string;
}

export const SocialShareButtons = ({ referralUrl, username, platformName = "ProfitChips" }: SocialShareButtonsProps) => {
  const { t } = useTranslation();
  const shareMessage = `Join me on ${platformName} and start earning by training AI! Use my invite code to get started. ${referralUrl}`;
  const shareText = `Join me on ${platformName} and start earning by training AI! Use my invite code to get started.`;
  
  const handleWhatsAppShare = () => {
    const url = `https://wa.me/?text=${encodeURIComponent(shareMessage)}`;
    window.open(url, "_blank");
  };

  const handleTelegramShare = () => {
    const url = `https://t.me/share/url?url=${encodeURIComponent(referralUrl)}&text=${encodeURIComponent(shareText)}`;
    window.open(url, "_blank");
  };

  const handleTwitterShare = () => {
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareMessage)}`;
    window.open(url, "_blank");
  };

  const handleFacebookShare = () => {
    const url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(referralUrl)}`;
    window.open(url, "_blank");
  };

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium">{t("referrals.shareOnSocialMedia")}</p>
      <p className="text-xs text-muted-foreground">{t("referrals.inviteViaWhatsAppTelegram")}</p>
      <div className="grid grid-cols-2 gap-2">
        <Button
          variant="outline"
          onClick={handleWhatsAppShare}
          className="gap-2 justify-start"
        >
          <MessageCircle className="h-4 w-4 text-green-600" />
          WhatsApp
        </Button>
        
        <Button
          variant="outline"
          onClick={handleTelegramShare}
          className="gap-2 justify-start"
        >
          <Send className="h-4 w-4 text-blue-500" />
          Telegram
        </Button>
        
        <Button
          variant="outline"
          onClick={handleTwitterShare}
          className="gap-2 justify-start"
        >
          <Twitter className="h-4 w-4 text-blue-400" />
          Twitter
        </Button>
        
        <Button
          variant="outline"
          onClick={handleFacebookShare}
          className="gap-2 justify-start"
        >
          <Facebook className="h-4 w-4 text-blue-600" />
          Facebook
        </Button>
      </div>
    </div>
  );
};
