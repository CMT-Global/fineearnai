import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabaseService } from "@/integrations/supabase";
import { TrendingUp, AlertCircle, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

interface CommissionStructureCardProps {
  userPlan: string;
  /** When provided (e.g. for affiliates), used instead of loading from plan */
  effectiveRates?: { taskCommissionRate: number; depositCommissionRate: number };
  /** Show "Affiliate Account" and treat as eligible even on free plan */
  isAffiliate?: boolean;
}

interface PlanCommissions {
  taskCommissionRate: number;
  depositCommissionRate: number;
}

export const CommissionStructureCard = ({ userPlan, effectiveRates, isAffiliate }: CommissionStructureCardProps) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [commissions, setCommissions] = useState<PlanCommissions | null>(null);
  const [loading, setLoading] = useState(!effectiveRates);

  useEffect(() => {
    if (effectiveRates) {
      setCommissions(effectiveRates);
      setIsEligible(true);
      setLoading(false);
      return;
    }
    loadCommissionRates();
  }, [userPlan, effectiveRates]);

  const [isEligible, setIsEligible] = useState<boolean>(!!isAffiliate);

  const loadCommissionRates = async () => {
    if (effectiveRates) return;
    try {
      let data = userPlan
        ? await supabaseService.membershipPlans.getByName(userPlan)
        : null;
      if (!data) {
        data = await supabaseService.membershipPlans.getDefaultPlan();
      }

      if (data) {
        setCommissions({
          taskCommissionRate: Number(data.task_commission_rate),
          depositCommissionRate: Number(data.deposit_commission_rate),
        });
        setIsEligible(isAffiliate || String(data.account_type || "").toLowerCase() !== "free");
      }
    } catch (error) {
      console.error("Error loading commission rates:", error);
      toast.error(t("toasts.referrals.failedToLoadCommissionRates"));
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card className="p-6">
        <p className="text-sm text-muted-foreground">Loading commission structure...</p>
      </Card>
    );
  }

  const eligible = isEligible || isAffiliate;

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          <h3 className="font-semibold">{t("referrals.yourCommissionStructure")}</h3>
        </div>
        {isAffiliate && (
          <span className="text-xs font-medium px-2 py-0.5 rounded bg-primary/20 text-primary">
            {t("referrals.affiliateAccount")}
          </span>
        )}
      </div>

      {!eligible ? (
        <div className="space-y-4">
          <div className="p-4 bg-orange-500/10 dark:bg-orange-500/20 border border-orange-500/30 dark:border-orange-500/30 rounded-lg">
            <div className="flex gap-2">
              <AlertCircle className="h-5 w-5 text-orange-500 dark:text-orange-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-foreground mb-1">
                  {t("referrals.referralIncomeNotAvailable")}
                </p>
                <p className="text-sm text-foreground/80">
                  You need to upgrade your account to start earning commissions.
                </p>
              </div>
            </div>
          </div>

          <Button 
            onClick={() => navigate("/plans")}
            className="w-full gap-2"
          >
            {t("referrals.upgradeToStartEarning")}
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 border rounded-lg bg-blue-500/10 dark:bg-blue-500/20 border-blue-500/30 dark:border-blue-500/30">
              <p className="text-sm text-foreground mb-1">Task Commission</p>
              <p className="text-2xl font-bold text-blue-500 dark:text-blue-400">
                {(commissions?.taskCommissionRate != null ? commissions.taskCommissionRate * 100 : 0).toFixed(1)}%
              </p>
              <p className="text-xs text-foreground/80 mt-1">
                Earn from every task your referrals complete
              </p>
            </div>

            {commissions && Number(commissions.depositCommissionRate) > 0 && (
              <div className="p-4 border rounded-lg bg-green-500/10 dark:bg-green-500/20 border-green-500/30 dark:border-green-500/30">
                <p className="text-sm text-foreground mb-1">Deposit Commission</p>
                <p className="text-2xl font-bold text-green-500 dark:text-green-400">
                  {(commissions.depositCommissionRate * 100).toFixed(1)}%
                </p>
                <p className="text-xs text-foreground/80 mt-1">
                  Earn when referrals upgrade their plans
                </p>
              </div>
            )}
          </div>

          <div className="p-4 bg-accent/30 dark:bg-accent/20 border border-border rounded-lg">
            <p className="text-sm font-medium mb-2 text-foreground">
              {isAffiliate ? t("referrals.affiliateRates") : `Current Plan: ${(userPlan || "").toUpperCase()}`}
            </p>
            <p className="text-xs text-foreground/80">
              Upgrade to a higher tier plan to unlock better commission rates and more active referral slots.
            </p>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => navigate("/plans")}
              className="mt-3 gap-2"
            >
              View Plans
              <ArrowRight className="h-3 w-3" />
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
};
