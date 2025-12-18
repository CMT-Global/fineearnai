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
import { Loader2, LayoutDashboard, RotateCcw, AlertCircle, CheckCircle2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

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
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [platformName, setPlatformName] = useState<string>(DEFAULT_PLATFORM_NAME);
  const [config, setConfig] = useState<DashboardContentConfig>(DEFAULT_DASHBOARD_CONTENT);
  const [hasChanges, setHasChanges] = useState(false);

  // Fetch platform name + dashboard content in one query
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard-content-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("platform_config")
        .select("key, value")
        .in("key", ["platform_name", "dashboard_content"]);

      if (error) throw error;

      const map = new Map<string, any>();
      data?.forEach((row: any) => {
        map.set(row.key, row.value);
      });

      return {
        platformName: (map.get("platform_name") as string) || DEFAULT_PLATFORM_NAME,
        dashboardContent: (map.get("dashboard_content") as DashboardContentConfig) || DEFAULT_DASHBOARD_CONTENT,
      };
    },
  });

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
        title: "Settings saved",
        description: "Dashboard content settings have been updated successfully.",
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
          <LayoutDashboard className="h-8 w-8 text-primary" />
          Dashboard Content Settings
        </h1>
        <p className="text-muted-foreground mt-2">
          Manage platform name and key content sections shown on the user dashboard.
        </p>
      </div>

      {/* Platform Name */}
      <Card>
        <CardHeader>
          <CardTitle>Platform Name</CardTitle>
          <CardDescription>
            This name is used across the app (including the Earners Guide banner) and in outgoing emails.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="platformName">Platform Name</Label>
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
          <CardTitle>Earners Guide Banner</CardTitle>
          <CardDescription>
            Controls the blue Earners Guide banner on the dashboard.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="space-y-0.5">
              <Label htmlFor="earnersGuideVisible" className="text-base font-semibold">
                Show Earners Guide Banner
              </Label>
              <p className="text-sm text-muted-foreground">
                When enabled, users will see the "{platformName} - Earners Guide" banner on the dashboard.
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
          <CardTitle>Deposit & Withdrawal Guides</CardTitle>
          <CardDescription>
            Controls the guides card and its text on the dashboard.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="space-y-0.5">
              <Label htmlFor="guidesVisible" className="text-base font-semibold">
                Show Guides Section
              </Label>
              <p className="text-sm text-muted-foreground">
                Toggle visibility of the Deposit & Withdrawal Quick Guides card.
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
            <Label htmlFor="guidesTitle">Section Title</Label>
            <Input
              id="guidesTitle"
              value={config.guidesSection.title}
              onChange={(e) =>
                updateConfig({ guidesSection: { ...config.guidesSection, title: e.target.value } })
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="guidesDescription">Section Description</Label>
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
          <CardTitle>Social Links - Stay Connected</CardTitle>
          <CardDescription>
            Control the Stay Connected social media section and update your social URLs.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="space-y-0.5">
              <Label htmlFor="socialVisible" className="text-base font-semibold">
                Show Social Links Section
              </Label>
              <p className="text-sm text-muted-foreground">
                Toggle visibility of the "Stay Connected" social media card on the dashboard.
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
            <Label htmlFor="facebookUrl">Facebook URL</Label>
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
            <Label htmlFor="instagramUrl">Instagram URL</Label>
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
            <Label htmlFor="tiktokUrl">TikTok URL</Label>
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
              Changes are applied to the user dashboard immediately after saving.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={handleReset}
              disabled={saveMutation.isPending}
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Reset to Defaults
            </Button>
            <Button
              onClick={handleSave}
              disabled={!hasChanges || saveMutation.isPending}
            >
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
                Settings saved successfully! Users will see updated content on the dashboard.
              </AlertDescription>
            </Alert>
          </CardContent>
        )}

        {saveMutation.isError && (
          <CardContent className="pt-0">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Failed to save settings. Please try again.
              </AlertDescription>
            </Alert>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
