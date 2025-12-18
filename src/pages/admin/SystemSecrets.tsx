import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

import { AdminBreadcrumb } from "@/components/admin/AdminBreadcrumb";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Shield, Save, RotateCcw, AlertCircle, Info, Key, Globe, Mail, DollarSign, Brain } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface SystemSecrets {
  gemini_config: { apiKey: string };
  cpay_config: {
    walletId: string;
    publicKey: string;
    privateKey: string;
    passphrase: string;
    usdtTokenId: string;
  };
  resend_config: { apiKey: string };
  ipstack_api_key: string;
  openexchange_config: { appId: string };
}

const DEFAULT_SECRETS: SystemSecrets = {
  gemini_config: { apiKey: "" },
  cpay_config: {
    walletId: "",
    publicKey: "",
    privateKey: "",
    passphrase: "",
    usdtTokenId: "",
  },
  resend_config: { apiKey: "" },
  ipstack_api_key: "",
  openexchange_config: { appId: "" },
};

export default function SystemSecretsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [secrets, setSecrets] = useState<SystemSecrets>(DEFAULT_SECRETS);
  const [hasChanges, setHasChanges] = useState(false);

  // Fetch secrets
  const { data: configData, isLoading } = useQuery({
    queryKey: ['system-secrets'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('platform_config')
        .select('key, value')
        .in('key', [
          'gemini_config',
          'cpay_config',
          'resend_config',
          'ipstack_api_key',
          'openexchange_config'
        ]);

      if (error) throw error;
      
      const configMap: Record<string, any> = {};
      data?.forEach((row: any) => {
        configMap[row.key] = row.value;
      });

      return {
        gemini_config: configMap.gemini_config || DEFAULT_SECRETS.gemini_config,
        cpay_config: { ...DEFAULT_SECRETS.cpay_config, ...(configMap.cpay_config || {}) },
        resend_config: configMap.resend_config || DEFAULT_SECRETS.resend_config,
        ipstack_api_key: configMap.ipstack_api_key || DEFAULT_SECRETS.ipstack_api_key,
        openexchange_config: configMap.openexchange_config || DEFAULT_SECRETS.openexchange_config,
      } as SystemSecrets;
    },
  });

  // Update state when data loads
  useEffect(() => {
    if (configData) {
      setSecrets(configData);
    }
  }, [configData]);

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async (newSecrets: SystemSecrets) => {
      const updates = Object.entries(newSecrets).map(([key, value]) => ({
        key,
        value,
        updated_at: new Date().toISOString(),
      }));

      const { error } = await supabase
        .from('platform_config')
        .upsert(updates, { onConflict: 'key' });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['system-secrets'] });
      setHasChanges(false);
      toast({
        title: "Secrets saved",
        description: "System credentials have been updated successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error saving secrets",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleChange = (category: keyof SystemSecrets, field: string | null, value: string) => {
    setSecrets(prev => {
      if (field === null) {
        return { ...prev, [category]: value };
      }
      return {
        ...prev,
        [category]: {
          ...(prev[category] as any),
          [field]: value
        }
      };
    });
    setHasChanges(true);
  };

  const handleSave = () => {
    saveMutation.mutate(secrets);
  };

  const handleReset = () => {
    if (configData) {
      setSecrets(configData);
    } else {
      setSecrets(DEFAULT_SECRETS);
    }
    setHasChanges(false);
    toast({
      title: "Changes discarded",
      description: "Settings have been reverted to the last saved state.",
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      <AdminBreadcrumb
        items={[
          { label: "Security" },
          { label: "System Secrets" },
        ]}
      />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">System Secrets</h1>
          <p className="text-muted-foreground mt-1">
            Manage API keys and credentials for platform integrations
          </p>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleReset}
            disabled={!hasChanges || saveMutation.isPending}
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Discard Changes
          </Button>

          <Button
            onClick={handleSave}
            disabled={!hasChanges || saveMutation.isPending}
          >
            {saveMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Save Secrets
          </Button>
        </div>
      </div>

      <Alert>
        <Shield className="h-4 w-4" />
        <AlertTitle>Security Warning</AlertTitle>
        <AlertDescription>
          These keys provide access to sensitive services. Changes take effect immediately across all system components. If a key is left empty, the system will fall back to the environment variables configured in Supabase.
        </AlertDescription>
      </Alert>

      <Tabs defaultValue="ai" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="ai" className="gap-2">
            <Brain className="h-4 w-4" />
            AI (Gemini)
          </TabsTrigger>
          <TabsTrigger value="payment" className="gap-2">
            <DollarSign className="h-4 w-4" />
            Payment (CPAY)
          </TabsTrigger>
          <TabsTrigger value="email" className="gap-2">
            <Mail className="h-4 w-4" />
            Email (Resend)
          </TabsTrigger>
          <TabsTrigger value="geo" className="gap-2">
            <Globe className="h-4 w-4" />
            Geo (IPStack)
          </TabsTrigger>
          <TabsTrigger value="currency" className="gap-2">
            <DollarSign className="h-4 w-4" />
            Currency
          </TabsTrigger>
        </TabsList>

        {/* AI - Gemini */}
        <TabsContent value="ai" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Google Gemini API</CardTitle>
              <CardDescription>Used for automated AI task generation</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="gemini_api_key">API Key</Label>
                <Input
                  id="gemini_api_key"
                  type="password"
                  value={secrets.gemini_config.apiKey}
                  onChange={(e) => handleChange('gemini_config', 'apiKey', e.target.value)}
                  placeholder="Enter Gemini API Key"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Payment - CPAY */}
        <TabsContent value="payment" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>CPAY Payment Processor</CardTitle>
              <CardDescription>Credentials for automated withdrawals and wallet management</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="cpay_wallet_id">Wallet ID</Label>
                  <Input
                    id="cpay_wallet_id"
                    value={secrets.cpay_config.walletId}
                    onChange={(e) => handleChange('cpay_config', 'walletId', e.target.value)}
                    placeholder="Enter CPAY Wallet ID"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cpay_usdt_token_id">USDT Token ID</Label>
                  <Input
                    id="cpay_usdt_token_id"
                    value={secrets.cpay_config.usdtTokenId}
                    onChange={(e) => handleChange('cpay_config', 'usdtTokenId', e.target.value)}
                    placeholder="Enter USDT Token ID (24 chars)"
                  />
                </div>
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="cpay_public_key">API Public Key</Label>
                  <Input
                    id="cpay_public_key"
                    value={secrets.cpay_config.publicKey}
                    onChange={(e) => handleChange('cpay_config', 'publicKey', e.target.value)}
                    placeholder="Enter CPAY Public Key"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cpay_private_key">API Private Key</Label>
                  <Input
                    id="cpay_private_key"
                    type="password"
                    value={secrets.cpay_config.privateKey}
                    onChange={(e) => handleChange('cpay_config', 'privateKey', e.target.value)}
                    placeholder="Enter CPAY Private Key"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="cpay_passphrase">Wallet Passphrase</Label>
                <Input
                  id="cpay_passphrase"
                  type="password"
                  value={secrets.cpay_config.passphrase}
                  onChange={(e) => handleChange('cpay_config', 'passphrase', e.target.value)}
                  placeholder="Enter Wallet Passphrase"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Email - Resend */}
        <TabsContent value="email" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Resend API</CardTitle>
              <CardDescription>Credentials for sending transactional and bulk emails</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="resend_api_key">API Key</Label>
                <Input
                  id="resend_api_key"
                  type="password"
                  value={secrets.resend_config.apiKey}
                  onChange={(e) => handleChange('resend_config', 'apiKey', e.target.value)}
                  placeholder="re_..."
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Geo - IPStack */}
        <TabsContent value="geo" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>IPStack API</CardTitle>
              <CardDescription>Used for user IP detection and country mapping</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="ipstack_api_key">Access Key</Label>
                <Input
                  id="ipstack_api_key"
                  type="password"
                  value={secrets.ipstack_api_key}
                  onChange={(e) => handleChange('ipstack_api_key', null, e.target.value)}
                  placeholder="Enter IPStack Access Key"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Currency - OpenExchangeRates */}
        <TabsContent value="currency" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>OpenExchangeRates API</CardTitle>
              <CardDescription>Used for real-time USD to local currency conversion</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="openexchange_app_id">App ID</Label>
                <Input
                  id="openexchange_app_id"
                  type="password"
                  value={secrets.openexchange_config.appId}
                  onChange={(e) => handleChange('openexchange_config', 'appId', e.target.value)}
                  placeholder="Enter OpenExchangeRates App ID"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
