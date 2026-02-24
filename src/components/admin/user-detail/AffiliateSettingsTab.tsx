import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useUserManagement } from "@/hooks/useUserManagement";
import { useMembershipPlans } from "@/hooks/useMembershipPlans";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Loader2, Save, UserCheck } from "lucide-react";

const DAY_LABELS: Record<number, string> = {
  0: "Sun",
  1: "Mon",
  2: "Tue",
  3: "Wed",
  4: "Thu",
  5: "Fri",
  6: "Sat",
};

const DEFAULT_WITHDRAWAL_DAYS = [0, 1, 2, 3, 4, 5, 6].map((day) => ({
  day,
  enabled: false,
  start_time: "00:00",
  end_time: "23:59",
}));

interface AffiliateSettingsTabProps {
  userData: any;
  onUserUpdated: () => void;
}

export const AffiliateSettingsTab = ({ userData, onUserUpdated }: AffiliateSettingsTabProps) => {
  const { t } = useTranslation();
  const { updateAffiliateSettings } = useUserManagement();
  const { plans, loading: plansLoading } = useMembershipPlans();

  const as = userData?.affiliate_settings ?? null;
  const [isAffiliate, setIsAffiliate] = useState(!!as?.is_affiliate);
  const [affiliateNameCountry, setAffiliateNameCountry] = useState(as?.affiliate_name_country ?? "");
  const [depositPct, setDepositPct] = useState<string>(as?.deposit_commission_pct != null ? String(as.deposit_commission_pct) : "");
  const [taskPct, setTaskPct] = useState<string>(as?.task_commission_pct != null ? String(as.task_commission_pct) : "");
  const [overrideWithdrawalDays, setOverrideWithdrawalDays] = useState(!!as?.override_withdrawal_days);
  const [withdrawalDays, setWithdrawalDays] = useState<Array<{ day: number; enabled: boolean; start_time: string; end_time: string }>>(
    Array.isArray(as?.withdrawal_days) && as.withdrawal_days.length > 0
      ? [0, 1, 2, 3, 4, 5, 6].map((day) => {
          const d = as.withdrawal_days.find((x: any) => x.day === day);
          return d ? { day: d.day, enabled: !!d.enabled, start_time: d.start_time || "00:00", end_time: d.end_time || "23:59" } : { day, enabled: false, start_time: "00:00", end_time: "23:59" };
        })
      : DEFAULT_WITHDRAWAL_DAYS
  );
  const [affiliatePlan, setAffiliatePlan] = useState<string>(as?.affiliate_membership_plan ?? "");

  useEffect(() => {
    if (!as) return;
    setIsAffiliate(!!as.is_affiliate);
    setAffiliateNameCountry(as.affiliate_name_country ?? "");
    setDepositPct(as.deposit_commission_pct != null ? String(as.deposit_commission_pct) : "");
    setTaskPct(as.task_commission_pct != null ? String(as.task_commission_pct) : "");
    setOverrideWithdrawalDays(!!as.override_withdrawal_days);
    if (Array.isArray(as.withdrawal_days) && as.withdrawal_days.length > 0) {
      setWithdrawalDays(
        [0, 1, 2, 3, 4, 5, 6].map((day) => {
          const d = as.withdrawal_days.find((x: any) => x.day === day);
          return d ? { day: d.day, enabled: !!d.enabled, start_time: d.start_time || "00:00", end_time: d.end_time || "23:59" } : { day, enabled: false, start_time: "00:00", end_time: "23:59" };
        })
      );
    } else {
      setWithdrawalDays(DEFAULT_WITHDRAWAL_DAYS);
    }
    setAffiliatePlan(as.affiliate_membership_plan ?? "");
  }, [as]);

  const toggleDay = (day: number) => {
    setWithdrawalDays((prev) =>
      prev.map((d) => (d.day === day ? { ...d, enabled: !d.enabled } : d))
    );
  };

  const handleSave = () => {
    const userId = userData?.profile?.id;
    if (!userId) return;

    const depositNum = depositPct === "" ? null : parseFloat(depositPct);
    const taskNum = taskPct === "" ? null : parseFloat(taskPct);
    if (depositNum != null && (isNaN(depositNum) || depositNum < 0 || depositNum > 100)) return;
    if (taskNum != null && (isNaN(taskNum) || taskNum < 0 || taskNum > 100)) return;

    const payload = {
      is_affiliate: isAffiliate,
      affiliate_name_country: affiliateNameCountry.trim() || null,
      deposit_commission_pct: depositNum,
      task_commission_pct: taskNum,
      override_withdrawal_days: overrideWithdrawalDays,
      withdrawal_days: overrideWithdrawalDays ? withdrawalDays : null,
      affiliate_membership_plan: affiliatePlan || null,
    };

    updateAffiliateSettings.mutate(
      { userId, affiliateSettings: payload },
      { onSuccess: onUserUpdated }
    );
  };

  const serverWithdrawalDays =
    Array.isArray(as?.withdrawal_days) && as.withdrawal_days.length > 0
      ? [0, 1, 2, 3, 4, 5, 6].map((day) => {
          const d = as.withdrawal_days.find((x: any) => x.day === day);
          return !!d?.enabled;
        })
      : [0, 1, 2, 3, 4, 5, 6].map(() => false);

  const withdrawalDaysChanged = [0, 1, 2, 3, 4, 5, 6].some(
    (day) => (withdrawalDays.find((x) => x.day === day)?.enabled ?? false) !== serverWithdrawalDays[day]
  );

  const hasChanges =
    isAffiliate !== !!as?.is_affiliate ||
    (affiliateNameCountry || "") !== (as?.affiliate_name_country ?? "") ||
    depositPct !== (as?.deposit_commission_pct != null ? String(as.deposit_commission_pct) : "") ||
    taskPct !== (as?.task_commission_pct != null ? String(as.task_commission_pct) : "") ||
    overrideWithdrawalDays !== !!as?.override_withdrawal_days ||
    withdrawalDaysChanged ||
    (affiliatePlan || "") !== (as?.affiliate_membership_plan ?? "");

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserCheck className="h-5 w-5" />
            {t("admin.affiliateSettings.influencerStatus")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="is-affiliate">{t("admin.affiliateSettings.isAffiliate")}</Label>
            <Switch
              id="is-affiliate"
              checked={isAffiliate}
              onCheckedChange={(checked) => {
                setIsAffiliate(checked);
                if (checked) {
                  const name = userData?.profile?.full_name ?? "";
                  const country = userData?.profile?.country ?? "";
                  const autofill = [name, country].filter(Boolean).join(", ");
                  if (autofill) setAffiliateNameCountry(autofill);
                }
              }}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="affiliate-name-country">{t("admin.affiliateSettings.affiliateNameCountry")}</Label>
            <Input
              id="affiliate-name-country"
              value={affiliateNameCountry}
              onChange={(e) => setAffiliateNameCountry(e.target.value)}
              placeholder={t("admin.affiliateSettings.affiliateNameCountryPlaceholder")}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("admin.affiliateSettings.customCommissionRates")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="deposit-pct">{t("admin.affiliateSettings.depositCommissionPct")}</Label>
              <Input
                id="deposit-pct"
                type="number"
                min={0}
                max={100}
                step={0.5}
                value={depositPct}
                onChange={(e) => setDepositPct(e.target.value)}
                placeholder="0"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="task-pct">{t("admin.affiliateSettings.taskCommissionPct")}</Label>
              <Input
                id="task-pct"
                type="number"
                min={0}
                max={100}
                step={0.5}
                value={taskPct}
                onChange={(e) => setTaskPct(e.target.value)}
                placeholder="0"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("admin.affiliateSettings.customWithdrawalOverride")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="override-withdrawal">{t("admin.affiliateSettings.overrideWithdrawalDays")}</Label>
            <Switch id="override-withdrawal" checked={overrideWithdrawalDays} onCheckedChange={setOverrideWithdrawalDays} />
          </div>
          {overrideWithdrawalDays && (
            <div className="space-y-2">
              <Label>{t("admin.affiliateSettings.allowedDays")}</Label>
              <div className="flex flex-wrap gap-2">
                {[0, 1, 2, 3, 4, 5, 6].map((day) => {
                  const d = withdrawalDays.find((x) => x.day === day);
                  const enabled = d?.enabled ?? false;
                  return (
                    <Badge
                      key={day}
                      variant={enabled ? "default" : "outline"}
                      className="cursor-pointer"
                      onClick={() => toggleDay(day)}
                    >
                      {DAY_LABELS[day]}
                    </Badge>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("admin.affiliateSettings.optionalPlan")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Label htmlFor="affiliate-plan">{t("admin.affiliateSettings.assignPlanWhenEnabling")}</Label>
          <Select value={affiliatePlan || "none"} onValueChange={(v) => setAffiliatePlan(v === "none" ? "" : v)} disabled={plansLoading}>
            <SelectTrigger id="affiliate-plan">
              <SelectValue placeholder={t("admin.affiliateSettings.selectPlan")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">{t("admin.affiliateSettings.noPlan")}</SelectItem>
              {plans?.map((p) => (
                <SelectItem key={p.name} value={p.name}>
                  {p.display_name || p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={updateAffiliateSettings.isPending || !hasChanges}>
          {updateAffiliateSettings.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
          {t("admin.affiliateSettings.save")}
        </Button>
      </div>
    </div>
  );
};
