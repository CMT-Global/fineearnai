import { useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Trash2, Plus, Shield, Globe, Ban, Crown, Activity, Clock, AlertTriangle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export default function SecuritySettings() {
  const [blockedCountries, setBlockedCountries] = useState<string[]>(['CN', 'RU']);
  const [blockedIPs, setBlockedIPs] = useState<string[]>(['192.168.1.1']);
  const [newCountry, setNewCountry] = useState("");
  const [newIP, setNewIP] = useState("");
  const [enableCountryBlocking, setEnableCountryBlocking] = useState(true);
  const [enableIPBlocking, setEnableIPBlocking] = useState(true);

  // Fetch withdrawal bypass audit logs
  const { data: bypassAuditLogs, isLoading: isLoadingAudit } = useQuery({
    queryKey: ['withdrawal-bypass-audit'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('audit_logs')
        .select(`
          id,
          created_at,
          admin_id,
          target_user_id,
          details,
          profiles!audit_logs_target_user_id_fkey(username, email)
        `)
        .eq('action_type', 'profile_update')
        .not('details->>withdrawal_bypass_changed', 'is', null)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return data;
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
      toast.error("Please enter a country code");
      return;
    }
    const countryCode = newCountry.trim().toUpperCase();
    if (countryCode.length !== 2) {
      toast.error("Country code must be 2 characters (ISO 3166-1 alpha-2)");
      return;
    }
    if (blockedCountries.includes(countryCode)) {
      toast.error("Country already blocked");
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
      toast.error("Please enter an IP address");
      return;
    }
    const ip = newIP.trim();
    // Basic IP validation
    const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (!ipRegex.test(ip)) {
      toast.error("Invalid IP address format");
      return;
    }
    if (blockedIPs.includes(ip)) {
      toast.error("IP address already blocked");
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
    toast.success("Security settings saved successfully");
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Security Settings</h1>
          <p className="text-muted-foreground mt-2">
            Manage security policies for user registration and login based on IP and location data
          </p>
        </div>

        <div className="grid gap-6">
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
                          const bypassEnabled = log.details?.bypass_enabled;
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
    </AdminLayout>
  );
}
