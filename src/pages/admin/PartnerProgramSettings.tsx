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
import { Loader2, Sparkles, RotateCcw, AlertCircle, CheckCircle2, Users } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface PartnerWizardSlideConfig {
  id: number;
  title: string;
  headline: string;
  body: string;
}

interface PartnerProgramContentConfig {
  wizard: {
    isEnabled: boolean;
    slides: PartnerWizardSlideConfig[];
  };
}

interface PartnerProgramConfig {
  isEnabled: boolean;
}

const DEFAULT_PARTNER_PROGRAM_CONFIG: PartnerProgramConfig = {
  isEnabled: true,
};

const DEFAULT_PARTNER_PROGRAM_CONTENT: PartnerProgramContentConfig = {
  wizard: {
    isEnabled: true,
    slides: [
      {
        id: 1,
        title: "Unlock Your Earning Potential",
        headline: "Become a Local Partner",
        body:
          "Become a Local Partner in your country and start earning by helping people in your community learn more about the platform and upgrade their accounts with local support.",
      },
      {
        id: 2,
        title: "How Regular Users Benefit",
        headline: "How Regular Users Benefit",
        body:
          "Our Partner Network makes it easier than ever for our users to grow and succeed with local payment options and personal support.",
      },
      {
        id: 3,
        title: "What Do Local Partners Do?",
        headline: "Your Role is Simple & Profitable",
        body:
          "Connect with users who want to upgrade, provide local support and guidance, sell vouchers seamlessly, and earn while helping others grow.",
      },
      {
        id: 4,
        title: "How Users Benefit & You Profit",
        headline: "The Secure Agent Deposit Flow",
        body:
          "See how users upgrade safely through you while you earn guaranteed profit using the secure voucher and deposit flow.",
      },
      {
        id: 5,
        title: "How You Make Money",
        headline: "Crystal Clear Earnings",
        body:
          "Understand exactly how much you earn per voucher and how your daily voucher sales scale into strong weekly income.",
      },
      {
        id: 6,
        title: "Ready to Start Earning?",
        headline: "You're Almost There!",
        body:
          "Join our growing network of successful partners earning daily income. The application takes less than 2 minutes.",
      },
    ],
  },
};

export default function PartnerProgramSettings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [programConfig, setProgramConfig] = useState<PartnerProgramConfig>(DEFAULT_PARTNER_PROGRAM_CONFIG);
  const [contentConfig, setContentConfig] = useState<PartnerProgramContentConfig>(DEFAULT_PARTNER_PROGRAM_CONTENT);
  const [hasChanges, setHasChanges] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["partner-program-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("platform_config")
        .select("key, value")
        .in("key", ["partner_program_config", "partner_program_content"]);

      if (error) throw error;

      const map = new Map<string, any>();
      data?.forEach((row: any) => {
        map.set(row.key, row.value);
      });

      const program = (map.get("partner_program_config") as PartnerProgramConfig) || DEFAULT_PARTNER_PROGRAM_CONFIG;
      const content =
        (map.get("partner_program_content") as PartnerProgramContentConfig) || DEFAULT_PARTNER_PROGRAM_CONTENT;

      return { program, content };
    },
  });

  useEffect(() => {
    if (data) {
      const mergedSlides = DEFAULT_PARTNER_PROGRAM_CONTENT.wizard.slides.map((defaultSlide) => {
        const existing = data.content.wizard?.slides?.find((s: PartnerWizardSlideConfig) => s.id === defaultSlide.id);
        return { ...defaultSlide, ...(existing || {}) };
      });

      setProgramConfig({
        isEnabled: data.program.isEnabled ?? true,
      });

      setContentConfig({
        wizard: {
          isEnabled: data.content.wizard?.isEnabled ?? true,
          slides: mergedSlides,
        },
      });

      setHasChanges(false);
    }
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: async (payload: { program: PartnerProgramConfig; content: PartnerProgramContentConfig }) => {
      const updates = [
        {
          key: "partner_program_config",
          value: payload.program,
          description: "Partner program global settings (enable/disable)",
          updated_at: new Date().toISOString(),
        },
        {
          key: "partner_program_content",
          value: payload.content,
          description: "Content configuration for Become a Partner wizard (high-level copy)",
          updated_at: new Date().toISOString(),
        },
      ];

      const { error } = await supabase.from("platform_config").upsert(updates, { onConflict: "key" });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["partner-program-settings"] });
      queryClient.invalidateQueries({ queryKey: ["sidebar-platform-config"] });
      queryClient.invalidateQueries({ queryKey: ["partner-program-content"] });
      setHasChanges(false);
      toast({
        title: "Settings saved",
        description: "Partner program settings have been updated successfully.",
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
    saveMutation.mutate({ program: programConfig, content: contentConfig });
  };

  const handleReset = () => {
    setProgramConfig(DEFAULT_PARTNER_PROGRAM_CONFIG);
    setContentConfig(DEFAULT_PARTNER_PROGRAM_CONTENT);
    setHasChanges(true);
  };

  const updateProgramConfig = (updates: Partial<PartnerProgramConfig>) => {
    setProgramConfig((prev) => ({ ...prev, ...updates }));
    setHasChanges(true);
  };

  const updateSlide = (id: number, updates: Partial<PartnerWizardSlideConfig>) => {
    setContentConfig((prev) => ({
      wizard: {
        ...prev.wizard,
        slides: prev.wizard.slides.map((slide) => (slide.id === id ? { ...slide, ...updates } : slide)),
      },
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
          <Users className="h-8 w-8 text-primary" />
          Partner Program Settings
        </h1>
        <p className="text-muted-foreground mt-2">
          Enable or disable the partner program and edit the content shown in the Become a Partner wizard.
        </p>
      </div>

      {/* Global Partner Program Toggle */}
      <Card>
        <CardHeader>
          <CardTitle>Partner Program Availability</CardTitle>
          <CardDescription>Control whether the Partner program appears in the user sidebar and routes.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="space-y-0.5">
              <Label htmlFor="partnerProgramEnabled" className="text-base font-semibold">
                Enable Partner Program
              </Label>
              <p className="text-sm text-muted-foreground">
                When disabled, the Become a Partner option is hidden from the user menu and users cannot access the
                partner onboarding pages.
              </p>
            </div>
            <Switch
              id="partnerProgramEnabled"
              checked={programConfig.isEnabled}
              onCheckedChange={(checked) => updateProgramConfig({ isEnabled: checked })}
            />
          </div>
        </CardContent>
      </Card>

      {/* Wizard Content */}
      <Card>
        <CardHeader>
          <CardTitle>Wizard Visibility</CardTitle>
          <CardDescription>
            Control whether the introductory wizard is shown before the application form on the Become a Partner page.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="space-y-0.5">
              <Label htmlFor="wizardEnabled" className="text-base font-semibold">
                Show Intro Wizard
              </Label>
              <p className="text-sm text-muted-foreground">
                If disabled, users will go directly to the application form without seeing the intro wizard.
              </p>
            </div>
            <Switch
              id="wizardEnabled"
              checked={contentConfig.wizard.isEnabled}
              onCheckedChange={(checked) =>
                setContentConfig((prev) => ({
                  wizard: {
                    ...prev.wizard,
                    isEnabled: checked,
                  },
                }))
              }
            />
          </div>
        </CardContent>
      </Card>

      {contentConfig.wizard.slides.map((slide) => (
        <Card key={slide.id}>
          <CardHeader>
            <CardTitle>
              Slide {slide.id}: {slide.title || "(Untitled)"}
            </CardTitle>
            <CardDescription>Edit the main copy for this step of the Become a Partner wizard.</CardDescription>
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
              <Label htmlFor={`headline-${slide.id}`}>Headline</Label>
              <Input
                id={`headline-${slide.id}`}
                value={slide.headline}
                onChange={(e) => updateSlide(slide.id, { headline: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`body-${slide.id}`}>Body</Label>
              <Textarea
                id={`body-${slide.id}`}
                value={slide.body}
                onChange={(e) => updateSlide(slide.id, { body: e.target.value })}
                rows={4}
              />
            </div>
          </CardContent>
        </Card>
      ))}

      <Card>
        <CardContent className="flex items-center justify-between gap-4 py-4">
          <div className="space-y-1 text-sm text-muted-foreground">
            <p>Changes are applied to the user Partner flow immediately after saving.</p>
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
                Settings saved successfully! Users will see updated content in the Become a Partner wizard.
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

