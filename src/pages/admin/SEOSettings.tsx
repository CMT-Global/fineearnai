import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Globe, Share2, Save, Undo, Info, Loader2 } from "lucide-react";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { PageLoading } from "@/components/shared/PageLoading";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useTranslation } from "react-i18next";
import { useLanguageSync } from "@/hooks/useLanguageSync";

interface SEOConfig {
  title: string;
  description: string;
  keywords: string;
  canonicalUrl: string;
  robots: string;
  faviconUrl: string;
  ogTitle: string;
  ogDescription: string;
  ogImage: string;
  ogUrl: string;
  twitterTitle: string;
  twitterDescription: string;
  twitterImage: string;
  twitterCard: string;
}

interface BrandingConfig {
  name: string;
  logoUrl: string;
  url: string;
}

const DEFAULT_SEO: SEOConfig = {
  title: "ProfitChips – Earn Online by Completing AI Tasks",
  description: "ProfitChips lets users earn money online by completing AI-powered tasks and online training. Simple, flexible, and global.",
  keywords: "earn online, AI tasks, online jobs, ProfitChips, make money online",
  canonicalUrl: "https://profitchips.com",
  robots: "index, follow",
  faviconUrl: "/logo_without_bg_text.png",
  ogTitle: "ProfitChips – Earn Online Completing AI Tasks",
  ogDescription: "Start earning online with ProfitChips by completing AI-powered tasks and training. No experience required.",
  ogImage: "/logo_without_bg_text.png",
  ogUrl: "https://profitchips.com",
  twitterTitle: "ProfitChips – Earn Online Completing AI Tasks",
  twitterDescription: "Start earning online with ProfitChips by completing AI-powered tasks and training. No experience required.",
  twitterImage: "/logo_without_bg_text.png",
  twitterCard: "summary_large_image",
};

const DEFAULT_BRANDING: BrandingConfig = {
  name: "ProfitChips",
  logoUrl: "/logo_without_bg_text.png",
  url: "https://profitchips.com",
};

export default function SEOSettings() {
  const { t } = useTranslation();
  useLanguageSync(); // Sync language and force re-render when language changes
  
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [config, setConfig] = useState<SEOConfig>(DEFAULT_SEO);
  const [branding, setBranding] = useState<BrandingConfig>(DEFAULT_BRANDING);
  const [hasChanges, setHasChanges] = useState(false);

  // Fetch SEO and branding config
  const { data, isLoading } = useQuery({
    queryKey: ["seo-branding-config"],
    queryFn: async () => {
      const { data: configData, error } = await supabase
        .from("platform_config")
        .select("key, value")
        .in("key", ["seo_config", "platform_branding"]);

      if (error) throw error;

      const seoRow = configData?.find((r) => r.key === "seo_config");
      const brandingRow = configData?.find((r) => r.key === "platform_branding");

      return {
        seo: (seoRow?.value as unknown as SEOConfig) || DEFAULT_SEO,
        branding: (brandingRow?.value as unknown as BrandingConfig) || DEFAULT_BRANDING,
      };
    },
  });

  // Update state when data loads
  useEffect(() => {
    if (data) {
      setConfig(data.seo);
      setBranding(data.branding);
    }
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: async ({ seo, branding }: { seo: SEOConfig, branding: BrandingConfig }) => {
      const { error: seoError } = await supabase
        .from("platform_config")
        .upsert({
          key: "seo_config",
          value: seo as any,
          description: "Website SEO and Social Sharing configurations",
          updated_at: new Date().toISOString(),
        }, { onConflict: "key" });

      if (seoError) throw seoError;

      const { error: brandingError } = await supabase
        .from("platform_config")
        .upsert({
          key: "platform_branding",
          value: branding as any,
          description: "Platform branding settings (Name, Logo, URL)",
          updated_at: new Date().toISOString(),
        }, { onConflict: "key" });

      if (brandingError) throw brandingError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["seo-branding-config"] });
      queryClient.invalidateQueries({ queryKey: ["branding-config"] });
      queryClient.invalidateQueries({ queryKey: ["seo-config"] });
      setHasChanges(false);
      toast({
        title: t("admin.contentManagement.seoSettings.settingsSaved"),
        description: t("admin.contentManagement.seoSettings.settingsSavedDescription"),
      });
    },
    onError: (error: any) => {
      toast({
        title: t("admin.contentManagement.seoSettings.errorSaving"),
        description: error.message || t("admin.contentManagement.seoSettings.errorSavingDescription"),
        variant: "destructive",
      });
    },
  });

  const handleSEOChange = (key: keyof SEOConfig, value: string) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const handleBrandingChange = (key: keyof BrandingConfig, value: string) => {
    setBranding((prev) => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const handleReset = () => {
    if (data) {
      setConfig(data.seo);
      setBranding(data.branding);
      setHasChanges(false);
    }
  };

  if (isLoading) {
    return <PageLoading text={t("admin.loadingPanel")} />;
  }

  return (
    <div className="container mx-auto px-4 py-8 space-y-6 max-w-full overflow-x-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
            <Globe className="h-6 w-6 sm:h-8 sm:w-8 text-primary" />
            {t("admin.contentManagement.seoSettings.title")}
          </h1>
          <p className="text-muted-foreground mt-2">
            {t("admin.contentManagement.seoSettings.subtitle")}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="outline" onClick={handleReset} disabled={!hasChanges || saveMutation.isPending} className="flex-1 sm:flex-none">
            <Undo className="h-4 w-4 mr-2" />
            {t("admin.contentManagement.seoSettings.discardChanges")}
          </Button>
          <Button onClick={() => saveMutation.mutate({ seo: config, branding })} disabled={!hasChanges || saveMutation.isPending} className="flex-1 sm:flex-none">
            {saveMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            {t("admin.contentManagement.seoSettings.saveSettings")}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="branding" className="space-y-6">
        <TabsList className="flex flex-wrap h-auto p-1 bg-muted">
          <TabsTrigger value="branding" className="gap-2 flex-1">
            <Globe className="h-4 w-4" />
            {t("admin.contentManagement.seoSettings.tabs.branding")}
          </TabsTrigger>
          <TabsTrigger value="seo" className="gap-2 flex-1">
            <Globe className="h-4 w-4" />
            {t("admin.contentManagement.seoSettings.tabs.seo")}
          </TabsTrigger>
          <TabsTrigger value="social" className="gap-2 flex-1">
            <Share2 className="h-4 w-4" />
            {t("admin.contentManagement.seoSettings.tabs.social")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="branding" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{t("admin.contentManagement.seoSettings.branding.title")}</CardTitle>
              <CardDescription>
                {t("admin.contentManagement.seoSettings.branding.description")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="platformName">{t("admin.contentManagement.seoSettings.branding.platformName")}</Label>
                <Input
                  id="platformName"
                  value={branding.name}
                  onChange={(e) => handleBrandingChange("name", e.target.value)}
                  placeholder="e.g. ProfitChips"
                />
                <p className="text-xs text-muted-foreground">{t("admin.contentManagement.seoSettings.branding.platformNameHint")}</p>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="platformLogo">{t("admin.contentManagement.seoSettings.branding.platformLogo")}</Label>
                <div className="flex gap-4">
                  <div className="flex-1 space-y-2">
                    <Input
                      id="platformLogo"
                      value={branding.logoUrl}
                      onChange={(e) => handleBrandingChange("logoUrl", e.target.value)}
                      placeholder="/logo_without_bg_text.png"
                    />
                    <p className="text-xs text-muted-foreground">{t("admin.contentManagement.seoSettings.branding.platformLogoHint")}</p>
                  </div>
                  <div className="h-12 w-12 border rounded-lg overflow-hidden bg-muted flex items-center justify-center">
                    <img src={branding.logoUrl} alt="Preview" className="h-full w-full object-contain" />
                  </div>
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="platformUrl">{t("admin.contentManagement.seoSettings.branding.platformUrl")}</Label>
                <Input
                  id="platformUrl"
                  value={branding.url}
                  onChange={(e) => handleBrandingChange("url", e.target.value)}
                  placeholder="https://profitchips.com"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="seo" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{t("admin.contentManagement.seoSettings.seo.title")}</CardTitle>
              <CardDescription>
                {t("admin.contentManagement.seoSettings.seo.description")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="title">{t("admin.contentManagement.seoSettings.seo.pageTitle")}</Label>
                <Input
                  id="title"
                  value={config.title}
                  onChange={(e) => handleSEOChange("title", e.target.value)}
                  placeholder="Enter page title"
                />
                <p className="text-xs text-muted-foreground">{t("admin.contentManagement.seoSettings.seo.pageTitleHint")}</p>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="description">{t("admin.contentManagement.seoSettings.seo.metaDescription")}</Label>
                <Textarea
                  id="description"
                  value={config.description}
                  onChange={(e) => handleSEOChange("description", e.target.value)}
                  placeholder="Enter meta description"
                  rows={3}
                />
                <p className="text-xs text-muted-foreground">{t("admin.contentManagement.seoSettings.seo.metaDescriptionHint")}</p>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="keywords">{t("admin.contentManagement.seoSettings.seo.keywords")}</Label>
                <Input
                  id="keywords"
                  value={config.keywords}
                  onChange={(e) => handleSEOChange("keywords", e.target.value)}
                  placeholder="e.g. earn online, AI tasks, ProfitChips"
                />
                <p className="text-xs text-muted-foreground">{t("admin.contentManagement.seoSettings.seo.keywordsHint")}</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="canonicalUrl">{t("admin.contentManagement.seoSettings.seo.canonicalUrl")}</Label>
                  <Input
                    id="canonicalUrl"
                    value={config.canonicalUrl}
                    onChange={(e) => handleSEOChange("canonicalUrl", e.target.value)}
                    placeholder="https://yourdomain.com"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="robots">{t("admin.contentManagement.seoSettings.seo.robotsMeta")}</Label>
                  <Input
                    id="robots"
                    value={config.robots}
                    onChange={(e) => handleSEOChange("robots", e.target.value)}
                    placeholder="index, follow"
                  />
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="faviconUrl">{t("admin.contentManagement.seoSettings.seo.faviconUrl")}</Label>
                <Input
                  id="faviconUrl"
                  value={config.faviconUrl}
                  onChange={(e) => handleSEOChange("faviconUrl", e.target.value)}
                  placeholder="/logo_without_bg_text.png"
                />
                <p className="text-xs text-muted-foreground">{t("admin.contentManagement.seoSettings.seo.faviconUrlHint")}</p>
              </div>
            </CardContent>
          </Card>

          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>{t("admin.contentManagement.seoSettings.seo.tipTitle")}</AlertTitle>
            <AlertDescription>
              {t("admin.contentManagement.seoSettings.seo.tipDescription")}
            </AlertDescription>
          </Alert>
        </TabsContent>

        <TabsContent value="social" className="space-y-6">
          <div className="grid lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-blue-600">
                  <Share2 className="h-5 w-5" />
                  {t("admin.contentManagement.seoSettings.social.openGraph.title")}
                </CardTitle>
                <CardDescription>
                  {t("admin.contentManagement.seoSettings.social.openGraph.description")}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-2">
                  <Label htmlFor="ogTitle">{t("admin.contentManagement.seoSettings.social.openGraph.ogTitle")}</Label>
                  <Input
                    id="ogTitle"
                    value={config.ogTitle}
                    onChange={(e) => handleSEOChange("ogTitle", e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="ogDescription">{t("admin.contentManagement.seoSettings.social.openGraph.ogDescription")}</Label>
                  <Textarea
                    id="ogDescription"
                    value={config.ogDescription}
                    onChange={(e) => handleSEOChange("ogDescription", e.target.value)}
                    rows={2}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="ogImage">{t("admin.contentManagement.seoSettings.social.openGraph.ogImage")}</Label>
                  <Input
                    id="ogImage"
                    value={config.ogImage}
                    onChange={(e) => handleSEOChange("ogImage", e.target.value)}
                    placeholder="/logo_without_bg_text.png"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="ogUrl">{t("admin.contentManagement.seoSettings.social.openGraph.ogUrl")}</Label>
                  <Input
                    id="ogUrl"
                    value={config.ogUrl}
                    onChange={(e) => handleSEOChange("ogUrl", e.target.value)}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sky-500">
                  <Share2 className="h-5 w-5" />
                  {t("admin.contentManagement.seoSettings.social.twitter.title")}
                </CardTitle>
                <CardDescription>
                  {t("admin.contentManagement.seoSettings.social.twitter.description")}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-2">
                  <Label htmlFor="twitterTitle">{t("admin.contentManagement.seoSettings.social.twitter.twitterTitle")}</Label>
                  <Input
                    id="twitterTitle"
                    value={config.twitterTitle}
                    onChange={(e) => handleSEOChange("twitterTitle", e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="twitterDescription">{t("admin.contentManagement.seoSettings.social.twitter.twitterDescription")}</Label>
                  <Textarea
                    id="twitterDescription"
                    value={config.twitterDescription}
                    onChange={(e) => handleSEOChange("twitterDescription", e.target.value)}
                    rows={2}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="twitterImage">{t("admin.contentManagement.seoSettings.social.twitter.twitterImage")}</Label>
                  <Input
                    id="twitterImage"
                    value={config.twitterImage}
                    onChange={(e) => handleSEOChange("twitterImage", e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="twitterCard">{t("admin.contentManagement.seoSettings.social.twitter.cardType")}</Label>
                  <Input
                    id="twitterCard"
                    value={config.twitterCard}
                    onChange={(e) => handleSEOChange("twitterCard", e.target.value)}
                    placeholder="summary_large_image"
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
