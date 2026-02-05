import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Save, Video, AlertCircle, Info } from "lucide-react";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useTranslation } from "react-i18next";
import { useLanguageSync } from "@/hooks/useLanguageSync";
import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";
import { CONTENT_REWARDS_QUERY_KEY } from "@/lib/content-rewards-config";

interface ContentRewardsConfig {
  enabled: boolean;
  landing_page: {
    title: string;
    description: string;
    hero_text: string;
    cta_text: string;
  };
  wizard_steps?: {
    step1_welcome: { title: string; description: string };
    step2_what_to_post: { title: string; examples: string[] };
    step3_how_earnings_work: { title: string; description: string };
    step4_goal_setting: { title: string; message: string };
    step5_get_link: { title: string; description: string };
    step6_posting_checklist: { title: string; dos: string[]; donts: string[]; compliant_language: string };
    step7_finish: { title: string; message: string };
  };
  share_captions: {
    tiktok: string;
    youtube: string;
    instagram: string;
    whatsapp: string;
    telegram: string;
    facebook: string;
    twitter: string;
  };
  media_kit: {
    assets: string[];
  };
  goal_messaging: string;
  disclaimer: string;
}

const DEFAULT_CONFIG: ContentRewardsConfig = {
  enabled: false,
  landing_page: {
    title: "Get Paid to Post About ProfitChips",
    description: "Create tutorials, share your link, and earn commissions when your referrals upgrade their subscription.",
    hero_text: "Turn your content into earnings",
    cta_text: "Apply & Start Posting",
  },
  wizard_steps: {
    step1_welcome: {
      title: "Get Paid to Post About ProfitChips",
      description: "Welcome to the Content Rewards Program! Create content, share your link, and earn commissions when your referrals upgrade.",
    },
    step2_what_to_post: {
      title: "What to Post",
      examples: [
        "Tutorial videos showing how to use ProfitChips",
        "How-to guides explaining the earning process",
        "Review videos sharing your experience",
        "Explainer videos: 'How to earn online doing AI tasks'",
      ],
    },
    step3_how_earnings_work: {
      title: "How Earnings Work",
      description: "You earn commissions when people you refer upgrade their subscription. Commission rates are based on your membership plan and are set by the admin.",
    },
    step4_goal_setting: {
      title: "Set Your Goal",
      message: "Creators often aim for $250/week (~$1,000/month) depending on performance and referrals. This is a target, not a guarantee.",
    },
    step5_get_link: {
      title: "Get Your Creator Link",
      description: "Your referral link tracks all signups and upgrades. Share it in your content to start earning commissions.",
    },
    step6_posting_checklist: {
      title: "Posting Checklist",
      dos: [
        "Use compliant language",
        "Be honest about earnings potential",
        "Focus on the value of the platform",
        "Include your referral link",
      ],
      donts: [
        "Don't promise fixed earnings",
        "Don't use 'get rich quick' language",
        "Don't guarantee specific amounts",
        "Don't make false claims",
      ],
      compliant_language: "Earn commissions when your referrals upgrade. Earnings vary based on referrals and plan settings.",
    },
    step7_finish: {
      title: "You're Approved!",
      message: "Start posting now and share your link to earn commissions. Check your dashboard to track your performance.",
    },
  },
  share_captions: {
    tiktok: "Check out ProfitChips! Earn money by training AI. Use my link to get started: {link}",
    youtube: "Learn how to earn online doing AI tasks with ProfitChips. Sign up using my referral link: {link}",
    instagram: "Discover ProfitChips - earn by training AI! Use my link: {link}",
    whatsapp: "Hey! Check out ProfitChips - you can earn money by training AI. Sign up here: {link}",
    telegram: "Join ProfitChips and start earning! Use my link: {link}",
    facebook: "Learn about ProfitChips - a platform where you earn by training AI. Sign up: {link}",
    twitter: "Earn money training AI with ProfitChips! Sign up using my link: {link}",
  },
  media_kit: {
    assets: [],
  },
  goal_messaging: "Many creators set a goal of $250/week (~$1,000/month) depending on performance and referrals.",
  disclaimer: "Earnings vary based on referrals, upgrades, and plan settings. No guaranteed earnings.",
};

export default function ContentRewardsSettings() {
  const { t } = useTranslation();
  useLanguageSync();
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdmin();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [config, setConfig] = useState<ContentRewardsConfig>(DEFAULT_CONFIG);
  const [hasChanges, setHasChanges] = useState(false);

  // Fetch config
  const { data, isLoading } = useQuery({
    queryKey: ["content-rewards-config"],
    queryFn: async () => {
      const { data: configData, error } = await supabase
        .from("platform_config")
        .select("value")
        .eq("key", "content_rewards_config")
        .maybeSingle();

      if (error) throw error;

      return (configData?.value as ContentRewardsConfig) || DEFAULT_CONFIG;
    },
  });

  useEffect(() => {
    if (data) {
      setConfig({
        ...DEFAULT_CONFIG,
        ...data,
        enabled: Boolean(data?.enabled),
      });
      setHasChanges(false);
    }
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: async (payload: ContentRewardsConfig) => {
      console.log("[Content Rewards] Save mutation running, enabled =", payload.enabled);
      const payloadJson = payload as unknown as Json;
      let error = (await supabase.rpc("admin_update_content_rewards_config", { p_value: payloadJson })).error;
      if (error) {
        console.warn("[Content Rewards] RPC save failed, trying direct upsert:", error.message);
        const direct = await supabase
          .from("platform_config")
          .upsert(
            {
              key: "content_rewards_config",
              value: payloadJson,
              description: "Content Rewards Program configuration. Editable from admin panel.",
              updated_at: new Date().toISOString(),
            },
            { onConflict: "key" }
          );
        error = direct.error;
      }
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      setConfig((prev) => ({ ...prev, ...variables }));
      queryClient.setQueryData(["content-rewards-config"], variables);
      queryClient.invalidateQueries({ queryKey: ["sidebar-platform-config"] });
      queryClient.invalidateQueries({ queryKey: CONTENT_REWARDS_QUERY_KEY });
      setHasChanges(false);
      toast({
        title: "Settings saved",
        description: variables.enabled
          ? "Content Rewards is enabled. Existing creators will see the Creator Dashboard link in the sidebar (they may need to refresh the page)."
          : "Content Rewards configuration has been updated successfully.",
      });
    },
    onError: (error: any) => {
      console.error("[Content Rewards] Save failed:", error);
      toast({
        title: "Error saving settings",
        description: error?.message || String(error) || "Failed to save configuration.",
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    saveMutation.mutate(config);
  };

  const updateConfig = (updates: Partial<ContentRewardsConfig>) => {
    setConfig((prev) => ({ ...prev, ...updates }));
    setHasChanges(true);
  };

  const handleToggleEnabled = (checked: boolean) => {
    console.log("[Content Rewards] Toggle changed:", checked);
    const nextConfig = { ...config, enabled: checked };
    setConfig(nextConfig);
    setHasChanges(true);
    saveMutation.mutate(nextConfig, {
      onSuccess: () => console.log("[Content Rewards] Toggle save succeeded, enabled =", checked),
      onError: (err) => console.error("[Content Rewards] Toggle save failed:", err),
    });
  };

  useEffect(() => {
    if (!authLoading && !adminLoading && !isAdmin) {
      navigate("/dashboard");
    }
  }, [authLoading, adminLoading, isAdmin, navigate]);

  if (authLoading || adminLoading || isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <LoadingSpinner size="lg" text="Loading..." />
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="container mx-auto p-4 space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Video className="h-8 w-8 text-primary" />
            Content Rewards Settings
          </h1>
          <p className="text-muted-foreground mt-1">
            Configure the Content Rewards program settings and messaging
          </p>
        </div>
        <Button variant="outline" onClick={() => navigate("/admin")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Admin
        </Button>
      </div>

      {/* Enable/Disable Toggle */}
      <Card>
        <CardHeader>
          <CardTitle>Program Status</CardTitle>
          <CardDescription>Enable or disable the Content Rewards program</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Enable Content Rewards Program</Label>
              <p className="text-sm text-muted-foreground">
                When enabled, users can apply to become creators and earn commissions. The Creator Dashboard link is shown in the sidebar for all approved creators (including admins who are creators).
              </p>
              <Alert className="mt-3">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  <strong>Note:</strong> Turning this off will hide the program from new users, but existing creators will continue to have access and earn commissions. To disable individual creators, use the "Creators" page.
                </AlertDescription>
              </Alert>
            </div>
            <Switch
              checked={Boolean(config.enabled)}
              onCheckedChange={handleToggleEnabled}
              disabled={saveMutation.isPending}
            />
          </div>
        </CardContent>
      </Card>

      {/* Landing Page Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Landing Page Content</CardTitle>
          <CardDescription>Text displayed on the public /content-rewards page</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="landing_title">Page Title</Label>
            <Input
              id="landing_title"
              value={config.landing_page.title}
              onChange={(e) =>
                updateConfig({
                  landing_page: { ...config.landing_page, title: e.target.value },
                })
              }
              placeholder="Get Paid to Post About ProfitChips"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="landing_description">Description</Label>
            <Textarea
              id="landing_description"
              value={config.landing_page.description}
              onChange={(e) =>
                updateConfig({
                  landing_page: { ...config.landing_page, description: e.target.value },
                })
              }
              placeholder="Create tutorials, share your link, and earn commissions..."
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="hero_text">Hero Text</Label>
            <Input
              id="hero_text"
              value={config.landing_page.hero_text}
              onChange={(e) =>
                updateConfig({
                  landing_page: { ...config.landing_page, hero_text: e.target.value },
                })
              }
              placeholder="Turn your content into earnings"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="cta_text">Call-to-Action Button Text</Label>
            <Input
              id="cta_text"
              value={config.landing_page.cta_text}
              onChange={(e) =>
                updateConfig({
                  landing_page: { ...config.landing_page, cta_text: e.target.value },
                })
              }
              placeholder="Apply & Start Posting"
            />
          </div>
        </CardContent>
      </Card>

      {/* Share Captions */}
      <Card>
        <CardHeader>
          <CardTitle>Default Share Captions</CardTitle>
          <CardDescription>
            Pre-written captions creators can use when sharing their links. Use {"{link}"} as a placeholder for the referral link.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {Object.entries(config.share_captions).map(([platform, caption]) => (
            <div key={platform} className="space-y-2">
              <Label htmlFor={`caption_${platform}`} className="capitalize">
                {platform}
              </Label>
              <Textarea
                id={`caption_${platform}`}
                value={caption}
                onChange={(e) =>
                  updateConfig({
                    share_captions: {
                      ...config.share_captions,
                      [platform]: e.target.value,
                    },
                  })
                }
                placeholder={`${platform} caption...`}
                rows={2}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Wizard Steps Content */}
      <Card>
        <CardHeader>
          <CardTitle>Onboarding Wizard Content</CardTitle>
          <CardDescription>Edit content for each step of the onboarding wizard</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Step 1: Welcome */}
          <div className="space-y-3 border-b pb-4">
            <Label className="text-base font-semibold">Step 1: Welcome</Label>
            <div className="space-y-2">
              <Input
                value={config.wizard_steps?.step1_welcome?.title || ""}
                onChange={(e) =>
                  updateConfig({
                    wizard_steps: {
                      ...config.wizard_steps,
                      step1_welcome: {
                        ...config.wizard_steps?.step1_welcome,
                        title: e.target.value,
                      },
                    },
                  })
                }
                placeholder="Get Paid to Post About ProfitChips"
              />
              <Textarea
                value={config.wizard_steps?.step1_welcome?.description || ""}
                onChange={(e) =>
                  updateConfig({
                    wizard_steps: {
                      ...config.wizard_steps,
                      step1_welcome: {
                        ...config.wizard_steps?.step1_welcome,
                        description: e.target.value,
                      },
                    },
                  })
                }
                placeholder="Welcome message..."
                rows={2}
              />
            </div>
          </div>

          {/* Step 2: What to Post */}
          <div className="space-y-3 border-b pb-4">
            <Label className="text-base font-semibold">Step 2: What to Post</Label>
            <div className="space-y-2">
              <Input
                value={config.wizard_steps?.step2_what_to_post?.title || ""}
                onChange={(e) =>
                  updateConfig({
                    wizard_steps: {
                      ...config.wizard_steps,
                      step2_what_to_post: {
                        ...config.wizard_steps?.step2_what_to_post,
                        title: e.target.value,
                      },
                    },
                  })
                }
                placeholder="What to Post"
              />
              <Textarea
                value={config.wizard_steps?.step2_what_to_post?.examples?.join("\n") || ""}
                onChange={(e) =>
                  updateConfig({
                    wizard_steps: {
                      ...config.wizard_steps,
                      step2_what_to_post: {
                        ...config.wizard_steps?.step2_what_to_post,
                        examples: e.target.value.split("\n").filter((l) => l.trim()),
                      },
                    },
                  })
                }
                placeholder="One example per line..."
                rows={4}
              />
            </div>
          </div>

          {/* Step 3: How Earnings Work */}
          <div className="space-y-3 border-b pb-4">
            <Label className="text-base font-semibold">Step 3: How Earnings Work</Label>
            <div className="space-y-2">
              <Input
                value={config.wizard_steps?.step3_how_earnings_work?.title || ""}
                onChange={(e) =>
                  updateConfig({
                    wizard_steps: {
                      ...config.wizard_steps,
                      step3_how_earnings_work: {
                        ...config.wizard_steps?.step3_how_earnings_work,
                        title: e.target.value,
                      },
                    },
                  })
                }
                placeholder="How Earnings Work"
              />
              <Textarea
                value={config.wizard_steps?.step3_how_earnings_work?.description || ""}
                onChange={(e) =>
                  updateConfig({
                    wizard_steps: {
                      ...config.wizard_steps,
                      step3_how_earnings_work: {
                        ...config.wizard_steps?.step3_how_earnings_work,
                        description: e.target.value,
                      },
                    },
                  })
                }
                placeholder="Explanation of how earnings work..."
                rows={3}
              />
            </div>
          </div>

          {/* Step 4: Goal Setting */}
          <div className="space-y-3 border-b pb-4">
            <Label className="text-base font-semibold">Step 4: Goal Setting</Label>
            <div className="space-y-2">
              <Input
                value={config.wizard_steps?.step4_goal_setting?.title || ""}
                onChange={(e) =>
                  updateConfig({
                    wizard_steps: {
                      ...config.wizard_steps,
                      step4_goal_setting: {
                        ...config.wizard_steps?.step4_goal_setting,
                        title: e.target.value,
                      },
                    },
                  })
                }
                placeholder="Set Your Goal"
              />
              <Textarea
                value={config.wizard_steps?.step4_goal_setting?.message || ""}
                onChange={(e) =>
                  updateConfig({
                    wizard_steps: {
                      ...config.wizard_steps,
                      step4_goal_setting: {
                        ...config.wizard_steps?.step4_goal_setting,
                        message: e.target.value,
                      },
                    },
                  })
                }
                placeholder="Goal setting message..."
                rows={2}
              />
            </div>
          </div>

          {/* Step 5: Get Link */}
          <div className="space-y-3 border-b pb-4">
            <Label className="text-base font-semibold">Step 5: Get Your Link</Label>
            <div className="space-y-2">
              <Input
                value={config.wizard_steps?.step5_get_link?.title || ""}
                onChange={(e) =>
                  updateConfig({
                    wizard_steps: {
                      ...config.wizard_steps,
                      step5_get_link: {
                        ...config.wizard_steps?.step5_get_link,
                        title: e.target.value,
                      },
                    },
                  })
                }
                placeholder="Get Your Creator Link"
              />
              <Textarea
                value={config.wizard_steps?.step5_get_link?.description || ""}
                onChange={(e) =>
                  updateConfig({
                    wizard_steps: {
                      ...config.wizard_steps,
                      step5_get_link: {
                        ...config.wizard_steps?.step5_get_link,
                        description: e.target.value,
                      },
                    },
                  })
                }
                placeholder="Link explanation..."
                rows={2}
              />
            </div>
          </div>

          {/* Step 6: Posting Checklist */}
          <div className="space-y-3 border-b pb-4">
            <Label className="text-base font-semibold">Step 6: Posting Checklist</Label>
            <div className="space-y-2">
              <Input
                value={config.wizard_steps?.step6_posting_checklist?.title || ""}
                onChange={(e) =>
                  updateConfig({
                    wizard_steps: {
                      ...config.wizard_steps,
                      step6_posting_checklist: {
                        ...config.wizard_steps?.step6_posting_checklist,
                        title: e.target.value,
                      },
                    },
                  })
                }
                placeholder="Posting Checklist"
              />
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm">Dos (one per line)</Label>
                  <Textarea
                    value={config.wizard_steps?.step6_posting_checklist?.dos?.join("\n") || ""}
                    onChange={(e) =>
                      updateConfig({
                        wizard_steps: {
                          ...config.wizard_steps,
                          step6_posting_checklist: {
                            ...config.wizard_steps?.step6_posting_checklist,
                            dos: e.target.value.split("\n").filter((l) => l.trim()),
                          },
                        },
                      })
                    }
                    placeholder="Do 1&#10;Do 2..."
                    rows={4}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm">Don'ts (one per line)</Label>
                  <Textarea
                    value={config.wizard_steps?.step6_posting_checklist?.donts?.join("\n") || ""}
                    onChange={(e) =>
                      updateConfig({
                        wizard_steps: {
                          ...config.wizard_steps,
                          step6_posting_checklist: {
                            ...config.wizard_steps?.step6_posting_checklist,
                            donts: e.target.value.split("\n").filter((l) => l.trim()),
                          },
                        },
                      })
                    }
                    placeholder="Don't 1&#10;Don't 2..."
                    rows={4}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-sm">Compliant Language Example</Label>
                <Textarea
                  value={config.wizard_steps?.step6_posting_checklist?.compliant_language || ""}
                  onChange={(e) =>
                    updateConfig({
                      wizard_steps: {
                        ...config.wizard_steps,
                        step6_posting_checklist: {
                          ...config.wizard_steps?.step6_posting_checklist,
                          compliant_language: e.target.value,
                        },
                      },
                    })
                  }
                  placeholder="Example of compliant language..."
                  rows={2}
                />
              </div>
            </div>
          </div>

          {/* Step 7: Finish */}
          <div className="space-y-3">
            <Label className="text-base font-semibold">Step 7: Finish</Label>
            <div className="space-y-2">
              <Input
                value={config.wizard_steps?.step7_finish?.title || ""}
                onChange={(e) =>
                  updateConfig({
                    wizard_steps: {
                      ...config.wizard_steps,
                      step7_finish: {
                        ...config.wizard_steps?.step7_finish,
                        title: e.target.value,
                      },
                    },
                  })
                }
                placeholder="You're Approved!"
              />
              <Textarea
                value={config.wizard_steps?.step7_finish?.message || ""}
                onChange={(e) =>
                  updateConfig({
                    wizard_steps: {
                      ...config.wizard_steps,
                      step7_finish: {
                        ...config.wizard_steps?.step7_finish,
                        message: e.target.value,
                      },
                    },
                  })
                }
                placeholder="Finish message..."
                rows={2}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Media Kit */}
      <Card>
        <CardHeader>
          <CardTitle>Media Kit Assets</CardTitle>
          <CardDescription>
            Add URLs for downloadable media assets (logos, banners, videos). Creators can download these from their dashboard.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Asset URLs (one per line)</Label>
            <Textarea
              value={(config.media_kit?.assets || []).join("\n")}
              onChange={(e) =>
                updateConfig({
                  media_kit: {
                    assets: e.target.value
                      .split("\n")
                      .map((url) => url.trim())
                      .filter((url) => url.length > 0),
                  },
                })
              }
              placeholder="https://example.com/logo.png&#10;https://example.com/banner.jpg"
              rows={4}
            />
            <p className="text-xs text-muted-foreground">
              Enter one URL per line. These will be available for creators to download.
            </p>
          </div>
          {config.media_kit?.assets && config.media_kit.assets.length > 0 && (
            <div className="space-y-2">
              <Label>Current Assets ({config.media_kit.assets.length})</Label>
              <div className="space-y-4">
                {config.media_kit.assets.map((url, index) => {
                  const isVideo = /\.(mp4|webm|ogg|mov|avi|mkv)$/i.test(url) || url.includes('youtube.com') || url.includes('youtu.be') || url.includes('vimeo.com');
                  const isImage = /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(url);
                  
                  return (
                    <div key={index} className="border rounded-lg p-4 space-y-3">
                      {/* Preview Section */}
                      {(isVideo || isImage) && (
                        <div className="space-y-2">
                          {isVideo ? (
                            <div className="relative w-full aspect-video bg-muted rounded-lg overflow-hidden">
                              {url.includes('youtube.com') || url.includes('youtu.be') ? (
                                <iframe
                                  src={url.includes('youtu.be') 
                                    ? `https://www.youtube.com/embed/${url.split('/').pop()?.split('?')[0]}`
                                    : url.includes('watch?v=')
                                    ? `https://www.youtube.com/embed/${url.split('v=')[1]?.split('&')[0]}`
                                    : url
                                  }
                                  className="w-full h-full"
                                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                  allowFullScreen
                                />
                              ) : url.includes('vimeo.com') ? (
                                <iframe
                                  src={`https://player.vimeo.com/video/${url.split('/').pop()?.split('?')[0]}`}
                                  className="w-full h-full"
                                  allow="autoplay; fullscreen; picture-in-picture"
                                  allowFullScreen
                                />
                              ) : (
                                <video
                                  src={url}
                                  controls
                                  className="w-full h-full object-contain"
                                >
                                  Your browser does not support the video tag.
                                </video>
                              )}
                            </div>
                          ) : isImage ? (
                            <div className="relative w-full max-h-64 bg-muted rounded-lg overflow-hidden">
                              <img
                                src={url}
                                alt={`Asset ${index + 1}`}
                                className="w-full h-full object-contain"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).style.display = 'none';
                                }}
                              />
                            </div>
                          ) : null}
                        </div>
                      )}
                      
                      {/* Link Section */}
                      <div className="flex items-center gap-2">
                        <a
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline truncate flex-1 text-sm font-mono"
                        >
                          {url}
                        </a>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            navigator.clipboard.writeText(url);
                            toast({
                              title: "Copied!",
                              description: "Asset URL copied to clipboard",
                            });
                          }}
                        >
                          Copy Link
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            const newAssets = config.media_kit?.assets?.filter((_, i) => i !== index) || [];
                            updateConfig({
                              media_kit: { assets: newAssets },
                            });
                          }}
                        >
                          Remove
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Goal Messaging & Disclaimer */}
      <Card>
        <CardHeader>
          <CardTitle>Messaging</CardTitle>
          <CardDescription>Goal messaging and compliance disclaimer</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="goal_messaging">Goal Messaging</Label>
            <Textarea
              id="goal_messaging"
              value={config.goal_messaging}
              onChange={(e) => updateConfig({ goal_messaging: e.target.value })}
              placeholder="Many creators set a goal of $250/week..."
              rows={2}
            />
            <p className="text-xs text-muted-foreground">
              This should be motivational but not a guarantee
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="disclaimer">Compliance Disclaimer</Label>
            <Textarea
              id="disclaimer"
              value={config.disclaimer}
              onChange={(e) => updateConfig({ disclaimer: e.target.value })}
              placeholder="Earnings vary based on referrals..."
              rows={2}
            />
            <p className="text-xs text-muted-foreground">
              This disclaimer will be displayed on the landing page
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Commission Info */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          <strong>Commission Rates:</strong> Commission rates are configured in{" "}
          <Button
            variant="link"
            className="p-0 h-auto font-semibold"
            onClick={() => navigate("/admin/plans/manage")}
          >
            Membership Plans
          </Button>
          . The rates set there apply to all referrals, including Content Rewards creators.
        </AlertDescription>
      </Alert>

      {/* Save Button */}
      <div className="flex justify-end gap-2">
        <Button
          variant="outline"
          onClick={() => {
            if (data) {
              setConfig({ ...DEFAULT_CONFIG, ...data });
              setHasChanges(false);
            }
          }}
          disabled={!hasChanges}
        >
          Reset
        </Button>
        <Button onClick={handleSave} disabled={!hasChanges || saveMutation.isPending}>
          {saveMutation.isPending ? (
            <>
              <LoadingSpinner size="sm" className="mr-2" />
              Saving...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Save Changes
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
