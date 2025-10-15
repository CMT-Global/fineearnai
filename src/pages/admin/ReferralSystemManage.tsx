import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
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
      toast.error("Access denied. Admin privileges required.");
      navigate("/dashboard");
    }
  }, [isAdmin, adminLoading, navigate]);

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
      toast.error("Failed to load referral system configuration");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!config) return;

    // Validation
    if (config.signup_bonus_enabled && config.signup_bonus_amount < 0) {
      toast.error("Signup bonus amount must be non-negative");
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

      toast.success("Referral system configuration updated successfully");
      loadData();
    } catch (error: any) {
      console.error("Error saving configuration:", error);
      toast.error(error.message || "Failed to save configuration");
    } finally {
      setSaving(false);
    }
  };

  const handleTestReferralCode = async () => {
    if (!testCode.trim()) {
      toast.error("Please enter a referral code to test");
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
          message: "Referral code not found",
        });
      } else if (data.account_status !== "active") {
        setTestResult({
          valid: false,
          message: `Code belongs to ${data.username} but account is ${data.account_status}`,
        });
      } else {
        setTestResult({
          valid: true,
          message: `Valid! Code belongs to active user: ${data.username}`,
        });
      }
    } catch (error: any) {
      console.error("Error testing code:", error);
      toast.error("Failed to test referral code");
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

      toast.success("Referral data exported successfully");
    } catch (error: any) {
      console.error("Error exporting data:", error);
      toast.error("Failed to export referral data");
    }
  };

  if (authLoading || adminLoading || loading) {
    return (
      <div className="min-h-screen bg-[hsl(0,0%,98%)] flex items-center justify-center">
        <LoadingSpinner size="lg" text="Loading referral system..." />
      </div>
    );
  }

  if (!config) {
    return (
      <div className="min-h-screen bg-[hsl(0,0%,98%)] flex items-center justify-center">
        <p>No referral configuration found</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[hsl(0,0%,98%)]">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <Button variant="ghost" onClick={() => navigate("/admin")} className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Admin
          </Button>

          <h1 className="text-3xl font-bold mb-2">Referral System Management</h1>
          <p className="text-muted-foreground">
            Configure signup bonuses and monitor referral program performance
          </p>
        </div>

        {/* Informational Alert */}
        <Alert className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Commission Configuration</AlertTitle>
          <AlertDescription className="flex items-center justify-between">
            <span>
              Referral commission rates (task commission and deposit commission) are configured per membership plan.
            </span>
            <Button 
              variant="link" 
              className="h-auto p-0 ml-4"
              onClick={() => navigate('/admin/plans/manage')}
            >
              Manage Plans →
            </Button>
          </AlertDescription>
        </Alert>

        {/* Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Referrals
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
                Active Referrals
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
                Total Commission Paid
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
                Avg Commission/Referral
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
              <CardTitle>Signup Bonus Configuration</CardTitle>
              <CardDescription>
                Configure bonus rewards for new user signups
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Signup Bonus */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-base font-semibold">Signup Bonus</Label>
                    <p className="text-sm text-muted-foreground">Give bonus to new users who sign up with a referral code</p>
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
                    <Label>Signup Bonus Amount ($)</Label>
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
                      Amount credited to new user's account upon signup
                    </p>
                  </div>
                )}
              </div>

              <Button onClick={handleSave} disabled={saving} className="w-full">
                <Save className="mr-2 h-4 w-4" />
                {saving ? "Saving..." : "Save Configuration"}
              </Button>
            </CardContent>
          </Card>

          {/* Tools */}
          <div className="space-y-6">
            {/* Test Referral Code */}
            <Card>
              <CardHeader>
                <CardTitle>Test Referral Code</CardTitle>
                <CardDescription>
                  Validate if a referral code exists and is active
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    placeholder="Enter referral code"
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
                  <Button onClick={handleTestReferralCode}>Test</Button>
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
                <CardTitle>Export Referral Data</CardTitle>
                <CardDescription>
                  Download all referral relationships and commissions as CSV
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button onClick={handleExportData} variant="outline" className="w-full">
                  Export to CSV
                </Button>
              </CardContent>
            </Card>

            {/* Quick Stats */}
            <Card>
              <CardHeader>
                <CardTitle>System Status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between py-2">
                  <span className="text-sm text-muted-foreground">Signup Bonus</span>
                  <Badge variant={config.signup_bonus_enabled ? "default" : "secondary"}>
                    {config.signup_bonus_enabled ? `$${config.signup_bonus_amount}` : "Disabled"}
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
