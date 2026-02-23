import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { MapPin, Mail, Share2, RotateCcw, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { PageLoading } from "@/components/shared/PageLoading";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useTranslation } from "react-i18next";
import { useLanguageSync } from "@/hooks/useLanguageSync";

export interface SocialLinkConfig {
  url: string;
  enabled: boolean;
}

export interface LandingFooterContactConfig {
  address: string;
  supportEmail: string;
  socialLinks: {
    facebook: SocialLinkConfig;
    instagram: SocialLinkConfig;
    tiktok: SocialLinkConfig;
    x: SocialLinkConfig;
  };
}

const DEFAULT_CONFIG: LandingFooterContactConfig = {
  address: "123 Innovation Drive, Tech City, TC 12345",
  supportEmail: "support@profitchips.com",
  socialLinks: {
    facebook: { url: "https://facebook.com/ProfitChips", enabled: true },
    instagram: { url: "https://www.instagram.com/ProfitChipsofficial/", enabled: true },
    tiktok: { url: "https://www.tiktok.com/@ProfitChips", enabled: true },
    x: { url: "https://x.com/ProfitChips", enabled: true },
  },
};

const SOCIAL_KEYS = ["facebook", "instagram", "tiktok", "x"] as const;

export default function FooterContactSettings() {
  const { t } = useTranslation();
  useLanguageSync();

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [config, setConfig] = useState<LandingFooterContactConfig>(DEFAULT_CONFIG);
  const [hasChanges, setHasChanges] = useState(false);

  const { data: configData, isLoading } = useQuery({
    queryKey: ["landing-footer-contact"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("platform_config")
        .select("value")
        .eq("key", "landing_footer_contact")
        .maybeSingle();

      if (error) throw error;
      return (data?.value as unknown) as LandingFooterContactConfig | null;
    },
  });

  useEffect(() => {
    if (configData) {
      const merged: LandingFooterContactConfig = {
        address: configData.address ?? DEFAULT_CONFIG.address,
        supportEmail: configData.supportEmail ?? DEFAULT_CONFIG.supportEmail,
        socialLinks: {
          facebook: { ...DEFAULT_CONFIG.socialLinks.facebook, ...configData.socialLinks?.facebook },
          instagram: { ...DEFAULT_CONFIG.socialLinks.instagram, ...configData.socialLinks?.instagram },
          tiktok: { ...DEFAULT_CONFIG.socialLinks.tiktok, ...configData.socialLinks?.tiktok },
          x: { ...DEFAULT_CONFIG.socialLinks.x, ...configData.socialLinks?.x },
        },
      };
      setConfig(merged);
      setHasChanges(false);
    }
  }, [configData]);

  const saveMutation = useMutation({
    mutationFn: async (newConfig: LandingFooterContactConfig) => {
      const { error } = await supabase
        .from("platform_config")
        .upsert(
          {
            key: "landing_footer_contact",
            value: newConfig as unknown as Json,
            description: "Landing page footer contact: address, support email, social links",
            updated_at: new Date().toISOString(),
          },
          { onConflict: "key" }
        );

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["landing-footer-contact"] });
      setHasChanges(false);
      toast({
        title: t("admin.contentManagement.footerContact.settingsSaved"),
        description: t("admin.contentManagement.footerContact.settingsSavedDescription"),
      });
    },
    onError: (error: Error) => {
      toast({
        title: t("admin.contentManagement.footerContact.errorSaving"),
        description: error.message || t("admin.contentManagement.footerContact.errorSavingDescription"),
        variant: "destructive",
      });
    },
  });

  const handleSave = () => saveMutation.mutate(config);
  const handleReset = () => {
    setConfig(DEFAULT_CONFIG);
    setHasChanges(true);
  };

  const updateConfig = (updates: Partial<LandingFooterContactConfig>) => {
    setConfig((prev) => ({ ...prev, ...updates }));
    setHasChanges(true);
  };

  const updateSocial = (key: (typeof SOCIAL_KEYS)[number], updates: Partial<SocialLinkConfig>) => {
    setConfig((prev) => ({
      ...prev,
      socialLinks: {
        ...prev.socialLinks,
        [key]: { ...prev.socialLinks[key], ...updates },
      },
    }));
    setHasChanges(true);
  };

  if (isLoading) {
    return <PageLoading text={t("admin.contentManagement.footerContact.loading")} />;
  }

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <MapPin className="h-8 w-8 text-primary" />
          {t("admin.contentManagement.footerContact.title")}
        </h1>
        <p className="text-muted-foreground mt-2">
          {t("admin.contentManagement.footerContact.subtitle")}
        </p>
      </div>

      {/* Address */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            {t("admin.contentManagement.footerContact.addressTitle")}
          </CardTitle>
          <CardDescription>
            {t("admin.contentManagement.footerContact.addressDescription")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            id="address"
            value={config.address}
            onChange={(e) => updateConfig({ address: e.target.value })}
            placeholder="123 Innovation Drive, Tech City, TC 12345"
            rows={3}
            className="resize-none"
          />
        </CardContent>
      </Card>

      {/* Support Email */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            {t("admin.contentManagement.footerContact.supportEmailTitle")}
          </CardTitle>
          <CardDescription>
            {t("admin.contentManagement.footerContact.supportEmailDescription")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Input
            id="supportEmail"
            type="email"
            value={config.supportEmail}
            onChange={(e) => updateConfig({ supportEmail: e.target.value })}
            placeholder="support@profitchips.com"
          />
        </CardContent>
      </Card>

      {/* Social Links */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5" />
            {t("admin.contentManagement.footerContact.socialTitle")}
          </CardTitle>
          <CardDescription>
            {t("admin.contentManagement.footerContact.socialDescription")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {SOCIAL_KEYS.map((key) => (
            <div
              key={key}
              className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 rounded-lg border bg-muted/30"
            >
              <div className="flex-1 space-y-2">
                <Label htmlFor={`social-${key}-url`} className="capitalize font-medium">
                  {t(`admin.contentManagement.footerContact.social.${key}`)}
                </Label>
                <Input
                  id={`social-${key}-url`}
                  value={config.socialLinks[key].url}
                  onChange={(e) => updateSocial(key, { url: e.target.value })}
                  placeholder={
                    key === "facebook"
                      ? "https://facebook.com/yourpage"
                      : key === "instagram"
                        ? "https://www.instagram.com/yourhandle/"
                        : key === "tiktok"
                          ? "https://www.tiktok.com/@yourhandle"
                          : "https://x.com/yourhandle"
                  }
                />
              </div>
              <div className="flex items-center gap-3 sm:shrink-0">
                <Label htmlFor={`social-${key}-enabled`} className="text-sm text-muted-foreground whitespace-nowrap">
                  {t("admin.contentManagement.footerContact.showOnFooter")}
                </Label>
                <Switch
                  id={`social-${key}-enabled`}
                  checked={config.socialLinks[key].enabled}
                  onCheckedChange={(checked) => updateSocial(key, { enabled: checked })}
                />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Actions */}
      <Card>
        <CardContent className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 py-6">
          <p className="text-sm text-muted-foreground">
            {t("admin.contentManagement.footerContact.changesHint")}
          </p>
          <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
            <Button
              variant="outline"
              onClick={handleReset}
              disabled={saveMutation.isPending}
              className="flex-1 sm:flex-none"
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              {t("admin.contentManagement.footerContact.resetToDefaults")}
            </Button>
            <Button
              onClick={handleSave}
              disabled={!hasChanges || saveMutation.isPending}
              className="flex-1 sm:flex-none"
            >
              {saveMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {t("common.saving")}
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  {t("common.saveChanges")}
                </>
              )}
            </Button>
          </div>
        </CardContent>

        {saveMutation.isSuccess && (
          <CardContent className="pt-0">
            <Alert>
              <CheckCircle2 className="h-4 w-4" />
              <AlertDescription>
                {t("admin.contentManagement.footerContact.successMessage")}
              </AlertDescription>
            </Alert>
          </CardContent>
        )}

        {saveMutation.isError && (
          <CardContent className="pt-0">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {t("admin.contentManagement.footerContact.errorMessage")}
              </AlertDescription>
            </Alert>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
