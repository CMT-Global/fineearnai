import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useLanguageSync } from "@/hooks/useLanguageSync";
import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ArrowLeft, Loader2, Wallet } from "lucide-react";
import { toast } from "sonner";
import { PageLoading } from "@/components/shared/PageLoading";

export interface UserTransfersConfig {
  enabled: boolean;
  min_amount?: number;
  max_amount?: number;
}

const DEFAULT_USER_TRANSFERS_CONFIG: UserTransfersConfig = {
  enabled: false,
  min_amount: 1,
  max_amount: 10000,
};

export default function FinanceSettings() {
  const { t } = useTranslation();
  useLanguageSync();
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdmin();
  const navigate = useNavigate();

  const [config, setConfig] = useState<UserTransfersConfig>(DEFAULT_USER_TRANSFERS_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) navigate("/login");
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!adminLoading && !isAdmin && user) {
      toast.error(t("toasts.admin.accessDenied"));
      navigate("/dashboard");
    }
  }, [isAdmin, adminLoading, navigate, user, t]);

  useEffect(() => {
    if (isAdmin) loadConfig();
  }, [isAdmin]);

  const loadConfig = async () => {
    try {
      const { data, error } = await supabase
        .from("platform_config")
        .select("value")
        .eq("key", "user_transfers_config")
        .maybeSingle();

      if (error) throw error;
      const value = data?.value as UserTransfersConfig | null;
      setConfig(value ? { ...DEFAULT_USER_TRANSFERS_CONFIG, ...value } : DEFAULT_USER_TRANSFERS_CONFIG);
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Failed to load settings");
      setConfig(DEFAULT_USER_TRANSFERS_CONFIG);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase.from("platform_config").upsert(
        {
          key: "user_transfers_config",
          value: {
            enabled: config.enabled,
            min_amount: config.min_amount ?? DEFAULT_USER_TRANSFERS_CONFIG.min_amount,
            max_amount: config.max_amount ?? DEFAULT_USER_TRANSFERS_CONFIG.max_amount,
          },
          description: "User-to-user transfers (Deposit Wallet only): enable/disable and limits",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "key" }
      );
      if (error) throw error;
      toast.success(t("admin.financeSettings.saved") ?? "Settings saved");
    } catch (e: any) {
      toast.error(e.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  if (authLoading || adminLoading || loading) {
    return <PageLoading text={t("admin.loading") ?? "Loading..."} />;
  }

  if (!isAdmin) return null;

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold mb-2">
              {t("admin.financeSettings.title") ?? "Finance Settings"}
            </h1>
            <p className="text-muted-foreground">
              {t("admin.financeSettings.description") ?? "Configure finance-related features including user-to-user transfers."}
            </p>
          </div>
          <Button variant="outline" onClick={() => navigate("/admin")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t("admin.back") ?? "Back"}
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5" />
              {t("admin.financeSettings.userTransfers.title") ?? "User-to-User Transfers (Deposit Wallet)"}
            </CardTitle>
            <CardDescription>
              {t("admin.financeSettings.userTransfers.description") ??
                "Allow users to send funds from their Deposit Wallet to another user's Deposit Wallet. When disabled, the feature is hidden and API attempts are blocked."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <Label className="text-base">
                  {t("admin.financeSettings.userTransfers.enableLabel") ?? "Enable User-to-User Transfers"}
                </Label>
                <p className="text-sm text-muted-foreground">
                  {t("admin.financeSettings.userTransfers.enableHint") ?? "Show Send Funds in Wallet and allow transfer API calls."}
                </p>
              </div>
              <Switch
                checked={config.enabled}
                onCheckedChange={(checked) => setConfig((c) => ({ ...c, enabled: checked }))}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="min_amount">
                  {t("admin.financeSettings.userTransfers.minAmount") ?? "Min transfer amount (USD)"}
                </Label>
                <Input
                  id="min_amount"
                  type="number"
                  min={0}
                  step={0.01}
                  value={config.min_amount ?? ""}
                  onChange={(e) =>
                    setConfig((c) => ({
                      ...c,
                      min_amount: e.target.value === "" ? undefined : parseFloat(e.target.value),
                    }))
                  }
                  placeholder="1"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="max_amount">
                  {t("admin.financeSettings.userTransfers.maxAmount") ?? "Max transfer amount (USD)"}
                </Label>
                <Input
                  id="max_amount"
                  type="number"
                  min={0}
                  step={0.01}
                  value={config.max_amount ?? ""}
                  onChange={(e) =>
                    setConfig((c) => ({
                      ...c,
                      max_amount: e.target.value === "" ? undefined : parseFloat(e.target.value),
                    }))
                  }
                  placeholder="10000"
                />
              </div>
            </div>

            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t("admin.saving") ?? "Saving..."}
                </>
              ) : (
                t("admin.save") ?? "Save"
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
