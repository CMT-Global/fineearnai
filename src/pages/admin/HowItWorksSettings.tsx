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
import { Loader2, Info, RotateCcw, AlertCircle, CheckCircle2, ListChecks } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

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
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [platformName, setPlatformName] = useState<string>(DEFAULT_PLATFORM_NAME);
  const [config, setConfig] = useState<HowItWorksContentConfig>(DEFAULT_HOW_IT_WORKS_CONTENT);
  const [hasChanges, setHasChanges] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["how-it-works-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("platform_config")
        .select("key, value")
        .in("key", ["platform_name", "how_it_works_content"]);

      if (error) throw error;

      const map = new Map<string, any>();
      data?.forEach((row: any) => {
        map.set(row.key, row.value);
      });

      const platformName = (map.get("platform_name") as string) || DEFAULT_PLATFORM_NAME;
      const howItWorks = (map.get("how_it_works_content") as HowItWorksContentConfig) || DEFAULT_HOW_IT_WORKS_CONTENT;

      return {
        platformName,
        howItWorks,
      };
    },
  });

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
          value: newConfig,
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
        title: "Settings saved",
        description: "How It Works page content has been updated successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error saving settings",
        description: error.message || "Failed to save settings. Please try again.",
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
      <div className="container mx-auto px-4 py-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <ListChecks className="h-8 w-8 text-primary" />
          How It Works Page Settings
        </h1>
        <p className="text-muted-foreground mt-2">
          Manage visibility and copy for each slide of the How It Works tour.
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Current platform name: <span className="font-semibold">{platformName}</span> (editable on Dashboard Content
          page).
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Page Visibility</CardTitle>
          <CardDescription>Control whether users can access the How It Works page.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="space-y-0.5">
              <Label htmlFor="howItWorksVisible" className="text-base font-semibold">
                Show How It Works Page
              </Label>
              <p className="text-sm text-muted-foreground">
                When disabled, users who open the How It Works page will be redirected back to the dashboard.
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
            <CardTitle>
              Slide {slide.id}: {slide.title || "(Untitled)"}
            </CardTitle>
            <CardDescription>Edit the title, subtitle, and main description for this step.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor={`title-${slide.id}`}>Title</Label>
              <Input
                id={`title-${slide.id}`}
                value={slide.title}
                onChange={(e) => updateSlide(slide.id, { title: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`subtitle-${slide.id}`}>Subtitle</Label>
              <Input
                id={`subtitle-${slide.id}`}
                value={slide.subtitle}
                onChange={(e) => updateSlide(slide.id, { subtitle: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`description-${slide.id}`}>Description</Label>
              <Textarea
                id={`description-${slide.id}`}
                value={slide.description}
                onChange={(e) => updateSlide(slide.id, { description: e.target.value })}
                rows={4}
              />
              <p className="text-xs text-muted-foreground">
                Tip: You can include the platform name manually (e.g. "{platformName}") in this text if you like.
              </p>
            </div>
          </CardContent>
        </Card>
      ))}

      <Card>
        <CardContent className="flex items-center justify-between gap-4 py-4">
          <div className="space-y-1 text-sm text-muted-foreground">
            <p>Changes are applied to the How It Works page immediately after saving.</p>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={handleReset} disabled={saveMutation.isPending}>
              <RotateCcw className="h-4 w-4 mr-2" />
              Reset to Defaults
            </Button>
            <Button onClick={handleSave} disabled={!hasChanges || saveMutation.isPending}>
              {saveMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Save Changes
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
                Settings saved successfully! Users will see updated content on the How It Works page.
              </AlertDescription>
            </Alert>
          </CardContent>
        )}

        {saveMutation.isError && (
          <CardContent className="pt-0">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>Failed to save settings. Please try again.</AlertDescription>
            </Alert>
          </CardContent>
        )}
      </Card>
    </div>
  );
}


