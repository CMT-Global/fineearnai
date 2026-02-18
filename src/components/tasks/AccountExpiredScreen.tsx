import { useTranslation } from "react-i18next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Sparkles, LayoutDashboard, ExternalLink } from "lucide-react";
import { getDaysSinceExpiry } from "@/lib/plan-utils";
import { format } from "date-fns";

interface AccountExpiredScreenProps {
  membershipPlan: string;
  planExpiresAt: string | null;
  onUpgrade: () => void;
  onGoToDashboard: () => void;
}

export const AccountExpiredScreen = ({
  membershipPlan,
  planExpiresAt,
  onUpgrade,
  onGoToDashboard,
}: AccountExpiredScreenProps) => {
  const { t } = useTranslation();
  const planDisplayName = membershipPlan
    ?.split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ") || "Free";
  const daysSinceExpiry = planExpiresAt ? getDaysSinceExpiry(planExpiresAt) : null;

  return (
    <Card className="border-2 border-destructive/30 bg-gradient-to-br from-destructive/5 to-background">
      <CardHeader className="text-center space-y-4 pb-4">
        <div className="mx-auto w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center">
          <AlertCircle className="h-8 w-8 text-destructive" />
        </div>
        <div>
          <CardTitle className="text-2xl font-bold text-destructive">
            {t("tasks.accountExpired.title")}
          </CardTitle>
          <CardDescription className="text-base mt-2">
            {t("tasks.accountExpired.message")}
          </CardDescription>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Plan & Expiry Details */}
        <div className="bg-card rounded-lg p-4 border space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <span className="text-sm font-medium text-muted-foreground">
                {t("tasks.accountExpired.currentPlan")}:
              </span>
              <Badge variant="outline" className="ml-2 text-sm">
                {planDisplayName}
              </Badge>
            </div>
            {planExpiresAt && (
              <div className="text-sm text-muted-foreground">
                <span className="font-medium">{t("tasks.accountExpired.expiredOn")}: </span>
                {format(new Date(planExpiresAt), "PPP")}
              </div>
            )}
          </div>
          {daysSinceExpiry != null && daysSinceExpiry > 0 && (
            <p className="text-sm font-medium text-destructive">
              {daysSinceExpiry === 1
                ? t("tasks.accountExpired.expiredOneDayAgo")
                : t("tasks.accountExpired.expiredDaysAgo", { days: daysSinceExpiry })}
            </p>
          )}
        </div>

        {/* Primary CTA */}
        <div className="space-y-3">
          <Button
            onClick={onUpgrade}
            className="w-full h-12 text-base font-semibold bg-orange-600 hover:bg-orange-700 text-white"
            size="lg"
          >
            <Sparkles className="mr-2 h-5 w-5" />
            {t("tasks.accountExpired.upgradeCta")}
          </Button>
          <Button
            variant="outline"
            onClick={onGoToDashboard}
            className="w-full h-11"
          >
            <LayoutDashboard className="mr-2 h-4 w-4" />
            {t("tasks.accountExpired.goToDashboard")}
          </Button>
        </div>

        {/* Support Link */}
        <div className="text-center pt-2 border-t">
          <p className="text-sm text-muted-foreground mb-1">
            {t("tasks.accountExpired.needHelp")}{" "}
            <a
              href="https://help.profitchips.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline inline-flex items-center gap-1"
            >
              {t("tasks.accountExpired.supportLink")}
              <ExternalLink className="h-3 w-3" />
            </a>
          </p>
        </div>
      </CardContent>
    </Card>
  );
};
