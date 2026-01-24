import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { LayoutDashboard, RotateCcw, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useTranslation } from "react-i18next";
import { useLanguageSync } from "@/hooks/useLanguageSync";

interface DashboardContentConfig {
  earnersGuide: {
    isVisible: boolean;
  };
  guidesSection: {
    isVisible: boolean;
    title: string;
    description: string;
  };
  socialSection: {
    isVisible: boolean;
    facebookUrl: string;
    instagramUrl: string;
    tiktokUrl: string;
  };
}

const DEFAULT_PLATFORM_NAME = "ProfitChips";

const DEFAULT_DASHBOARD_CONTENT: DashboardContentConfig = {
  earnersGuide: {
    isVisible: true,
  },
  guidesSection: {
    isVisible: true,
    title: "💳 Deposit & Withdrawal Quick Guides",
    description: "Learn how to fund your account and withdraw earnings using various payment methods globally",
  },
  socialSection: {
    isVisible: true,
    facebookUrl: "https://facebook.com/ProfitChips",
    instagramUrl: "https://www.instagram.com/ProfitChipsofficial/",
    tiktokUrl: "https://www.tiktok.com/@ProfitChips",
  },
};

export default function DashboardContentSettings() {
  const { t } = useTranslation();
  useLanguageSync(); // Sync language and force re-render when language changes
  
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [platformName, setPlatformName] = useState<string>(DEFAULT_PLATFORM_NAME);
  const [config, setConfig] = useState<DashboardContentConfig>(DEFAULT_DASHBOARD_CONTENT);
  const [hasChanges, setHasChanges] = useState(false);

  // Fetch platform config data
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard-content-settings"],
    queryFn: async () => {
      const { data: configData, error } = await supabase
        .from("platform_config")
        .select("key, value")
        .in("key", ["platform_name", "dashboard_content"]);

      if (error) throw error;

      const configMap: Record<string, any> = {};
      configData?.forEach((row: any) => {
        configMap[row.key] = row.value;
      });

      return {
        platformName: (configMap.platform_name as string) || DEFAULT_PLATFORM_NAME,
        dashboardContent: (configMap.dashboard_content as DashboardContentConfig) || {},
      };
    },
  });

  // Update state when data loads
  useEffect(() => {
    if (data) {
      setPlatformName(data.platformName || DEFAULT_PLATFORM_NAME);
      setConfig({ ...DEFAULT_DASHBOARD_CONTENT, ...data.dashboardContent });
      setHasChanges(false);
    }
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: async (payload: { platformName: string; config: DashboardContentConfig }) => {
      const updates = [
        {
          key: "platform_name",
          value: payload.platformName,
          description: "Platform name used in UI and emails",
          updated_at: new Date().toISOString(),
        },
        {
          key: "dashboard_content",
          value: payload.config,
          description: "Dashboard content and visibility settings (earners guide, guides, social links)",
          updated_at: new Date().toISOString(),
        },
      ];

      const { error } = await supabase
        .from("platform_config")
        .upsert(updates, { onConflict: "key" });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dashboard-content-settings"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-content"] });
      setHasChanges(false);
      toast({
        title: t("admin.contentManagement.dashboardContent.settingsSaved"),
        description: t("admin.contentManagement.dashboardContent.settingsSavedDescription"),
      });
    },
    onError: (error: any) => {
      toast({
        title: t("admin.contentManagement.dashboardContent.errorSaving"),
        description: error.message || t("admin.contentManagement.dashboardContent.errorSavingDescription"),
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    saveMutation.mutate({ platformName, config });
  };

  const handleReset = () => {
    setPlatformName(DEFAULT_PLATFORM_NAME);
    setConfig(DEFAULT_DASHBOARD_CONTENT);
    setHasChanges(true);
  };

  const updateConfig = (updates: Partial<DashboardContentConfig>) => {
    setConfig((prev) => ({ ...prev, ...updates }));
    setHasChanges(true);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <LoadingSpinner size="lg" text={t("common.loading")} />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <LayoutDashboard className="h-8 w-8 text-primary" />
          {t("admin.contentManagement.dashboardContent.title")}
        </h1>
        <p className="text-muted-foreground mt-2">
          {t("admin.contentManagement.dashboardContent.subtitle")}
        </p>
      </div>

      {/* Platform Name */}
      <Card>
        <CardHeader>
          <CardTitle>{t("admin.contentManagement.dashboardContent.platformName.title")}</CardTitle>
          <CardDescription>
            {t("admin.contentManagement.dashboardContent.platformName.description")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="platformName">{t("admin.contentManagement.dashboardContent.platformName.label")}</Label>
            <Input
              id="platformName"
              value={platformName}
              onChange={(e) => {
                setPlatformName(e.target.value);
                setHasChanges(true);
              }}
              placeholder="ProfitChips"
            />
          </div>
        </CardContent>
      </Card>

      {/* Earners Guide Section */}
      <Card>
        <CardHeader>
          <CardTitle>{t("admin.contentManagement.dashboardContent.earnersGuide.title")}</CardTitle>
          <CardDescription>
            {t("admin.contentManagement.dashboardContent.earnersGuide.description")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="space-y-0.5">
              <Label htmlFor="earnersGuideVisible" className="text-base font-semibold">
                {t("admin.contentManagement.dashboardContent.earnersGuide.showLabel")}
              </Label>
              <p className="text-sm text-muted-foreground">
                {t("admin.contentManagement.dashboardContent.earnersGuide.showDescription", { platformName })}
              </p>
            </div>
            <Switch
              id="earnersGuideVisible"
              checked={config.earnersGuide.isVisible}
              onCheckedChange={(checked) =>
                updateConfig({ earnersGuide: { ...config.earnersGuide, isVisible: checked } })
              }
            />
          </div>
        </CardContent>
      </Card>

      {/* Deposit & Withdrawal Guides Section */}
      <Card>
        <CardHeader>
          <CardTitle>{t("admin.contentManagement.dashboardContent.guidesSection.title")}</CardTitle>
          <CardDescription>
            {t("admin.contentManagement.dashboardContent.guidesSection.description")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="space-y-0.5">
              <Label htmlFor="guidesVisible" className="text-base font-semibold">
                {t("admin.contentManagement.dashboardContent.guidesSection.showLabel")}
              </Label>
              <p className="text-sm text-muted-foreground">
                {t("admin.contentManagement.dashboardContent.guidesSection.showDescription")}
              </p>
            </div>
            <Switch
              id="guidesVisible"
              checked={config.guidesSection.isVisible}
              onCheckedChange={(checked) =>
                updateConfig({ guidesSection: { ...config.guidesSection, isVisible: checked } })
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="guidesTitle">{t("admin.contentManagement.dashboardContent.guidesSection.titleLabel")}</Label>
            <Input
              id="guidesTitle"
              value={config.guidesSection.title}
              onChange={(e) =>
                updateConfig({ guidesSection: { ...config.guidesSection, title: e.target.value } })
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="guidesDescription">{t("admin.contentManagement.dashboardContent.guidesSection.descriptionLabel")}</Label>
            <Textarea
              id="guidesDescription"
              value={config.guidesSection.description}
              onChange={(e) =>
                updateConfig({ guidesSection: { ...config.guidesSection, description: e.target.value } })
              }
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      {/* Social Links Section */}
      <Card>
        <CardHeader>
          <CardTitle>{t("admin.contentManagement.dashboardContent.socialSection.title")}</CardTitle>
          <CardDescription>
            {t("admin.contentManagement.dashboardContent.socialSection.description")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="space-y-0.5">
              <Label htmlFor="socialVisible" className="text-base font-semibold">
                {t("admin.contentManagement.dashboardContent.socialSection.showLabel")}
              </Label>
              <p className="text-sm text-muted-foreground">
                {t("admin.contentManagement.dashboardContent.socialSection.showDescription")}
              </p>
            </div>
            <Switch
              id="socialVisible"
              checked={config.socialSection.isVisible}
              onCheckedChange={(checked) =>
                updateConfig({ socialSection: { ...config.socialSection, isVisible: checked } })
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="facebookUrl">{t("admin.contentManagement.dashboardContent.socialSection.facebookUrl")}</Label>
            <Input
              id="facebookUrl"
              value={config.socialSection.facebookUrl}
              onChange={(e) =>
                updateConfig({ socialSection: { ...config.socialSection, facebookUrl: e.target.value } })
              }
              placeholder="https://facebook.com/yourpage"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="instagramUrl">{t("admin.contentManagement.dashboardContent.socialSection.instagramUrl")}</Label>
            <Input
              id="instagramUrl"
              value={config.socialSection.instagramUrl}
              onChange={(e) =>
                updateConfig({ socialSection: { ...config.socialSection, instagramUrl: e.target.value } })
              }
              placeholder="https://www.instagram.com/yourhandle/"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="tiktokUrl">{t("admin.contentManagement.dashboardContent.socialSection.tiktokUrl")}</Label>
            <Input
              id="tiktokUrl"
              value={config.socialSection.tiktokUrl}
              onChange={(e) =>
                updateConfig({ socialSection: { ...config.socialSection, tiktokUrl: e.target.value } })
              }
              placeholder="https://www.tiktok.com/@yourhandle"
            />
          </div>
        </CardContent>
      </Card>

      {/* Actions & Status */}
      <Card>
        <CardContent className="flex items-center justify-between gap-4 py-4">
          <div className="space-y-1 text-sm text-muted-foreground">
            <p>
              {t("admin.contentManagement.dashboardContent.changesApplied")}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={handleReset}
              disabled={saveMutation.isPending}
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              {t("admin.contentManagement.dashboardContent.resetToDefaults")}
            </Button>
            <Button
              onClick={handleSave}
              disabled={!hasChanges || saveMutation.isPending}
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
                {t("admin.contentManagement.dashboardContent.successMessage")}
              </AlertDescription>
            </Alert>
          </CardContent>
        )}

        {saveMutation.isError && (
          <CardContent className="pt-0">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {t("admin.contentManagement.dashboardContent.errorMessage")}
              </AlertDescription>
            </Alert>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
