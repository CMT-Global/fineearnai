import { useState, useEffect } from "react";
import { TrendingUp, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PremiumUpgradeBannerProps {
  userId: string;
  currentPlan: string;
  onUpgrade: () => void;
}

export const PremiumUpgradeBanner = ({ userId, currentPlan, onUpgrade }: PremiumUpgradeBannerProps) => {
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    const dismissed = localStorage.getItem(`premiumUpgradeBannerDismissed_${userId}_${currentPlan}`);
    if (dismissed === "true") {
      setIsDismissed(true);
    }
  }, [userId, currentPlan]);

  const handleDismiss = () => {
    localStorage.setItem(`premiumUpgradeBannerDismissed_${userId}_${currentPlan}`, "true");
    setIsDismissed(true);
  };

  if (isDismissed) return null;

  return (
    <div className="relative bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg p-4 lg:p-6 shadow-lg animate-in slide-in-from-top-2 duration-300">
      <div className="flex flex-col lg:flex-row items-start lg:items-center gap-4">
        {/* Icon */}
        <div className="flex-shrink-0">
          <TrendingUp className="h-6 w-6 text-white" />
        </div>

        {/* Content */}
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-lg font-semibold text-white">
              Ready for the Next Level?
            </h3>
          </div>
          <p className="text-sm text-white/90">
            💰 Want to Boost your Earnings?
          </p>
          <p className="text-sm text-white/90 mt-1">
            Feel Free to Upgrade to a higher plan anytime — just{' '}
            <strong className="font-bold text-white">top up the difference</strong>{' '}
            to boost your Daily and Weekly income.
          </p>
          <p className="text-sm text-white/90 mt-1">
            💎 Don't miss out
          </p>
        </div>

        {/* CTA Button */}
        <div className="flex items-center gap-2">
          <Button
            onClick={onUpgrade}
            className="bg-white text-blue-600 hover:bg-white/90 font-semibold shadow-md"
          >
            Upgrade My Account
          </Button>

          {/* Close Button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={handleDismiss}
            className="text-white/80 hover:text-white hover:bg-white/10"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </div>
  );
};
