import { useState } from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface FreeAccountUpgradeBannerProps {
  userId: string;
  planExpiresAt: string | null;
  /** When plan_expires_at is not set, we can derive expiry from plan start + free plan trial days */
  planStartDate?: string | null;
  /** Fallback: account created_at, used with freePlanExpiryDays when plan start is missing */
  accountCreatedAt?: string | null;
  freePlanExpiryDays?: number | null;
  onUpgrade: () => void;
}

export const FreeAccountUpgradeBanner = ({
  userId,
  planExpiresAt,
  planStartDate,
  accountCreatedAt,
  freePlanExpiryDays,
  onUpgrade,
}: FreeAccountUpgradeBannerProps) => {
  const [isDismissed, setIsDismissed] = useState(false);
  const { t } = useTranslation();

  const getDaysUntilExpiry = (): number | null => {
    const now = new Date();

    // 1) Prefer explicit expiry date from profile (plan_expires_at)
    if (planExpiresAt) {
      const expiryDate = new Date(planExpiresAt);
      const diffMs = expiryDate.getTime() - now.getTime();
      const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
      return diffDays > 0 ? diffDays : null;
    }

    // 2) Derive from plan start + free plan trial length
    const startSource = planStartDate || accountCreatedAt;
    if (startSource && freePlanExpiryDays != null && freePlanExpiryDays > 0) {
      const start = new Date(startSource);
      const expiryDate = new Date(start);
      expiryDate.setDate(expiryDate.getDate() + freePlanExpiryDays);
      const diffMs = expiryDate.getTime() - now.getTime();
      const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
      return diffDays > 0 ? diffDays : null;
    }

    return null;
  };

  const daysRemaining = getDaysUntilExpiry();

  const handleDismiss = () => {
    setIsDismissed(true);
  };

  if (isDismissed) return null;

  // Show actual days left when we can compute them; otherwise show generic CTA (no fake number)
  const hasActualDays = daysRemaining != null && daysRemaining > 0;
  const message = hasActualDays
    ? t("dashboard.freeBannerMessage", { days_left: daysRemaining, count: daysRemaining })
    : t("dashboard.freeBannerMessageNoExpiry");

  return (
    <div className="relative bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 lg:p-6 shadow-lg animate-in slide-in-from-top-2 duration-300">
      <div className="flex flex-col lg:flex-row items-start lg:items-center gap-4">
        <div className="flex-shrink-0">
          <AlertTriangle className="h-6 w-6 text-yellow-600 dark:text-yellow-500" />
        </div>

        <div className="flex-1">
          <h3 className="text-lg font-semibold text-foreground mb-1">
            {t("dashboard.freeBannerTitle")}
          </h3>
          <p className="text-sm text-muted-foreground">{message}</p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={onUpgrade}
            className="bg-orange-600 hover:bg-orange-700 text-white font-semibold shadow-md"
          >
            {t("dashboard.upgradeNow")}
          </Button>
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
