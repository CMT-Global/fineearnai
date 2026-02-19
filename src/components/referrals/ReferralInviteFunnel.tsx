import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTranslation } from "react-i18next";
import { UserPlus, ArrowRight, Percent } from "lucide-react";

interface ReferralInviteFunnelProps {
  signupsFromLink: number;
  upgradedCount: number;
  conversionRate: number;
}

export function ReferralInviteFunnel({
  signupsFromLink,
  upgradedCount,
  conversionRate,
}: ReferralInviteFunnelProps) {
  const { t } = useTranslation();
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{t("referrals.analytics.funnel.title")}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap items-center gap-4 sm:gap-6">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-lg bg-[hsl(var(--wallet-referrals))]/10 flex items-center justify-center">
              <UserPlus className="h-4 w-4 text-[hsl(var(--wallet-referrals))]" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t("referrals.analytics.funnel.signupsFromLink")}</p>
              <p className="text-lg font-semibold">{signupsFromLink}</p>
            </div>
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-lg bg-[hsl(var(--wallet-earnings))]/10 flex items-center justify-center">
              <UserPlus className="h-4 w-4 text-[hsl(var(--wallet-earnings))]" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t("referrals.analytics.funnel.upgradedMembers")}</p>
              <p className="text-lg font-semibold">{upgradedCount}</p>
            </div>
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center">
              <Percent className="h-4 w-4 text-muted-foreground" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t("referrals.analytics.funnel.conversionRate")}</p>
              <p className="text-lg font-semibold">{signupsFromLink > 0 ? `${Number(conversionRate).toFixed(1)}%` : "—"}</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
