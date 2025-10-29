import { useState, useEffect } from "react";
import { AlertTriangle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCurrencyConversion } from "@/hooks/useCurrencyConversion";

interface FreeAccountUpgradeBannerProps {
  userId: string;
  onUpgrade: () => void;
}

export const FreeAccountUpgradeBanner = ({ userId, onUpgrade }: FreeAccountUpgradeBannerProps) => {
  const [isDismissed, setIsDismissed] = useState(false);
  const { formatAmount, isLoading: isCurrencyLoading } = useCurrencyConversion();

  useEffect(() => {
    const dismissed = localStorage.getItem(`freeAccountBannerDismissed_${userId}`);
    if (dismissed === "true") {
      setIsDismissed(true);
    }
  }, [userId]);

  const handleDismiss = () => {
    localStorage.setItem(`freeAccountBannerDismissed_${userId}`, "true");
    setIsDismissed(true);
  };

  if (isDismissed) return null;

  return (
    <div className="relative bg-gradient-to-r from-destructive to-destructive/90 rounded-lg p-4 lg:p-6 shadow-lg animate-in slide-in-from-top-2 duration-300">
      <div className="flex flex-col lg:flex-row items-start lg:items-center gap-4">
        {/* Icon */}
        <div className="flex-shrink-0">
          <AlertTriangle className="h-6 w-6 text-destructive-foreground" />
        </div>

        {/* Content */}
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-lg font-semibold text-destructive-foreground">
              ⚠️ You're on a Free Account
            </h3>
          </div>
          <p className="text-sm text-destructive-foreground/90">
            Free accounts have limited access to higher-paying tasks. 
            Upgrade to access Higher Paying AI Training tasks and earn up to{' '}
            <strong className="font-bold text-destructive-foreground">
              {isCurrencyLoading ? "$240" : formatAmount(240)}/week
            </strong>.
          </p>
          <p className="text-sm text-destructive-foreground/90 mt-1">
            💎 Don't miss out
          </p>
        </div>

        {/* CTA Button */}
        <div className="flex items-center gap-2">
          <Button
            onClick={onUpgrade}
            className="bg-background text-destructive hover:bg-background/90 font-semibold shadow-md"
          >
            Upgrade My Account
          </Button>

          {/* Close Button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={handleDismiss}
            className="text-destructive-foreground/80 hover:text-destructive-foreground hover:bg-destructive-foreground/10"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </div>
  );
};
