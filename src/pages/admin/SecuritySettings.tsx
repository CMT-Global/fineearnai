import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { useLanguageSync } from "@/hooks/useLanguageSync";
import { Trash2, Plus, Shield, Globe, Ban, Crown, Activity, Clock, AlertTriangle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Separator } from "@/components/ui/separator";

export default function SecuritySettings() {
  const { t } = useTranslation();
  useLanguageSync(); // Sync language and force re-render when language changes
  
  
  // Country and IP blocking state
  const [enableCountryBlocking, setEnableCountryBlocking] = useState(false);
  const [blockedCountries, setBlockedCountries] = useState<string[]>([]);
  const [newCountry, setNewCountry] = useState("");
  const [enableIPBlocking, setEnableIPBlocking] = useState(false);
  const [blockedIPs, setBlockedIPs] = useState<string[]>([]);
  const [newIP, setNewIP] = useState("");
  
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
    toast.success(t("admin.securitySettings.countryBlocking.countryBlocked", { code: countryCode }));
  };

  const handleRemoveCountry = (country: string) => {
    setBlockedCountries(blockedCountries.filter(c => c !== country));
    toast.success(t("admin.securitySettings.countryBlocking.countryUnblocked", { code: country }));
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
    toast.success(t("admin.securitySettings.ipBlocking.ipBlocked", { ip }));
  };

  const handleRemoveIP = (ip: string) => {
    setBlockedIPs(blockedIPs.filter(i => i !== ip));
    toast.success(t("admin.securitySettings.ipBlocking.ipUnblocked", { ip }));
  };

  const handleSaveSettings = () => {
    // In a real implementation, this would save to database via edge function
    toast.success(t("admin.toasts.securitySettingsSaved"));
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">{t("admin.securitySettings.title")}</h1>
          <p className="text-muted-foreground mt-2">
            {t("admin.securitySettings.subtitle")}
          </p>
        </div>

        <div className="grid gap-6">
          {/* Withdrawal Bypass Monitoring Section */}
          <Card className="border-amber-200 dark:border-amber-900">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Crown className="h-5 w-5 text-amber-500" />
                <div>
                  <CardTitle>{t("admin.securitySettings.withdrawalBypass.title")}</CardTitle>
                  <CardDescription>
                    {t("admin.securitySettings.withdrawalBypass.description")}
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
                    {t("admin.securitySettings.withdrawalBypass.activeUsers")} ({bypassUsers?.length || 0})
                  </h3>
                  <Badge variant="outline" className="bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-400">
                    {t("admin.securitySettings.withdrawalBypass.realtime")}
                  </Badge>
                </div>
                
                {isLoadingUsers ? (
                  <div className="text-sm text-muted-foreground">{t("admin.securitySettings.withdrawalBypass.loading")}</div>
                ) : bypassUsers && bypassUsers.length > 0 ? (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{t("admin.securitySettings.withdrawalBypass.username")}</TableHead>
                          <TableHead>{t("admin.securitySettings.withdrawalBypass.email")}</TableHead>
                          <TableHead>{t("admin.securitySettings.withdrawalBypass.plan")}</TableHead>
                          <TableHead>{t("admin.securitySettings.withdrawalBypass.status")}</TableHead>
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
                                {t("admin.securitySettings.withdrawalBypass.vipAccess")}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <Alert className="bg-slate-800/50 dark:bg-slate-900/50 border-slate-700 dark:border-slate-700">
                    <AlertDescription className="text-slate-300 dark:text-slate-300">
                      {t("admin.securitySettings.withdrawalBypass.noUsers")}
                    </AlertDescription>
                  </Alert>
                )}
              </div>

              {/* Bypass Audit Trail */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    {t("admin.securitySettings.withdrawalBypass.recentChanges")}
                  </h3>
                  <Badge variant="outline">{t("admin.securitySettings.withdrawalBypass.updated")}: {new Date().toLocaleTimeString()}</Badge>
                </div>

                {isLoadingAudit ? (
                  <div className="text-sm text-muted-foreground">{t("admin.securitySettings.withdrawalBypass.loadingAudit")}</div>
                ) : bypassAuditLogs && bypassAuditLogs.length > 0 ? (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{t("admin.securitySettings.withdrawalBypass.timestamp")}</TableHead>
                          <TableHead>{t("admin.securitySettings.withdrawalBypass.username")}</TableHead>
                          <TableHead>{t("admin.securitySettings.withdrawalBypass.action")}</TableHead>
                          <TableHead>{t("admin.securitySettings.withdrawalBypass.adminId")}</TableHead>
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
                                    {t("admin.securitySettings.withdrawalBypass.enabled")}
                                  </Badge>
                                ) : (
                                  <Badge variant="secondary">{t("admin.securitySettings.withdrawalBypass.disabled")}</Badge>
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
                  <Alert className="bg-slate-800/50 dark:bg-slate-900/50 border-slate-700 dark:border-slate-700">
                    <AlertDescription className="text-slate-300 dark:text-slate-300">
                      {t("admin.securitySettings.withdrawalBypass.noChanges")}
                    </AlertDescription>
                  </Alert>
                )}
              </div>

              {/* Security Information */}
              <Alert className="bg-slate-800/50 dark:bg-slate-900/50 border-slate-700 dark:border-slate-700">
                <Shield className="h-4 w-4 text-blue-400 dark:text-blue-400" />
                <AlertTitle className="text-slate-100 dark:text-slate-100">{t("admin.securitySettings.withdrawalBypass.securityNotes")}</AlertTitle>
                <AlertDescription className="text-sm space-y-1 text-slate-300 dark:text-slate-300">
                  <p>• {t("admin.securitySettings.withdrawalBypass.note1")}</p>
                  <p>• {t("admin.securitySettings.withdrawalBypass.note2")}</p>
                  <p>• {t("admin.securitySettings.withdrawalBypass.note3")}</p>
                  <p>• {t("admin.securitySettings.withdrawalBypass.note4")}</p>
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
                    <CardTitle>{t("admin.securitySettings.countryBlocking.title")}</CardTitle>
                    <CardDescription>
                      {t("admin.securitySettings.countryBlocking.description")}
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
                  <Label htmlFor="country-code">{t("admin.securitySettings.countryBlocking.countryCodeLabel")}</Label>
                  <Input
                    id="country-code"
                    placeholder={t("admin.securitySettings.countryBlocking.countryCodePlaceholder")}
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
                  {t("admin.securitySettings.countryBlocking.block")}
                </Button>
              </div>

              <div>
                <Label>{t("admin.securitySettings.countryBlocking.blockedCountries")} ({blockedCountries.length})</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {blockedCountries.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{t("admin.securitySettings.countryBlocking.noCountries")}</p>
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
                    <CardTitle>{t("admin.securitySettings.ipBlocking.title")}</CardTitle>
                    <CardDescription>
                      {t("admin.securitySettings.ipBlocking.description")}
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
                  <Label htmlFor="ip-address">{t("admin.securitySettings.ipBlocking.ipAddressLabel")}</Label>
                  <Input
                    id="ip-address"
                    placeholder={t("admin.securitySettings.ipBlocking.ipAddressPlaceholder")}
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
                  {t("admin.securitySettings.ipBlocking.block")}
                </Button>
              </div>

              <div>
                <Label>{t("admin.securitySettings.ipBlocking.blockedIPs")} ({blockedIPs.length})</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {blockedIPs.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{t("admin.securitySettings.ipBlocking.noIPs")}</p>
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
            <Button variant="outline">{t("admin.securitySettings.actions.resetToDefaults")}</Button>
            <Button onClick={handleSaveSettings}>
              {t("admin.securitySettings.actions.saveSettings")}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
