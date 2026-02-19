import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ChevronDown, ChevronUp, TrendingUp } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { CurrencyDisplay } from "@/components/ui/CurrencyDisplay";

interface ReferralCommissionBreakdownProps {
  earnedTaskCommissions: number;
}

export function ReferralCommissionBreakdown({ earnedTaskCommissions }: ReferralCommissionBreakdownProps) {
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
              <TrendingUp className="h-5 w-5 shrink-0 text-primary" />
              {t("referrals.analytics.commissionBreakdown.title")}
            </span>
            <span className="flex items-center gap-1.5 text-sm font-medium text-primary">
              {open ? t("referrals.analytics.collapsibleClose") : t("referrals.analytics.collapsibleOpen")}
              {open ? <ChevronUp className="h-4 w-4 shrink-0" /> : <ChevronDown className="h-4 w-4 shrink-0" />}
            </span>
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="px-4 pb-4 pt-0 sm:px-6 sm:pb-6 border-t border-border/50">
            <div className="pt-4 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">{t("referrals.analytics.commissionBreakdown.earned")}</span>
                <span className="font-semibold text-[hsl(var(--wallet-earnings))]">
                  <CurrencyDisplay amountUSD={earnedTaskCommissions} />
                </span>
              </div>
            </div>
          </div>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
