import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { useLanguageSync } from "@/hooks/useLanguageSync";
import { Trash2, Plus, Shield, Globe, Ban, Crown, Activity, Clock, AlertTriangle, MessageSquare, Eye, Save, RotateCcw } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Separator } from "@/components/ui/separator";
import { useBranding } from "@/contexts/BrandingContext";

export default function SecuritySettings() {
  const { t } = useTranslation();
  useLanguageSync(); // Sync language and force re-render when language changes
  
  const queryClient = useQueryClient();
  const { platformName } = useBranding();
  
  // Banner state variables
  const [bannerEnabled, setBannerEnabled] = useState(true);
  const [bannerDismissible, setBannerDismissible] = useState(true);
  const [bannerTitle, setBannerTitle] = useState("");
  const [bannerSubtitle, setBannerSubtitle] = useState("");
  const [bannerStep1, setBannerStep1] = useState("");
  const [bannerStep2, setBannerStep2] = useState("");
  const [bannerStep3, setBannerStep3] = useState("");
  const [bannerCutoffDate, setBannerCutoffDate] = useState("2025-11-01");
  const [bannerSupportLink, setBannerSupportLink] = useState("/settings");
  const [showPreview, setShowPreview] = useState(false);
  
  // Country and IP blocking state
  const [enableCountryBlocking, setEnableCountryBlocking] = useState(false);
  const [blockedCountries, setBlockedCountries] = useState<string[]>([]);
  const [newCountry, setNewCountry] = useState("");
  const [enableIPBlocking, setEnableIPBlocking] = useState(false);
  const [blockedIPs, setBlockedIPs] = useState<string[]>([]);
  const [newIP, setNewIP] = useState("");
  
  // Fetch banner config
  const { data: bannerConfig, isLoading: isLoadingBanner } = useQuery({
    queryKey: ['migration-banner-config-admin'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("platform_config")
        .select("value")
        .eq("key", "migration_banner")
        .maybeSingle();

      if (error) throw error;
      return data?.value || null;
    },
  });

  // Initialize state from config when it loads
  useEffect(() => {
    if (bannerConfig) {
      setBannerEnabled(bannerConfig.enabled ?? true);
      setBannerDismissible(bannerConfig.dismissible ?? true);
      setBannerTitle(bannerConfig.message?.title ?? "");
      setBannerSubtitle(bannerConfig.message?.subtitle ?? "");
      setBannerStep1(bannerConfig.message?.steps?.[0] ?? "");
      setBannerStep2(bannerConfig.message?.steps?.[1] ?? "");
      setBannerStep3(bannerConfig.message?.steps?.[2] ?? "");
      setBannerCutoffDate(bannerConfig.cutoff_date ?? "2025-11-01");
      setBannerSupportLink(bannerConfig.support_link ?? "/settings");
    }
  }, [bannerConfig]);
  
  // Mutation to save banner config
  const saveBannerMutation = useMutation({
    mutationFn: async () => {
      const newConfig = {
        enabled: bannerEnabled,
        dismissible: bannerDismissible,
        display_priority: "high",
        cutoff_date: bannerCutoffDate,
        support_link: bannerSupportLink,
        message: {
          title: bannerTitle,
          subtitle: bannerSubtitle,
          steps: [bannerStep1, bannerStep2, bannerStep3]
        }
      };
      
      const { error } = await supabase
        .from("platform_config")
        .update({ 
          value: newConfig,
          updated_at: new Date().toISOString()
        })
        .eq("key", "migration_banner");

      if (error) throw error;
      
      return newConfig;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['migration-banner-config-admin'] });
      queryClient.invalidateQueries({ queryKey: ['migration-banner-config'] });
      toast.success(t("admin.toasts.migrationBannerSaved"));
    },
    onError: (error: any) => {
      toast.error(`Failed to save banner settings: ${error.message}`);
    },
  });
  
  const handleSaveBanner = () => {
    if (!bannerTitle.trim() || !bannerSubtitle.trim()) {
      toast.error(t("admin.toasts.titleAndSubtitleRequired"));
      return;
    }
    if (!bannerStep1.trim() || !bannerStep2.trim() || !bannerStep3.trim()) {
      toast.error(t("admin.toasts.allThreeStepsRequired"));
      return;
    }
    saveBannerMutation.mutate();
  };
  
  const handleResetBanner = () => {
    if (bannerConfig) {
      setBannerEnabled(bannerConfig.enabled ?? true);
      setBannerDismissible(bannerConfig.dismissible ?? true);
      setBannerTitle(bannerConfig.message?.title ?? "");
      setBannerSubtitle(bannerConfig.message?.subtitle ?? "");
      setBannerStep1(bannerConfig.message?.steps?.[0] ?? "");
      setBannerStep2(bannerConfig.message?.steps?.[1] ?? "");
      setBannerStep3(bannerConfig.message?.steps?.[2] ?? "");
      setBannerCutoffDate(bannerConfig.cutoff_date ?? "2025-11-01");
      setBannerSupportLink(bannerConfig.support_link ?? "/settings");
      toast.info(t("admin.toasts.bannerSettingsReset"));
    }
  };

  // Fetch withdrawal bypass audit logs
  const { data: bypassAuditLogs, isLoading: isLoadingAudit } = useQuery({
    queryKey: ['withdrawal-bypass-audit'],
    queryFn: async () => {
      // Fetch all profile_update audit logs (we'll filter in JavaScript)
      const { data: allAuditLogs, error: auditError } = await supabase
        .from('audit_logs')
        .select(`
          id,
          created_at,
          admin_id,
          target_user_id,
          details
        `)
        .eq('action_type', 'profile_update')
        .order('created_at', { ascending: false })
        .limit(200); // Fetch more to account for filtering

      if (auditError) throw auditError;
      if (!allAuditLogs || allAuditLogs.length === 0) return [];

      // Filter logs that have withdrawal_bypass_changed in details
      const auditLogs = allAuditLogs.filter(log => {
        if (!log.details) return false;
        const detailsStr = JSON.stringify(log.details);
        return detailsStr.includes('withdrawal_bypass_changed');
      }).slice(0, 50); // Limit to 50 after filtering

      if (auditLogs.length === 0) return [];

      // Then fetch user profiles for the target_user_ids
      const userIds = auditLogs
        .map(log => log.target_user_id)
        .filter((id): id is string => id !== null);

      if (userIds.length === 0) return auditLogs;

      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, username, email')
        .in('id', userIds);

      if (profilesError) throw profilesError;

      // Combine the data
      return auditLogs.map(log => ({
        ...log,
        profiles: profiles?.find(p => p.id === log.target_user_id) || null
      }));
    },
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  // Fetch users with bypass enabled
  const { data: bypassUsers, isLoading: isLoadingUsers } = useQuery({
    queryKey: ['users-with-bypass'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, email, membership_plan, allow_daily_withdrawals, created_at')
        .eq('allow_daily_withdrawals', true)
        .order('username', { ascending: true });

      if (error) throw error;
      return data;
    },
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  const handleAddCountry = () => {
    if (!newCountry.trim()) {
      toast.error(t("admin.toasts.pleaseEnterCountryCode"));
      return;
    }
    const countryCode = newCountry.trim().toUpperCase();
    if (countryCode.length !== 2) {
      toast.error(t("admin.toasts.countryCodeMustBe2Chars"));
      return;
    }
    if (blockedCountries.includes(countryCode)) {
      toast.error(t("admin.toasts.countryAlreadyBlocked"));
      return;
    }
    setBlockedCountries([...blockedCountries, countryCode]);
    setNewCountry("");
    toast.success(`Country ${countryCode} blocked`);
  };

  const handleRemoveCountry = (country: string) => {
    setBlockedCountries(blockedCountries.filter(c => c !== country));
    toast.success(`Country ${country} unblocked`);
  };

  const handleAddIP = () => {
    if (!newIP.trim()) {
      toast.error(t("admin.toasts.pleaseEnterIPAddress"));
      return;
    }
    const ip = newIP.trim();
    // Basic IP validation
    const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (!ipRegex.test(ip)) {
      toast.error(t("admin.toasts.invalidIPAddressFormat"));
      return;
    }
    if (blockedIPs.includes(ip)) {
      toast.error(t("admin.toasts.ipAddressAlreadyBlocked"));
      return;
    }
    setBlockedIPs([...blockedIPs, ip]);
    setNewIP("");
    toast.success(`IP ${ip} blocked`);
  };

  const handleRemoveIP = (ip: string) => {
    setBlockedIPs(blockedIPs.filter(i => i !== ip));
    toast.success(`IP ${ip} unblocked`);
  };

  const handleSaveSettings = () => {
    // In a real implementation, this would save to database via edge function
    toast.success(t("admin.toasts.securitySettingsSaved"));
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Security Settings</h1>
          <p className="text-muted-foreground mt-2">
            Manage security policies for user registration and login based on IP and location data
          </p>
        </div>

        <div className="grid gap-6">
          {/* Migration Banner Management */}
          <Card className="border-blue-200 dark:border-blue-900">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5 text-blue-500" />
                  <div>
                    <CardTitle>Platform Migration Banner</CardTitle>
                    <CardDescription>
                      Manage the migration notification banner displayed on the login page
                    </CardDescription>
                  </div>
                </div>
                <Switch
                  checked={bannerEnabled}
                  onCheckedChange={setBannerEnabled}
                  disabled={isLoadingBanner}
                />
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Banner Controls */}
              <div className="grid gap-4">
                {/* Dismissible Toggle */}
                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <Label className="text-base">Allow Users to Dismiss</Label>
                    <p className="text-sm text-muted-foreground">
                      Users can close the banner and it won't show again
                    </p>
                  </div>
                  <Switch
                    checked={bannerDismissible}
                    onCheckedChange={setBannerDismissible}
                    disabled={!bannerEnabled || isLoadingBanner}
                  />
                </div>

                {/* Message Editor */}
                <div className="space-y-4">
                  <Separator />
                  <h3 className="font-semibold text-sm">Banner Content</h3>
                  
                  {/* Title */}
                  <div className="space-y-2">
                    <Label htmlFor="banner-title">Title *</Label>
                    <Input
                      id="banner-title"
                      placeholder="e.g., ⚠️ Important Update for Existing Users"
                      value={bannerTitle}
                      onChange={(e) => setBannerTitle(e.target.value)}
                      disabled={!bannerEnabled || isLoadingBanner}
                      maxLength={100}
                    />
                    <p className="text-xs text-muted-foreground">{bannerTitle.length}/100 characters</p>
                  </div>

                  {/* Subtitle */}
                  <div className="space-y-2">
                    <Label htmlFor="banner-subtitle">Subtitle *</Label>
                    <Input
                      id="banner-subtitle"
                      placeholder="e.g., FineEarn has moved to a new upgraded platform!"
                      value={bannerSubtitle}
                      onChange={(e) => setBannerSubtitle(e.target.value)}
                      disabled={!bannerEnabled || isLoadingBanner}
                      maxLength={150}
                    />
                    <p className="text-xs text-muted-foreground">{bannerSubtitle.length}/150 characters</p>
                  </div>

                  {/* Steps */}
                  <div className="space-y-3">
                    <Label>Action Steps (3 required) *</Label>
                    
                    <div className="space-y-2">
                      <div className="flex items-start gap-2">
                        <span className="text-lg flex-shrink-0 mt-1">1️⃣</span>
                        <Textarea
                          placeholder="First step..."
                          value={bannerStep1}
                          onChange={(e) => setBannerStep1(e.target.value)}
                          disabled={!bannerEnabled || isLoadingBanner}
                          rows={2}
                          maxLength={200}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground text-right">{bannerStep1.length}/200</p>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-start gap-2">
                        <span className="text-lg flex-shrink-0 mt-1">2️⃣</span>
                        <Textarea
                          placeholder="Second step..."
                          value={bannerStep2}
                          onChange={(e) => setBannerStep2(e.target.value)}
                          disabled={!bannerEnabled || isLoadingBanner}
                          rows={2}
                          maxLength={200}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground text-right">{bannerStep2.length}/200</p>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-start gap-2">
                        <span className="text-lg flex-shrink-0 mt-1">3️⃣</span>
                        <Textarea
                          placeholder="Third step..."
                          value={bannerStep3}
                          onChange={(e) => setBannerStep3(e.target.value)}
                          disabled={!bannerEnabled || isLoadingBanner}
                          rows={2}
                          maxLength={200}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground text-right">{bannerStep3.length}/200</p>
                    </div>
                  </div>

                  {/* Cutoff Date */}
                  <div className="space-y-2">
                    <Label htmlFor="banner-cutoff">Cutoff Date</Label>
                    <Input
                      id="banner-cutoff"
                      type="date"
                      value={bannerCutoffDate}
                      onChange={(e) => setBannerCutoffDate(e.target.value)}
                      disabled={!bannerEnabled || isLoadingBanner}
                    />
                    <p className="text-xs text-muted-foreground">
                      Users who joined before this date will see the banner
                    </p>
                  </div>

                  {/* Support Link */}
                  <div className="space-y-2">
                    <Label htmlFor="banner-link">Support Link</Label>
                    <Input
                      id="banner-link"
                      placeholder="e.g., /settings or https://support.fineearn.com"
                      value={bannerSupportLink}
                      onChange={(e) => setBannerSupportLink(e.target.value)}
                      disabled={!bannerEnabled || isLoadingBanner}
                    />
                    <p className="text-xs text-muted-foreground">
                      Link shown as "Contact Support" in the banner
                    </p>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-3 pt-2">
                  <Button
                    onClick={handleSaveBanner}
                    disabled={isLoadingBanner || saveBannerMutation.isPending}
                    className="flex-1"
                  >
                    <Save className="h-4 w-4 mr-2" />
                    {saveBannerMutation.isPending ? t("common.saving") : t("admin.contentManagement.feeSavingsBanner.configuration.saveBannerSettings")}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleResetBanner}
                    disabled={isLoadingBanner || saveBannerMutation.isPending}
                  >
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Reset
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => setShowPreview(!showPreview)}
                    disabled={!bannerEnabled || isLoadingBanner}
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    {showPreview ? "Hide" : "Show"} Preview
                  </Button>
                </div>

                {/* Live Preview */}
                {showPreview && bannerEnabled && (
                  <div className="space-y-2 pt-4">
                    <Separator />
                    <Label className="text-base">Live Preview</Label>
                    <div className="rounded-lg border-2 border-dashed p-4">
                      <Alert className="bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-red-500/10 border-2 border-amber-500/50">
                        <AlertTriangle className="h-5 w-5 text-amber-500" />
                        <div className="ml-2">
                          <AlertTitle className="text-lg font-bold text-amber-700 dark:text-amber-400 mb-2">
                            {bannerTitle || "(Title will appear here)"}
                          </AlertTitle>
                          <AlertDescription className="space-y-3">
                            <p className="text-base font-semibold text-foreground">
                              {bannerSubtitle || "(Subtitle will appear here)"}
                            </p>
                            <div className="space-y-2">
                              <p className="text-sm font-medium text-muted-foreground">
                                If you joined before {bannerCutoffDate}, please:
                              </p>
                              <ol className="space-y-2 ml-2">
                                {[bannerStep1, bannerStep2, bannerStep3].map((step, index) => (
                                  <li key={index} className="flex items-start gap-2 text-sm text-foreground">
                                    <span className="flex-shrink-0 text-base">
                                      {["1️⃣", "2️⃣", "3️⃣"][index]}
                                    </span>
                                    <span>{step || `(Step ${index + 1} will appear here)`}</span>
                                  </li>
                                ))}
                              </ol>
                            </div>
                            {bannerSupportLink && (
                              <div className="pt-2">
                                <span className="text-sm font-medium text-amber-600 dark:text-amber-400 underline underline-offset-4">
                                  Contact Support →
                                </span>
                              </div>
                            )}
                          </AlertDescription>
                        </div>
                      </Alert>
                      <p className="text-xs text-muted-foreground mt-2 text-center">
                        This is how the banner will appear on the login page
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Information Alert */}
              <Alert className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-900">
                <Shield className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <AlertTitle>Banner Information</AlertTitle>
                <AlertDescription className="text-sm space-y-1">
                  <p>• Banner appears ONLY on the login page (before users sign in)</p>
                  <p>• Once dismissed, users won't see it again (stored in localStorage)</p>
                  <p>• Changes take effect immediately after saving</p>
                  <p>• Toggle off to disable banner site-wide without losing content</p>
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>

          {/* Withdrawal Bypass Monitoring Section */}
          <Card className="border-amber-200 dark:border-amber-900">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Crown className="h-5 w-5 text-amber-500" />
                <div>
                  <CardTitle>Withdrawal Bypass Monitoring</CardTitle>
                  <CardDescription>
                    Monitor users with daily withdrawal bypass enabled and track all bypass-related changes
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Active Bypass Users */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold flex items-center gap-2">
                    <Activity className="h-4 w-4" />
                    Active Bypass Users ({bypassUsers?.length || 0})
                  </h3>
                  <Badge variant="outline" className="bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-400">
                    Real-time
                  </Badge>
                </div>
                
                {isLoadingUsers ? (
                  <div className="text-sm text-muted-foreground">Loading...</div>
                ) : bypassUsers && bypassUsers.length > 0 ? (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Username</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Plan</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {bypassUsers.map((user) => (
                          <TableRow key={user.id}>
                            <TableCell className="font-medium">{user.username}</TableCell>
                            <TableCell>{user.email}</TableCell>
                            <TableCell>
                              <Badge variant="secondary">{user.membership_plan}</Badge>
                            </TableCell>
                            <TableCell>
                              <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400">
                                <Crown className="h-3 w-3 mr-1" />
                                VIP Access
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <Alert>
                    <AlertDescription>
                      No users currently have withdrawal bypass enabled.
                    </AlertDescription>
                  </Alert>
                )}
              </div>

              {/* Bypass Audit Trail */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Recent Bypass Changes (Last 50)
                  </h3>
                  <Badge variant="outline">Updated: {new Date().toLocaleTimeString()}</Badge>
                </div>

                {isLoadingAudit ? (
                  <div className="text-sm text-muted-foreground">Loading audit logs...</div>
                ) : bypassAuditLogs && bypassAuditLogs.length > 0 ? (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Timestamp</TableHead>
                          <TableHead>Username</TableHead>
                          <TableHead>Action</TableHead>
                          <TableHead>Admin ID</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {bypassAuditLogs.map((log: any) => {
                          // Check if withdrawal_bypass_changed exists in details
                          const bypassChanged = log.details?.withdrawal_bypass_changed;
                          const bypassEnabled = log.details?.bypass_enabled ?? bypassChanged;
                          return (
                            <TableRow key={log.id}>
                              <TableCell className="text-sm">
                                {new Date(log.created_at).toLocaleString()}
                              </TableCell>
                              <TableCell className="font-medium">
                                {log.profiles?.username || 'Unknown'}
                              </TableCell>
                              <TableCell>
                                {bypassEnabled ? (
                                  <Badge className="bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400">
                                    Enabled
                                  </Badge>
                                ) : (
                                  <Badge variant="secondary">Disabled</Badge>
                                )}
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground">
                                {log.admin_id?.substring(0, 8)}...
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <Alert>
                    <AlertDescription>
                      No bypass-related changes recorded yet.
                    </AlertDescription>
                  </Alert>
                )}
              </div>

              {/* Security Information */}
              <Alert className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-900">
                <Shield className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <AlertTitle>Security Notes</AlertTitle>
                <AlertDescription className="text-sm space-y-1">
                  <p>• All bypass changes are logged with admin ID, timestamp, and user details</p>
                  <p>• Withdrawal attempts using bypass are marked in withdrawal_attempt_logs</p>
                  <p>• Bypass does NOT override plan limits (min/max withdrawal amounts still apply)</p>
                  <p>• Monitor this section regularly for unauthorized bypass usage</p>
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>

          {/* Country Blocking */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Globe className="h-5 w-5" />
                  <div>
                    <CardTitle>Country Blocking</CardTitle>
                    <CardDescription>
                      Block registrations and logins from specific countries
                    </CardDescription>
                  </div>
                </div>
                <Switch
                  checked={enableCountryBlocking}
                  onCheckedChange={setEnableCountryBlocking}
                />
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <div className="flex-1">
                  <Label htmlFor="country-code">Country Code (ISO 3166-1 alpha-2)</Label>
                  <Input
                    id="country-code"
                    placeholder="e.g., US, GB, CN"
                    value={newCountry}
                    onChange={(e) => setNewCountry(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddCountry()}
                    disabled={!enableCountryBlocking}
                    maxLength={2}
                  />
                </div>
                <Button
                  onClick={handleAddCountry}
                  disabled={!enableCountryBlocking}
                  className="mt-auto"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Block
                </Button>
              </div>

              <div>
                <Label>Blocked Countries ({blockedCountries.length})</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {blockedCountries.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No countries blocked</p>
                  ) : (
                    blockedCountries.map((country) => (
                      <Badge key={country} variant="destructive" className="flex items-center gap-2">
                        <Ban className="h-3 w-3" />
                        {country}
                        <button
                          onClick={() => handleRemoveCountry(country)}
                          disabled={!enableCountryBlocking}
                          className="ml-1 hover:text-destructive-foreground/80"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* IP Blocking */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  <div>
                    <CardTitle>IP Address Blocking</CardTitle>
                    <CardDescription>
                      Block specific IP addresses from accessing the platform
                    </CardDescription>
                  </div>
                </div>
                <Switch
                  checked={enableIPBlocking}
                  onCheckedChange={setEnableIPBlocking}
                />
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <div className="flex-1">
                  <Label htmlFor="ip-address">IP Address</Label>
                  <Input
                    id="ip-address"
                    placeholder="e.g., 192.168.1.1"
                    value={newIP}
                    onChange={(e) => setNewIP(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddIP()}
                    disabled={!enableIPBlocking}
                  />
                </div>
                <Button
                  onClick={handleAddIP}
                  disabled={!enableIPBlocking}
                  className="mt-auto"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Block
                </Button>
              </div>

              <div>
                <Label>Blocked IP Addresses ({blockedIPs.length})</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {blockedIPs.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No IP addresses blocked</p>
                  ) : (
                    blockedIPs.map((ip) => (
                      <Badge key={ip} variant="destructive" className="flex items-center gap-2">
                        <Ban className="h-3 w-3" />
                        {ip}
                        <button
                          onClick={() => handleRemoveIP(ip)}
                          disabled={!enableIPBlocking}
                          className="ml-1 hover:text-destructive-foreground/80"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex justify-end gap-3">
            <Button variant="outline">Reset to Defaults</Button>
            <Button onClick={handleSaveSettings}>
              Save Security Settings
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
