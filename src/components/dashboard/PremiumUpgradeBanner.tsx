import { useState, useEffect } from "react";
import { TrendingUp, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase";

interface PremiumUpgradeBannerProps {
  userId: string;
  currentPlan: string;
  onUpgrade: () => void;
  /** Plan name for the highest tier (from DB). When user is on this plan, banner is hidden. */
  highestTierPlanName?: string | null;
}

export const PremiumUpgradeBanner = ({ userId, currentPlan, onUpgrade, highestTierPlanName }: PremiumUpgradeBannerProps) => {
  const [isDismissed, setIsDismissed] = useState(true);

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("membership_plan")
          .eq("id", userId)
          .limit(1)
          .maybeSingle();

        if (!isMounted) return;

        const userPlanName = data?.membership_plan ?? null;
        const isOnHighestTier = highestTierPlanName && userPlanName === highestTierPlanName;
        if (isOnHighestTier) {
          setIsDismissed(true);
          return;
        }
        const dismissed = localStorage.getItem(`premiumUpgradeBannerDismissed_${userId}_${currentPlan}`);
        setIsDismissed(dismissed === "true");
      } finally {
        isMounted = false;
      }
    })();
    return () => { isMounted = false; };
  }, [userId, currentPlan, highestTierPlanName]);
  if (isDismissed) return null;

  const handleDismiss = () => {
    localStorage.setItem(`premiumUpgradeBannerDismissed_${userId}_${currentPlan}`, "true");
    setIsDismissed(true);
  };

  if (isDismissed) return null;

  return (
    <div className="relative bg-orange-500/10 border border-orange-500/30 rounded-lg p-4 lg:p-6 shadow-lg animate-in slide-in-from-top-2 duration-300">
      <div className="flex flex-col lg:flex-row items-start lg:items-center gap-4">
        {/* Icon */}
        <div className="flex-shrink-0">
          <TrendingUp className="h-6 w-6 text-orange-600 dark:text-orange-500" />
        </div>

        {/* Content */}
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-lg font-semibold text-foreground">
              Global Access, No Country Limits!
            </h3>
          </div>
          <p className="text-sm text-muted-foreground">
            💎 Unlike platforms that only accept users from certain countries, ProfitChips is available{' '}
            <strong className="font-bold text-orange-600 dark:text-orange-500">worldwide</strong>. The{' '}
            <strong className="font-bold text-orange-600 dark:text-orange-500">one-time account activation fee</strong>{' '}
            helps <strong className="font-bold text-orange-600 dark:text-orange-500">reduce spam and keep access open globally</strong>. Upgrade your account anytime to{' '}
            <strong className="font-bold text-orange-600 dark:text-orange-500">unlock the full earning potential</strong>{' '}
            of your ProfitChips account.
          </p>
        </div>

        {/* CTA Button */}
        <div className="flex items-center gap-2">
          <Button
            onClick={onUpgrade}
            className="bg-orange-600 hover:bg-orange-700 text-white font-semibold shadow-md"
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
