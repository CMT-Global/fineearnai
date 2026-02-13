import { Card } from "@/components/ui/card";
import { Users, TrendingUp, DollarSign, UserPlus } from "lucide-react";
import { CurrencyDisplay } from "@/components/ui/CurrencyDisplay";
import { useTranslation } from "react-i18next";

interface ReferralStatsCardProps {
  totalReferrals: number;
  activeReferrals: number;
  totalEarnings: number;
  taskCommissionEarnings: number;
}

export const ReferralStatsCard = ({
  totalReferrals,
  activeReferrals,
  totalEarnings,
  taskCommissionEarnings,
}: ReferralStatsCardProps) => {
  const { t } = useTranslation();
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <Card className="p-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-[hsl(var(--wallet-referrals))]/10 flex items-center justify-center">
            <Users className="h-5 w-5 text-[hsl(var(--wallet-referrals))]" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">{t("referrals.totalTeamMembers")}</p>
            <p className="text-2xl font-bold">{totalReferrals}</p>
          </div>
        </div>
      </Card>

      <Card className="p-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-[hsl(var(--wallet-tasks))]/10 flex items-center justify-center">
            <UserPlus className="h-5 w-5 text-[hsl(var(--wallet-tasks))]" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">{t("referrals.activeTeamMembersToday")}</p>
            <p className="text-2xl font-bold">{activeReferrals}</p>
          </div>
        </div>
      </Card>

      <Card className="p-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-[hsl(var(--wallet-earnings))]/10 flex items-center justify-center">
            <DollarSign className="h-5 w-5 text-[hsl(var(--wallet-earnings))]" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">{t("referrals.totalTeamEarnings")}</p>
            <p className="text-2xl font-bold"><CurrencyDisplay amountUSD={totalEarnings} /></p>
          </div>
        </div>
      </Card>

      <Card className="p-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-[hsl(var(--wallet-deposit))]/10 flex items-center justify-center">
            <TrendingUp className="h-5 w-5 text-[hsl(var(--wallet-deposit))]" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">{t("referrals.teamTaskCommissions")}</p>
            <p className="text-2xl font-bold"><CurrencyDisplay amountUSD={taskCommissionEarnings} /></p>
          </div>
        </div>
      </Card>
    </div>
  );
};
