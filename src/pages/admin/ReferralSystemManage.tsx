import { useEffect, useState } from "react";
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
import { ArrowLeft, Save, TrendingUp, Users, DollarSign, Check, X, AlertCircle, Download } from "lucide-react";
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
  useLanguageSync(); // Sync language and force re-render when language changes
  
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdmin();
  const navigate = useNavigate();
  
  const [config, setConfig] = useState<ReferralConfig>({
    signup_bonus_enabled: false,
    signup_bonus_amount: 0,
  });
  const [stats, setStats] = useState<ReferralStats>({
    totalReferrals: 0,
    activeReferrals: 0,
    totalCommissionPaid: 0,
    avgCommissionPerReferral: 0,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testCode, setTestCode] = useState("");
  const [testingCode, setTestingCode] = useState(false);
  const [testResult, setTestResult] = useState<{ valid: boolean; message: string } | null>(null);

  // Load referral configuration
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const { data, error } = await supabase
          .from("referral_program_config")
          .select("*")
          .maybeSingle();

        if (error && error.code !== "PGRST116") {
          throw error;
        }

        if (data) {
          setConfig({
            signup_bonus_enabled: data.signup_bonus_enabled ?? false,
            signup_bonus_amount: data.signup_bonus_amount ?? 0,
          });
        }
      } catch (error: any) {
        console.error("Error loading referral config:", error);
        toast.error(t("admin.referralSystemManage.loadingReferralSystem"));
      }
    };

    // Load platform-wide referral stats
    const loadStats = async () => {
      try {
        // Get total referrals
        const { count: totalReferrals } = await supabase
          .from("referrals")
          .select("*", { count: "exact", head: true });

        // Get active referrals (users active in last 24 hours)
        const { count: activeReferrals } = await supabase
          .from("referrals")
          .select("*, profiles!referrals_referred_id_fkey(last_activity)", { count: "exact", head: true })
          .gt("profiles.last_activity", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

        // Get total commission paid
        const { data: earningsData } = await supabase
          .from("referral_earnings")
          .select("commission_amount");

        const totalCommissionPaid = earningsData?.reduce((sum, e) => sum + (Number(e.commission_amount) || 0), 0) || 0;
        const avgCommissionPerReferral = totalReferrals && totalReferrals > 0 
          ? totalCommissionPaid / totalReferrals 
          : 0;

        setStats({
          totalReferrals: totalReferrals || 0,
          activeReferrals: activeReferrals || 0,
          totalCommissionPaid,
          avgCommissionPerReferral,
        });
      } catch (error: any) {
        console.error("Error loading referral stats:", error);
      }
    };

    const loadData = async () => {
      setLoading(true);
      await Promise.all([loadConfig(), loadStats()]);
      setLoading(false);
    };

    if (user && !authLoading && !adminLoading) {
      if (!isAdmin) {
        navigate("/dashboard");
        return;
      }
      loadData();
    }
  }, [user, authLoading, adminLoading, isAdmin, navigate, t]);

  const handleSave = async () => {
    if (config.signup_bonus_amount < 0) {
      toast.error(t("admin.referralSystemManage.signupBonusAmountHelp"));
      return;
    }

    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke("configure-referral-system", {
        body: {
          signup_bonus_enabled: config.signup_bonus_enabled,
          signup_bonus_amount: config.signup_bonus_amount,
        },
      });

      if (error) throw error;

      if (data?.success) {
        toast.success(t("admin.referralSystemManage.saveConfiguration"));
      } else {
        throw new Error(data?.error || "Failed to save configuration");
      }
    } catch (error: any) {
      console.error("Error saving referral config:", error);
      toast.error(error.message || t("admin.referralSystemManage.saveConfiguration"));
    } finally {
      setSaving(false);
    }
  };

  const handleTestCode = async () => {
    if (!testCode.trim()) {
      toast.error(t("admin.referralSystemManage.enterReferralCode"));
      return;
    }

    setTestingCode(true);
    setTestResult(null);

    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, username, referral_code")
        .eq("referral_code", testCode.trim())
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setTestResult({
          valid: true,
          message: t("admin.referralSystemManage.testReferralCode") + `: ${data.username} (${data.id})`,
        });
        toast.success(t("admin.referralSystemManage.testReferralCode"));
      } else {
        setTestResult({
          valid: false,
          message: t("admin.referralSystemManage.testReferralCode") + ": " + t("admin.referralSystemManage.disabled"),
        });
        toast.error(t("admin.referralSystemManage.testReferralCode"));
      }
    } catch (error: any) {
      console.error("Error testing referral code:", error);
      setTestResult({
        valid: false,
        message: error.message || t("admin.referralSystemManage.testReferralCode"),
      });
      toast.error(error.message);
    } finally {
      setTestingCode(false);
    }
  };

  const handleExportData = async () => {
    try {
      const { data: referrals, error } = await supabase
        .from("referrals")
        .select(`
          id,
          referrer_id,
          referred_id,
          created_at,
          status,
          referrer:profiles!referrals_referrer_id_fkey(username, email),
          referred:profiles!referrals_referred_id_fkey(username, email)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Get commission data
      const { data: earnings, error: earningsError } = await supabase
        .from("referral_earnings")
        .select("*")
        .order("created_at", { ascending: false });

      if (earningsError) throw earningsError;

      // Convert to CSV
      const csvRows = [];
      
      // Headers
      csvRows.push([
        "Referral ID",
        "Referrer Username",
        "Referrer Email",
        "Referred Username",
        "Referred Email",
        "Status",
        "Created At",
        "Total Commission Earned",
      ].join(","));

      // Data rows
      referrals?.forEach((ref: any) => {
        const totalEarnings = earnings
          ?.filter((e: any) => e.referrer_id === ref.referrer_id && e.referred_id === ref.referred_id)
          .reduce((sum, e) => sum + (Number(e.commission_amount) || 0), 0) || 0;

        csvRows.push([
          ref.id,
          ref.referrer?.username || "",
          ref.referrer?.email || "",
          ref.referred?.username || "",
          ref.referred?.email || "",
          ref.status || "",
          ref.created_at || "",
          totalEarnings.toFixed(2),
        ].join(","));
      });

      const csvContent = csvRows.join("\n");
      const blob = new Blob([csvContent], { type: "text/csv" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `referral-data-${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast.success(t("admin.referralSystemManage.exportToCSV"));
    } catch (error: any) {
      console.error("Error exporting referral data:", error);
      toast.error(error.message || t("admin.referralSystemManage.exportToCSV"));
    }
  };

  if (authLoading || adminLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <LoadingSpinner size="lg" text={t("common.loading")} />
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="container mx-auto p-4 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{t("admin.referralSystemManage.title")}</h1>
          <p className="text-muted-foreground mt-1">
            {t("admin.referralSystemManage.subtitle")}
          </p>
        </div>
        <Button variant="outline" onClick={() => navigate("/admin")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t("admin.referralSystemManage.backToAdmin")}
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t("admin.referralSystemManage.totalReferrals")}
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalReferrals}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t("admin.referralSystemManage.activeReferrals")}
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeReferrals}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t("admin.referralSystemManage.totalCommissionPaid")}
            </CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(stats.totalCommissionPaid)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t("admin.referralSystemManage.avgCommissionPerReferral")}
            </CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(stats.avgCommissionPerReferral)}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Commission Configuration */}
        <Card>
          <CardHeader>
            <CardTitle>{t("admin.referralSystemManage.commissionConfiguration")}</CardTitle>
            <CardDescription>
              {t("admin.referralSystemManage.commissionDescription")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
              onClick={() => navigate("/admin/plans")}
              className="w-full"
            >
              {t("admin.referralSystemManage.managePlans")}
            </Button>
          </CardContent>
        </Card>

        {/* Signup Bonus Configuration */}
        <Card>
          <CardHeader>
            <CardTitle>{t("admin.referralSystemManage.signupBonusConfiguration")}</CardTitle>
            <CardDescription>
              {t("admin.referralSystemManage.signupBonusDescription")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="signup-bonus">
                  {t("admin.referralSystemManage.signupBonus")}
                </Label>
                <p className="text-sm text-muted-foreground">
                  {t("admin.referralSystemManage.signupBonusHelp")}
                </p>
              </div>
              <Switch
                id="signup-bonus"
                checked={config.signup_bonus_enabled}
                onCheckedChange={(checked) =>
                  setConfig({ ...config, signup_bonus_enabled: checked })
                }
              />
            </div>

            {config.signup_bonus_enabled && (
              <div className="space-y-2">
                <Label htmlFor="signup-bonus-amount">
                  {t("admin.referralSystemManage.signupBonusAmount")}
                </Label>
                <Input
                  id="signup-bonus-amount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={config.signup_bonus_amount}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      signup_bonus_amount: parseFloat(e.target.value) || 0,
                    })
                  }
                />
                <p className="text-sm text-muted-foreground">
                  {t("admin.referralSystemManage.signupBonusAmountHelp")}
                </p>
              </div>
            )}

            <Button onClick={handleSave} disabled={saving} className="w-full">
              {saving ? (
                <>
                  <LoadingSpinner className="mr-2 h-4 w-4" />
                  {t("admin.referralSystemManage.saving")}
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  {t("admin.referralSystemManage.saveConfiguration")}
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>

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
              onChange={(e) => setTestCode(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleTestCode();
                }
              }}
            />
            <Button onClick={handleTestCode} disabled={testingCode || !testCode.trim()}>
              {testingCode ? (
                <LoadingSpinner className="h-4 w-4" />
              ) : (
                t("admin.referralSystemManage.test")
              )}
            </Button>
          </div>
          {testResult && (
            <Alert variant={testResult.valid ? "default" : "destructive"}>
              {testResult.valid ? (
                <Check className="h-4 w-4" />
              ) : (
                <X className="h-4 w-4" />
              )}
              <AlertTitle>
                {testResult.valid
                  ? t("admin.referralSystemManage.testReferralCode")
                  : t("admin.referralSystemManage.disabled")}
              </AlertTitle>
              <AlertDescription>{testResult.message}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Export Referral Data */}
      <Card>
        <CardHeader>
          <CardTitle>{t("admin.referralSystemManage.exportReferralData")}</CardTitle>
          <CardDescription>
            {t("admin.referralSystemManage.exportReferralDataDescription")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={handleExportData} variant="outline" className="w-full">
            <Download className="mr-2 h-4 w-4" />
            {t("admin.referralSystemManage.exportToCSV")}
          </Button>
        </CardContent>
      </Card>

      {/* System Status */}
      <Card>
        <CardHeader>
          <CardTitle>{t("admin.referralSystemManage.systemStatus")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <span>{t("admin.referralSystemManage.signupBonusStatus")}</span>
            <Badge variant={config.signup_bonus_enabled ? "default" : "secondary"}>
              {config.signup_bonus_enabled ? (
                <Check className="mr-1 h-3 w-3" />
              ) : (
                <X className="mr-1 h-3 w-3" />
              )}
              {config.signup_bonus_enabled
                ? formatCurrency(config.signup_bonus_amount)
                : t("admin.referralSystemManage.disabled")}
            </Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ReferralSystemManage;