import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ChevronDown, ChevronUp, Users } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { CurrencyDisplay } from "@/components/ui/CurrencyDisplay";
import type { ReferralAnalyticsTopContributor } from "@/hooks/useReferralAnalytics";

interface ReferralTopContributorsProps {
  topContributors: ReferralAnalyticsTopContributor[];
}

export function ReferralTopContributors({ topContributors }: ReferralTopContributorsProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card className="overflow-hidden border-muted bg-muted/30">
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            className="w-full justify-between gap-2 px-4 py-4 sm:px-6 sm:py-5 h-auto rounded-none hover:bg-muted/50 hover:text-foreground text-foreground text-left"
            aria-expanded={open}
          >
            <span className="flex items-center gap-2 font-semibold text-base sm:text-lg text-foreground">
              <Users className="h-5 w-5 shrink-0 text-primary" />
              {t("referrals.analytics.topContributors.title")}
            </span>
            <span className="flex items-center gap-1.5 text-sm font-medium text-primary">
              {open ? t("referrals.analytics.collapsibleClose") : t("referrals.analytics.collapsibleOpen")}
              {open ? <ChevronUp className="h-4 w-4 shrink-0" /> : <ChevronDown className="h-4 w-4 shrink-0" />}
            </span>
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="px-4 pb-4 pt-0 sm:px-6 sm:pb-6 border-t border-border/50">
            {topContributors.length === 0 ? (
              <p className="py-4 text-sm text-muted-foreground">{t("referrals.analytics.topContributors.noData")}</p>
            ) : (
              <div className="overflow-x-auto pt-4">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="py-2 pr-4 font-medium">{t("referrals.analytics.topContributors.member")}</th>
                      <th className="py-2 pr-4 font-medium">{t("referrals.analytics.topContributors.tasksCompleted")}</th>
                      <th className="py-2 pr-4 font-medium">{t("referrals.analytics.topContributors.theirEarnings")}</th>
                      <th className="py-2 font-medium">{t("referrals.analytics.topContributors.yourCommission")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topContributors.map((c) => (
                      <tr key={c.referred_id} className="border-b last:border-0">
                        <td className="py-3 pr-4 font-medium">{c.masked_display_name}</td>
                        <td className="py-3 pr-4">{c.tasks_count}</td>
                        <td className="py-3 pr-4"><CurrencyDisplay amountUSD={c.their_earnings} /></td>
                        <td className="py-3 text-[hsl(var(--wallet-earnings))] font-medium">
                          <CurrencyDisplay amountUSD={c.your_commission} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
