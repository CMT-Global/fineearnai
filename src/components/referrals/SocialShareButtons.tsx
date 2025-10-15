import { Button } from "@/components/ui/button";
import { MessageCircle, Send, Twitter, Facebook } from "lucide-react";

interface SocialShareButtonsProps {
  referralUrl: string;
  username: string;
}

export const SocialShareButtons = ({ referralUrl, username }: SocialShareButtonsProps) => {
  const shareMessage = `Join me on this amazing earning platform! Use my referral code to get started. ${referralUrl}`;
  
  const handleWhatsAppShare = () => {
    const url = `https://wa.me/?text=${encodeURIComponent(shareMessage)}`;
    window.open(url, "_blank");
  };

  const handleTelegramShare = () => {
    const url = `https://t.me/share/url?url=${encodeURIComponent(referralUrl)}&text=${encodeURIComponent(`Join me on this amazing earning platform! Use my referral code to get started.`)}`;
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
      <p className="text-sm font-medium">Share on Social Media</p>
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
