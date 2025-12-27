import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Save, TrendingUp, Users, DollarSign, Check, X, AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "sonner";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { formatCurrency } from "@/lib/wallet-utils";
import { Badge } from "@/components/ui/badge";

interface ReferralConfig {
  signup_bonus_enabled: boolean;
  signup_bonus_amount: number;
}

interface ReferralStats {
  totalReferrals: number;
  activeReferrals: number;
  totalCommissionPaid: number;
  avgCommissionPerReferral: number;
}

const ReferralSystemManage = () => {
  const { t } = useTranslation();
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdmin();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<ReferralConfig | null>(null);
  const [stats, setStats] = useState<ReferralStats | null>(null);
  const [testCode, setTestCode] = useState("");
  const [testResult, setTestResult] = useState<{ valid: boolean; message: string } | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/login");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!adminLoading && !isAdmin) {
      toast.error(t("toasts.admin.accessDenied"));
      navigate("/dashboard");
    }
  }, [isAdmin, adminLoading, navigate, t]);

  useEffect(() => {
    if (isAdmin) {
      loadData();
    }
  }, [isAdmin]);

  const loadData = async () => {
    try {
      setLoading(true);

      // Load referral configuration
      const { data: configData, error: configError } = await supabase
        .from("referral_program_config")
        .select("*")
        .limit(1)
        .single();

      if (configError) throw configError;
      setConfig(configData);

      // Load referral statistics
      const { data: referralsData } = await supabase
        .from("referrals")
        .select("id, status, total_commission_earned");

      const { data: earningsData } = await supabase
        .from("referral_earnings")
        .select("commission_amount");

      const totalReferrals = referralsData?.length || 0;
      const activeReferrals = referralsData?.filter(r => r.status === 'active').length || 0;
      const totalCommissionPaid = earningsData?.reduce((sum, e) => sum + Number(e.commission_amount), 0) || 0;
      const avgCommissionPerReferral = totalReferrals > 0 ? totalCommissionPaid / totalReferrals : 0;

      setStats({
        totalReferrals,
        activeReferrals,
        totalCommissionPaid,
        avgCommissionPerReferral,
      });
    } catch (error: any) {
      console.error("Error loading data:", error);
      toast.error(t("toasts.admin.failedToLoadReferralSystemConfig"));
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!config) return;

    // Validation
    if (config.signup_bonus_enabled && config.signup_bonus_amount < 0) {
      toast.error(t("toasts.admin.signupBonusAmountMustBeNonNegative"));
      return;
    }

    try {
      setSaving(true);

      const { data, error } = await supabase.functions.invoke("configure-referral-system", {
        body: {
          signup_bonus_enabled: config.signup_bonus_enabled,
          signup_bonus_amount: config.signup_bonus_amount,
        },
      });

      if (error) throw error;

      toast.success(t("toasts.admin.referralSystemConfigUpdated"));
      loadData();
    } catch (error: any) {
      console.error("Error saving configuration:", error);
      toast.error(error.message || t("toasts.admin.failedToSaveConfig"));
    } finally {
      setSaving(false);
    }
  };

  const handleTestReferralCode = async () => {
    if (!testCode.trim()) {
      toast.error(t("toasts.admin.pleaseEnterReferralCode"));
      return;
    }

    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, username, referral_code, account_status")
        .eq("referral_code", testCode.trim().toUpperCase())
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        setTestResult({
          valid: false,
          message: t("toasts.admin.referralCodeNotFound"),
        });
      } else if (data.account_status !== "active") {
        setTestResult({
          valid: false,
          message: t("toasts.admin.referralCodeInactive", { username: data.username, status: data.account_status }),
        });
      } else {
        setTestResult({
          valid: true,
          message: t("toasts.admin.referralCodeValid", { username: data.username }),
        });
      }
    } catch (error: any) {
      console.error("Error testing code:", error);
      toast.error(t("toasts.admin.failedToTestReferralCode"));
    }
  };

  const handleExportData = async () => {
    try {
      // Get all referrals
      const { data: referralsData, error: referralsError } = await supabase
        .from("referrals")
        .select("*")
        .order("created_at", { ascending: false });

      if (referralsError) throw referralsError;

      // Get referrer profiles
      const referrerIds = [...new Set(referralsData?.map(r => r.referrer_id) || [])];
      const { data: referrerProfiles } = await supabase
        .from("profiles")
        .select("id, username, email")
        .in("id", referrerIds);

      // Get referred profiles
      const referredIds = [...new Set(referralsData?.map(r => r.referred_id) || [])];
      const { data: referredProfiles } = await supabase
        .from("profiles")
        .select("id, username, email, membership_plan")
        .in("id", referredIds);

      // Create maps for quick lookup
      const referrerMap = new Map(referrerProfiles?.map(p => [p.id, p]) || []);
      const referredMap = new Map(referredProfiles?.map(p => [p.id, p]) || []);

      // Convert to CSV
      const headers = ["Referrer Username", "Referrer Email", "Referred Username", "Referred Email", "Membership Plan", "Status", "Total Commission", "Created At"];
      const rows = referralsData?.map(r => {
        const referrer = referrerMap.get(r.referrer_id);
        const referred = referredMap.get(r.referred_id);
        return [
          referrer?.username || "N/A",
          referrer?.email || "N/A",
          referred?.username || "N/A",
          referred?.email || "N/A",
          referred?.membership_plan || "N/A",
          r.status,
          r.total_commission_earned,
          new Date(r.created_at).toLocaleDateString(),
        ];
      }) || [];

      const csvContent = [
        headers.join(","),
        ...rows.map(row => row.join(","))
      ].join("\n");

      // Download file
      const blob = new Blob([csvContent], { type: "text/csv" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `referral-data-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);

      toast.success(t("toasts.admin.referralDataExported"));
    } catch (error: any) {
      console.error("Error exporting data:", error);
      toast.error(t("toasts.admin.failedToExportReferralData"));
    }
  };

  if (authLoading || adminLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <LoadingSpinner size="lg" text={t("admin.referralSystemManage.loadingReferralSystem")} />
      </div>
    );
  }

  if (!config) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p>{t("admin.referralSystemManage.noReferralConfigurationFound")}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <Button variant="ghost" onClick={() => navigate("/admin")} className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t("admin.referralSystemManage.backToAdmin")}
          </Button>

          <h1 className="text-3xl font-bold mb-2">{t("admin.referralSystemManage.title")}</h1>
          <p className="text-muted-foreground">
            {t("admin.referralSystemManage.subtitle")}
          </p>
        </div>

        {/* Informational Alert */}
        <Alert className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>{t("admin.referralSystemManage.commissionConfiguration")}</AlertTitle>
          <AlertDescription className="flex items-center justify-between">
            <span>
              {t("admin.referralSystemManage.commissionDescription")}
            </span>
            <Button 
              variant="link" 
              className="h-auto p-0 ml-4"
              onClick={() => navigate('/admin/plans/manage')}
            >
              {t("admin.referralSystemManage.managePlans")}
            </Button>
          </AlertDescription>
        </Alert>

        {/* Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {t("admin.referralSystemManage.totalReferrals")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="text-2xl font-bold">{stats?.totalReferrals || 0}</div>
                <Users className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {t("admin.referralSystemManage.activeReferrals")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="text-2xl font-bold">{stats?.activeReferrals || 0}</div>
                <TrendingUp className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {t("admin.referralSystemManage.totalCommissionPaid")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="text-2xl font-bold">
                  {formatCurrency(stats?.totalCommissionPaid || 0)}
                </div>
                <DollarSign className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {t("admin.referralSystemManage.avgCommissionPerReferral")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatCurrency(stats?.avgCommissionPerReferral || 0)}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Configuration */}
          <Card>
            <CardHeader>
              <CardTitle>{t("admin.referralSystemManage.signupBonusConfiguration")}</CardTitle>
              <CardDescription>
                {t("admin.referralSystemManage.signupBonusDescription")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Signup Bonus */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-base font-semibold">{t("admin.referralSystemManage.signupBonus")}</Label>
                    <p className="text-sm text-muted-foreground">{t("admin.referralSystemManage.signupBonusHelp")}</p>
                  </div>
                  <Switch
                    checked={config.signup_bonus_enabled}
                    onCheckedChange={(checked) =>
                      setConfig({ ...config, signup_bonus_enabled: checked })
                    }
                  />
                </div>

                {config.signup_bonus_enabled && (
                  <div>
                    <Label>{t("admin.referralSystemManage.signupBonusAmount")}</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={config.signup_bonus_amount}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          signup_bonus_amount: parseFloat(e.target.value) || 0,
                        })
                      }
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      {t("admin.referralSystemManage.signupBonusAmountHelp")}
                    </p>
                  </div>
                )}
              </div>

              <Button onClick={handleSave} disabled={saving} className="w-full">
                <Save className="mr-2 h-4 w-4" />
                {saving ? t("common.saving") : t("admin.referralSystemManage.saveConfiguration")}
              </Button>
            </CardContent>
          </Card>

          {/* Tools */}
          <div className="space-y-6">
            {/* Test Referral Code */}
            <Card>
              <CardHeader>
                <CardTitle>{t("admin.referralSystemManage.testReferralCode")}</CardTitle>
                <CardDescription>
                  {t("admin.referralSystemManage.testReferralCodeDescription")}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    placeholder={t("admin.referralSystemManage.enterReferralCode")}
                    value={testCode}
                    onChange={(e) => {
                      setTestCode(e.target.value.toUpperCase());
                      setTestResult(null);
                    }}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        handleTestReferralCode();
                      }
                    }}
                  />
                  <Button onClick={handleTestReferralCode}>{t("admin.referralSystemManage.test")}</Button>
                </div>

                {testResult && (
                  <div
                    className={`p-4 rounded-lg border ${
                      testResult.valid
                        ? "bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-900"
                        : "bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-900"
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      {testResult.valid ? (
                        <Check className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                      ) : (
                        <X className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                      )}
                      <p className="text-sm">{testResult.message}</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Export Data */}
            <Card>
              <CardHeader>
                <CardTitle>{t("admin.referralSystemManage.exportReferralData")}</CardTitle>
                <CardDescription>
                  {t("admin.referralSystemManage.exportReferralDataDescription")}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button onClick={handleExportData} variant="outline" className="w-full">
                  {t("admin.referralSystemManage.exportToCSV")}
                </Button>
              </CardContent>
            </Card>

            {/* Quick Stats */}
            <Card>
              <CardHeader>
                <CardTitle>{t("admin.referralSystemManage.systemStatus")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between py-2">
                  <span className="text-sm text-muted-foreground">{t("admin.referralSystemManage.signupBonusStatus")}</span>
                  <Badge variant={config.signup_bonus_enabled ? "default" : "secondary"}>
                    {config.signup_bonus_enabled ? `$${config.signup_bonus_amount}` : t("admin.referralSystemManage.disabled")}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReferralSystemManage;
