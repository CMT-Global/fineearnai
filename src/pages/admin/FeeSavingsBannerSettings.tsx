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
import { Zap, RotateCcw, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { PageLoading } from "@/components/shared/PageLoading";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useTranslation } from "react-i18next";
import { useLanguageSync } from "@/hooks/useLanguageSync";

interface FeeSavingsBannerConfig {
  isVisible: boolean;
  title: string;
  subtitle: string;
  recommendedBadge: string;
  option1: {
    label: string;
    icon: string;
  };
  option2: {
    label: string;
    icon: string;
  };
  highlightText: string;
  benefitsText: string;
  footerText: string;
}

const DEFAULT_CONFIG: FeeSavingsBannerConfig = {
  isVisible: true,
  title: "⚡ Save on Fees!",
  subtitle: "For the best experience, deposit using",
  recommendedBadge: "Recommended",
  option1: {
    label: "⚡ USDC (Solana network)",
    icon: "⚡"
  },
  option2: {
    label: "🚀 USDT - BEP20 (BSC Network)",
    icon: "🚀"
  },
  highlightText: "— especially for GCash/GCrypto users.",
  benefitsText: "You'll enjoy ultra-low fees and faster confirmations.",
  footerText: "WE SUPPORT ALL OTHER COINS, YOU CAN CHOOSE ANY COIN."
};

export default function FeeSavingsBannerSettings() {
  const { t } = useTranslation();
  useLanguageSync(); // Sync language and force re-render when language changes
  
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [config, setConfig] = useState<FeeSavingsBannerConfig>(DEFAULT_CONFIG);
  const [hasChanges, setHasChanges] = useState(false);

  // Fetch fee savings banner config
  const { data: configData, isLoading } = useQuery({
    queryKey: ['fee-savings-banner-config'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('platform_config')
        .select('value')
        .eq('key', 'fee_savings_banner')
        .maybeSingle();

      if (error) throw error;
      return (data?.value as unknown) as FeeSavingsBannerConfig | null;
    },
  });

  // Update config when data loads
  useEffect(() => {
    if (configData) {
      setConfig({ ...DEFAULT_CONFIG, ...configData });
      setHasChanges(false);
    }
  }, [configData]);

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async (newConfig: FeeSavingsBannerConfig) => {
      const { error } = await supabase
        .from('platform_config')
        .upsert({
          key: 'fee_savings_banner',
          value: newConfig as any,
          description: 'Configuration for the fee savings banner shown on wallet page and deposit dialog',
          updated_at: new Date().toISOString(),
        }, { onConflict: 'key' });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fee-savings-banner-config'] });
      setHasChanges(false);
      toast({
        title: t("admin.contentManagement.feeSavingsBanner.settingsSaved"),
        description: t("admin.contentManagement.feeSavingsBanner.settingsSavedDescription"),
      });
    },
    onError: (error: any) => {
      toast({
        title: t("admin.contentManagement.feeSavingsBanner.errorSaving"),
        description: error.message || t("admin.contentManagement.feeSavingsBanner.errorSavingDescription"),
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    saveMutation.mutate(config);
  };

  const handleReset = () => {
    setConfig(DEFAULT_CONFIG);
    setHasChanges(true);
  };

  const updateConfig = (updates: Partial<FeeSavingsBannerConfig>) => {
    setConfig((prev) => ({ ...prev, ...updates }));
    setHasChanges(true);
  };

  if (isLoading) {
    return <PageLoading text={t("admin.loadingPanel")} />;
  }

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Zap className="h-8 w-8 text-amber-600" />
            {t("admin.contentManagement.feeSavingsBanner.title")}
          </h1>
          <p className="text-muted-foreground mt-2">
            {t("admin.contentManagement.feeSavingsBanner.subtitle")}
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{t("admin.contentManagement.feeSavingsBanner.configuration.title")}</CardTitle>
            <CardDescription>
              {t("admin.contentManagement.feeSavingsBanner.configuration.description")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Visibility Toggle */}
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="space-y-0.5">
                <Label htmlFor="isVisible" className="text-base font-semibold">
                  {t("admin.contentManagement.feeSavingsBanner.configuration.showBanner")}
                </Label>
                <p className="text-sm text-muted-foreground">
                  {t("admin.contentManagement.feeSavingsBanner.configuration.showBannerDescription")}
                </p>
              </div>
              <Switch
                id="isVisible"
                checked={config.isVisible}
                onCheckedChange={(checked) => updateConfig({ isVisible: checked })}
              />
            </div>

            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="title">{t("admin.contentManagement.feeSavingsBanner.configuration.bannerTitle")}</Label>
              <Input
                id="title"
                value={config.title}
                onChange={(e) => updateConfig({ title: e.target.value })}
                placeholder="⚡ Save on Fees!"
              />
            </div>

            {/* Recommended Badge */}
            <div className="space-y-2">
              <Label htmlFor="recommendedBadge">{t("admin.contentManagement.feeSavingsBanner.configuration.recommendedBadge")}</Label>
              <Input
                id="recommendedBadge"
                value={config.recommendedBadge}
                onChange={(e) => updateConfig({ recommendedBadge: e.target.value })}
                placeholder="Recommended"
              />
            </div>

            {/* Subtitle */}
            <div className="space-y-2">
              <Label htmlFor="subtitle">{t("admin.contentManagement.feeSavingsBanner.configuration.subtitle")}</Label>
              <Input
                id="subtitle"
                value={config.subtitle}
                onChange={(e) => updateConfig({ subtitle: e.target.value })}
                placeholder="For the best experience, deposit using"
              />
            </div>

            {/* Option 1 */}
            <div className="space-y-4 p-4 border rounded-lg">
              <Label className="text-base font-semibold">{t("admin.contentManagement.feeSavingsBanner.configuration.firstPaymentOption")}</Label>
              <div className="space-y-2">
                <Label htmlFor="option1-label">{t("admin.contentManagement.feeSavingsBanner.configuration.optionLabel")}</Label>
                <Input
                  id="option1-label"
                  value={config.option1.label}
                  onChange={(e) => updateConfig({ 
                    option1: { ...config.option1, label: e.target.value }
                  })}
                  placeholder="⚡ USDC (Solana network)"
                />
              </div>
            </div>

            {/* Option 2 */}
            <div className="space-y-4 p-4 border rounded-lg">
              <Label className="text-base font-semibold">{t("admin.contentManagement.feeSavingsBanner.configuration.secondPaymentOption")}</Label>
              <div className="space-y-2">
                <Label htmlFor="option2-label">{t("admin.contentManagement.feeSavingsBanner.configuration.optionLabel")}</Label>
                <Input
                  id="option2-label"
                  value={config.option2.label}
                  onChange={(e) => updateConfig({ 
                    option2: { ...config.option2, label: e.target.value }
                  })}
                  placeholder="🚀 USDT - BEP20 (BSC Network)"
                />
              </div>
            </div>

            {/* Highlight Text */}
            <div className="space-y-2">
              <Label htmlFor="highlightText">{t("admin.contentManagement.feeSavingsBanner.configuration.highlightText")}</Label>
              <Input
                id="highlightText"
                value={config.highlightText}
                onChange={(e) => updateConfig({ highlightText: e.target.value })}
                placeholder="— especially for GCash/GCrypto users."
              />
            </div>

            {/* Benefits Text */}
            <div className="space-y-2">
              <Label htmlFor="benefitsText">{t("admin.contentManagement.feeSavingsBanner.configuration.benefitsText")}</Label>
              <Textarea
                id="benefitsText"
                value={config.benefitsText}
                onChange={(e) => updateConfig({ benefitsText: e.target.value })}
                placeholder="You'll enjoy ultra-low fees and faster confirmations."
                rows={3}
              />
            </div>

            {/* Footer Text */}
            <div className="space-y-2">
              <Label htmlFor="footerText">{t("admin.contentManagement.feeSavingsBanner.configuration.footerText")}</Label>
              <Textarea
                id="footerText"
                value={config.footerText}
                onChange={(e) => updateConfig({ footerText: e.target.value })}
                placeholder="WE SUPPORT ALL OTHER COINS, YOU CAN CHOOSE ANY COIN."
                rows={2}
              />
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-between pt-4 border-t">
              <Button
                variant="outline"
                onClick={handleReset}
                disabled={saveMutation.isPending}
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                {t("admin.contentManagement.feeSavingsBanner.resetToDefaults")}
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

            {saveMutation.isSuccess && (
              <Alert>
                <CheckCircle2 className="h-4 w-4" />
                <AlertDescription>
                  {t("admin.contentManagement.feeSavingsBanner.successMessage")}
                </AlertDescription>
              </Alert>
            )}

            {saveMutation.isError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  {t("admin.contentManagement.feeSavingsBanner.errorMessage")}
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      </div>
  );
}
