import { useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Trash2, Plus, Shield, Globe, Ban } from "lucide-react";

export default function SecuritySettings() {
  const [blockedCountries, setBlockedCountries] = useState<string[]>(['CN', 'RU']);
  const [blockedIPs, setBlockedIPs] = useState<string[]>(['192.168.1.1']);
  const [newCountry, setNewCountry] = useState("");
  const [newIP, setNewIP] = useState("");
  const [enableCountryBlocking, setEnableCountryBlocking] = useState(true);
  const [enableIPBlocking, setEnableIPBlocking] = useState(true);

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
