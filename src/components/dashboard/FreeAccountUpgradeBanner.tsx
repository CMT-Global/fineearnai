import { useState, useEffect } from "react";
import { AlertTriangle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCurrencyConversion } from "@/hooks/useCurrencyConversion";

interface FreeAccountUpgradeBannerProps {
  userId: string;
  planExpiresAt: string | null;
  onUpgrade: () => void;
}

export const FreeAccountUpgradeBanner = ({ userId, planExpiresAt, onUpgrade }: FreeAccountUpgradeBannerProps) => {
  const [isDismissed, setIsDismissed] = useState(false);
  const { formatAmount, isLoading: isCurrencyLoading } = useCurrencyConversion();

  const getDaysUntilExpiry = (): number | null => {
    if (!planExpiresAt) return null;
    
    const expiryDate = new Date(planExpiresAt);
    const now = new Date();
    const diffTime = expiryDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return diffDays > 0 ? diffDays : null;
  };

  const daysRemaining = getDaysUntilExpiry();

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
    <div className="relative bg-gradient-to-r from-red-500/20 to-orange-500/10 border border-red-500/30 rounded-lg p-4 lg:p-6 shadow-lg animate-in slide-in-from-top-2 duration-300">
      <div className="flex flex-col lg:flex-row items-start lg:items-center gap-4">
        {/* Icon */}
        <div className="flex-shrink-0">
          <AlertTriangle className="h-6 w-6 text-red-500" />
        </div>

        {/* Content */}
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-lg font-semibold text-foreground">
              ⚠️ You're on a Free Account
            </h3>
          </div>
          <p className="text-sm text-muted-foreground">
            Free accounts have limited access to higher-paying tasks. 
            Upgrade to access Higher Paying AI Training tasks and earn up to{' '}
            <strong className="font-bold text-primary">
              {isCurrencyLoading ? "$240" : formatAmount(240)}/week
            </strong>.
          </p>
          {daysRemaining && (
            <p className="text-sm text-muted-foreground mt-2 font-semibold">
              ⏰ Your account will expire in <span className="text-red-400">{daysRemaining} day{daysRemaining !== 1 ? 's' : ''}</span>. 
              Make sure you upgrade your account before it expires to ensure you continue earning with us.
            </p>
          )}
          <p className="text-sm text-muted-foreground mt-1">
            💎 Don't miss out
          </p>
        </div>

        {/* CTA Button */}
        <div className="flex items-center gap-2">
          <Button
            onClick={onUpgrade}
            className="bg-primary text-primary-foreground hover:bg-primary/90 font-semibold shadow-md"
          >
            Upgrade My Account
          </Button>

          {/* Close Button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={handleDismiss}
            className="text-muted-foreground hover:text-foreground hover:bg-white/10"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </div>
  );
};
