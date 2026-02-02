import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

import { AdminBreadcrumb } from "@/components/admin/AdminBreadcrumb";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Shield, Save, RotateCcw, AlertCircle, Info, Key, Globe, Mail, DollarSign, Brain, Loader2 } from "lucide-react";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
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
  const { t } = useTranslation();
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
        title: t("admin.systemSecrets.secretsSaved"),
        description: t("admin.systemSecrets.secretsSavedDescription"),
      });
    },
    onError: (error: any) => {
      toast({
        title: t("admin.systemSecrets.errorSaving"),
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
      title: t("admin.systemSecrets.changesDiscarded"),
      description: t("admin.systemSecrets.changesDiscardedDescription"),
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <LoadingSpinner size="lg" text={t("common.loading")} />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 space-y-6 max-w-full overflow-x-hidden">
      <AdminBreadcrumb
        items={[
          { label: t("admin.systemSecrets.breadcrumbSecurity"), path: "/admin/security" },
          { label: t("admin.systemSecrets.breadcrumbSystemSecrets") },
        ]}
      />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">{t("admin.systemSecrets.title")}</h1>
          <p className="text-muted-foreground mt-1">
            {t("admin.systemSecrets.subtitle")}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            onClick={handleReset}
            disabled={!hasChanges || saveMutation.isPending}
            className="flex-1 sm:flex-none"
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            {t("admin.systemSecrets.discardChanges")}
          </Button>

          <Button
            onClick={handleSave}
            disabled={!hasChanges || saveMutation.isPending}
            className="flex-1 sm:flex-none"
          >
            {saveMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            {t("admin.systemSecrets.saveSecrets")}
          </Button>
        </div>
      </div>

      <Alert>
        <Shield className="h-4 w-4" />
        <AlertTitle>{t("admin.systemSecrets.securityWarning")}</AlertTitle>
        <AlertDescription>
          {t("admin.systemSecrets.securityWarningDescription")}
        </AlertDescription>
      </Alert>

      <Tabs defaultValue="ai" className="w-full">
        <TabsList className="flex flex-wrap h-auto p-1 bg-muted">
          <TabsTrigger value="ai" className="gap-2 flex-1 min-w-[120px]">
            <Brain className="h-4 w-4" />
            {t("admin.systemSecrets.tabs.ai")}
          </TabsTrigger>
          <TabsTrigger value="payment" className="gap-2 flex-1 min-w-[120px]">
            <DollarSign className="h-4 w-4" />
            {t("admin.systemSecrets.tabs.payment")}
          </TabsTrigger>
          <TabsTrigger value="email" className="gap-2 flex-1 min-w-[120px]">
            <Mail className="h-4 w-4" />
            {t("admin.systemSecrets.tabs.email")}
          </TabsTrigger>
          <TabsTrigger value="geo" className="gap-2 flex-1 min-w-[120px]">
            <Globe className="h-4 w-4" />
            {t("admin.systemSecrets.tabs.geo")}
          </TabsTrigger>
          <TabsTrigger value="currency" className="gap-2 flex-1 min-w-[120px]">
            <DollarSign className="h-4 w-4" />
            {t("admin.systemSecrets.tabs.currency")}
          </TabsTrigger>
        </TabsList>

        {/* AI - Gemini */}
        <TabsContent value="ai" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>{t("admin.systemSecrets.gemini.title")}</CardTitle>
              <CardDescription>{t("admin.systemSecrets.gemini.description")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="gemini_api_key">{t("admin.systemSecrets.gemini.apiKey")}</Label>
                <Input
                  id="gemini_api_key"
                  type="password"
                  value={secrets.gemini_config.apiKey}
                  onChange={(e) => handleChange('gemini_config', 'apiKey', e.target.value)}
                  placeholder={t("admin.systemSecrets.gemini.apiKeyPlaceholder")}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Payment - CPAY */}
        <TabsContent value="payment" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>{t("admin.systemSecrets.cpay.title")}</CardTitle>
              <CardDescription>{t("admin.systemSecrets.cpay.description")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="cpay_wallet_id">{t("admin.systemSecrets.cpay.walletId")}</Label>
                  <Input
                    id="cpay_wallet_id"
                    value={secrets.cpay_config.walletId}
                    onChange={(e) => handleChange('cpay_config', 'walletId', e.target.value)}
                    placeholder={t("admin.systemSecrets.cpay.walletIdPlaceholder")}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cpay_usdt_token_id">{t("admin.systemSecrets.cpay.usdtTokenId")}</Label>
                  <Input
                    id="cpay_usdt_token_id"
                    value={secrets.cpay_config.usdtTokenId}
                    onChange={(e) => handleChange('cpay_config', 'usdtTokenId', e.target.value)}
                    placeholder={t("admin.systemSecrets.cpay.usdtTokenIdPlaceholder")}
                  />
                </div>
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="cpay_public_key">{t("admin.systemSecrets.cpay.publicKey")}</Label>
                  <Input
                    id="cpay_public_key"
                    value={secrets.cpay_config.publicKey}
                    onChange={(e) => handleChange('cpay_config', 'publicKey', e.target.value)}
                    placeholder={t("admin.systemSecrets.cpay.publicKeyPlaceholder")}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cpay_private_key">{t("admin.systemSecrets.cpay.privateKey")}</Label>
                  <Input
                    id="cpay_private_key"
                    type="password"
                    value={secrets.cpay_config.privateKey}
                    onChange={(e) => handleChange('cpay_config', 'privateKey', e.target.value)}
                    placeholder={t("admin.systemSecrets.cpay.privateKeyPlaceholder")}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="cpay_passphrase">{t("admin.systemSecrets.cpay.passphrase")}</Label>
                <Input
                  id="cpay_passphrase"
                  type="password"
                  value={secrets.cpay_config.passphrase}
                  onChange={(e) => handleChange('cpay_config', 'passphrase', e.target.value)}
                  placeholder={t("admin.systemSecrets.cpay.passphrasePlaceholder")}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Email - Resend */}
        <TabsContent value="email" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>{t("admin.systemSecrets.resend.title")}</CardTitle>
              <CardDescription>{t("admin.systemSecrets.resend.description")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="resend_api_key">{t("admin.systemSecrets.resend.apiKey")}</Label>
                <Input
                  id="resend_api_key"
                  type="password"
                  value={secrets.resend_config.apiKey}
                  onChange={(e) => handleChange('resend_config', 'apiKey', e.target.value)}
                  placeholder={t("admin.systemSecrets.resend.apiKeyPlaceholder")}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Geo - IPStack */}
        <TabsContent value="geo" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>{t("admin.systemSecrets.ipstack.title")}</CardTitle>
              <CardDescription>{t("admin.systemSecrets.ipstack.description")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="ipstack_api_key">{t("admin.systemSecrets.ipstack.accessKey")}</Label>
                <Input
                  id="ipstack_api_key"
                  type="password"
                  value={secrets.ipstack_api_key}
                  onChange={(e) => handleChange('ipstack_api_key', null, e.target.value)}
                  placeholder={t("admin.systemSecrets.ipstack.accessKeyPlaceholder")}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Currency - OpenExchangeRates */}
        <TabsContent value="currency" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>{t("admin.systemSecrets.openexchange.title")}</CardTitle>
              <CardDescription>{t("admin.systemSecrets.openexchange.description")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="openexchange_app_id">{t("admin.systemSecrets.openexchange.appId")}</Label>
                <Input
                  id="openexchange_app_id"
                  type="password"
                  value={secrets.openexchange_config.appId}
                  onChange={(e) => handleChange('openexchange_config', 'appId', e.target.value)}
                  placeholder={t("admin.systemSecrets.openexchange.appIdPlaceholder")}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
