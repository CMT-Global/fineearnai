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
import { Info, RotateCcw, AlertCircle, CheckCircle2, ListChecks, Loader2 } from "lucide-react";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useTranslation } from "react-i18next";
import { useLanguageSync } from "@/hooks/useLanguageSync";

interface HowItWorksSlideConfig {
  id: number;
  title: string;
  subtitle: string;
  description: string;
}

interface HowItWorksContentConfig {
  isVisible: boolean;
  slides: HowItWorksSlideConfig[];
}

const DEFAULT_PLATFORM_NAME = "ProfitChips";

const DEFAULT_HOW_IT_WORKS_CONTENT: HowItWorksContentConfig = {
  isVisible: true,
  slides: [
    {
      id: 1,
      title: "What Is ProfitChips?",
      subtitle: "Your Gateway to Earning with AI",
      description:
        "ProfitChips is a revolutionary platform that connects you with AI training tasks, enabling you to earn real money by contributing to the advancement of artificial intelligence.",
    },
    {
      id: 2,
      title: "How You Earn",
      subtitle: "Simple Tasks, Real Rewards",
      description:
        "Every task you complete correctly earns you money that goes directly into your earnings wallet. Your earning rate depends on your membership plan.",
    },
    {
      id: 3,
      title: "Types of Tasks",
      subtitle: "Variety of AI Microtasks",
      description:
        "ProfitChips offers diverse AI training tasks that help improve machine learning models. Each task is simple but contributes to advancing AI technology.",
    },
    {
      id: 4,
      title: "When You Get Paid",
      subtitle: "Real-Time Tracking & Weekly Payouts",
      description:
        "Your earnings are tracked in real-time and available for withdrawal on designated payout days. Watch your wallet grow with every completed task!",
    },
    {
      id: 5,
      title: "Withdrawals",
      subtitle: "Easy & Convenient Cashouts",
      description:
        "Withdrawing your earnings is simple and secure. Choose from multiple payment methods and receive your money quickly.",
    },
    {
      id: 6,
      title: "Upgrading Your Account",
      subtitle: "Boost Your Earning Potential",
      description:
        "Upgrade your membership to unlock higher earnings, more daily tasks, and exclusive benefits. Invest in your earning potential today!",
    },
    {
      id: 7,
      title: "Invite & Earn",
      subtitle: "Build Your Team",
      description:
        "Grow your income by referring others to ProfitChips. Earn commissions from your referrals' activities and build a sustainable passive income stream.",
    },
    {
      id: 8,
      title: "Ready to Start?",
      subtitle: "Begin Your Journey",
      description:
        "You're all set! Head to your dashboard to start completing tasks and earning money. Remember to check out the membership plans to maximize your earning potential.",
    },
  ],
};

export default function HowItWorksSettings() {
  const { t } = useTranslation();
  useLanguageSync(); // Sync language and force re-render when language changes
  
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [platformName, setPlatformName] = useState<string>(DEFAULT_PLATFORM_NAME);
  const [config, setConfig] = useState<HowItWorksContentConfig>(DEFAULT_HOW_IT_WORKS_CONTENT);
  const [hasChanges, setHasChanges] = useState(false);

  // Fetch platform config data
  const { data, isLoading } = useQuery({
    queryKey: ["how-it-works-settings"],
    queryFn: async () => {
      const { data: configData, error } = await supabase
        .from("platform_config")
        .select("key, value")
        .in("key", ["platform_name", "how_it_works_content"]);

      if (error) throw error;

      const configMap: Record<string, any> = {};
      configData?.forEach((row: any) => {
        configMap[row.key] = row.value;
      });

      return {
        platformName: (configMap.platform_name as string) || DEFAULT_PLATFORM_NAME,
        howItWorks: (configMap.how_it_works_content as HowItWorksContentConfig) || DEFAULT_HOW_IT_WORKS_CONTENT,
      };
    },
  });

  // Update state when data loads
  useEffect(() => {
    if (data) {
      setPlatformName(data.platformName || DEFAULT_PLATFORM_NAME);
      // Merge with defaults to ensure all slides exist
      const mergedSlides = DEFAULT_HOW_IT_WORKS_CONTENT.slides.map((defaultSlide) => {
        const existing = data.howItWorks.slides?.find((s) => s.id === defaultSlide.id);
        return { ...defaultSlide, ...(existing || {}) };
      });

      setConfig({
        isVisible: data.howItWorks.isVisible ?? true,
        slides: mergedSlides,
      });
      setHasChanges(false);
    }
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: async (newConfig: HowItWorksContentConfig) => {
      const { error } = await supabase.from("platform_config").upsert(
        {
          key: "how_it_works_content",
          value: newConfig as unknown as Json,
          description: "How It Works page content (visibility and per-slide copy)",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "key" }
      );

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["how-it-works-settings"] });
      queryClient.invalidateQueries({ queryKey: ["how-it-works-content"] });
      setHasChanges(false);
      toast({
        title: t("admin.contentManagement.howItWorks.settingsSaved"),
        description: t("admin.contentManagement.howItWorks.settingsSavedDescription"),
      });
    },
    onError: (error: any) => {
      toast({
        title: t("admin.contentManagement.howItWorks.errorSaving"),
        description: error.message || t("admin.contentManagement.howItWorks.errorSavingDescription"),
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    saveMutation.mutate(config);
  };

  const handleReset = () => {
    setConfig(DEFAULT_HOW_IT_WORKS_CONTENT);
    setHasChanges(true);
  };

  const updateConfig = (updates: Partial<HowItWorksContentConfig>) => {
    setConfig((prev) => ({ ...prev, ...updates }));
    setHasChanges(true);
  };

  const updateSlide = (id: number, updates: Partial<HowItWorksSlideConfig>) => {
    setConfig((prev) => ({
      ...prev,
      slides: prev.slides.map((slide) => (slide.id === id ? { ...slide, ...updates } : slide)),
    }));
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
    <div className="container mx-auto px-4 py-8 space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2 break-words">
          <ListChecks className="h-8 w-8 text-primary shrink-0" />
          <span className="break-words">{t("admin.contentManagement.howItWorks.title")}</span>
        </h1>
        <p className="text-muted-foreground mt-2 break-words">
          {t("admin.contentManagement.howItWorks.subtitle")}
        </p>
        <p className="text-xs text-muted-foreground mt-1 break-words">
          {t("admin.contentManagement.howItWorks.platformNameNote", { platformName })}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="break-words">{t("admin.contentManagement.howItWorks.pageVisibility.title")}</CardTitle>
          <CardDescription className="break-words">{t("admin.contentManagement.howItWorks.pageVisibility.description")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 border rounded-lg gap-4">
            <div className="space-y-0.5">
              <Label htmlFor="howItWorksVisible" className="text-base font-semibold break-words">
                {t("admin.contentManagement.howItWorks.pageVisibility.showLabel")}
              </Label>
              <p className="text-sm text-muted-foreground break-words">
                {t("admin.contentManagement.howItWorks.pageVisibility.showDescription")}
              </p>
            </div>
            <Switch
              id="howItWorksVisible"
              checked={config.isVisible}
              onCheckedChange={(checked) => updateConfig({ isVisible: checked })}
            />
          </div>
        </CardContent>
      </Card>

      {config.slides.map((slide) => (
        <Card key={slide.id}>
          <CardHeader>
            <CardTitle className="break-words">
              {t("admin.contentManagement.howItWorks.slideTitle", { number: slide.id, title: slide.title || t("admin.contentManagement.howItWorks.untitled") })}
            </CardTitle>
            <CardDescription className="break-words">{t("admin.contentManagement.howItWorks.slideDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor={`title-${slide.id}`}>{t("admin.contentManagement.howItWorks.titleLabel")}</Label>
              <Input
                id={`title-${slide.id}`}
                value={slide.title}
                onChange={(e) => updateSlide(slide.id, { title: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`subtitle-${slide.id}`}>{t("admin.contentManagement.howItWorks.subtitleLabel")}</Label>
              <Input
                id={`subtitle-${slide.id}`}
                value={slide.subtitle}
                onChange={(e) => updateSlide(slide.id, { subtitle: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`description-${slide.id}`}>{t("admin.contentManagement.howItWorks.descriptionLabel")}</Label>
              <Textarea
                id={`description-${slide.id}`}
                value={slide.description}
                onChange={(e) => updateSlide(slide.id, { description: e.target.value })}
                rows={4}
              />
              <p className="text-xs text-muted-foreground">
                {t("admin.contentManagement.howItWorks.platformNameTip", { platformName })}
              </p>
            </div>
          </CardContent>
        </Card>
      ))}

      <Card>
        <CardContent className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 py-4">
          <div className="space-y-1 text-sm text-muted-foreground">
            <p>{t("admin.contentManagement.howItWorks.changesApplied")}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
            <Button variant="outline" onClick={handleReset} disabled={saveMutation.isPending} className="flex-1 sm:flex-none">
              <RotateCcw className="h-4 w-4 mr-2" />
              {t("admin.contentManagement.howItWorks.resetToDefaults")}
            </Button>
            <Button onClick={handleSave} disabled={!hasChanges || saveMutation.isPending} className="flex-1 sm:flex-none">
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
                {t("admin.contentManagement.howItWorks.successMessage")}
              </AlertDescription>
            </Alert>
          </CardContent>
        )}

        {saveMutation.isError && (
          <CardContent className="pt-0">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{t("admin.contentManagement.howItWorks.errorMessage")}</AlertDescription>
            </Alert>
          </CardContent>
        )}
      </Card>
    </div>
  );
}


