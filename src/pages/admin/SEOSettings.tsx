import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Globe, Share2, Save, Undo, Info } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

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
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [config, setConfig] = useState<SEOConfig>(DEFAULT_SEO);
  const [branding, setBranding] = useState<BrandingConfig>(DEFAULT_BRANDING);
  const [hasChanges, setHasChanges] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["seo-branding-config"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("platform_config")
        .select("key, value")
        .in("key", ["seo_config", "platform_branding"]);

      if (error) throw error;
      
      const seoData = data.find(r => r.key === "seo_config")?.value as SEOConfig;
      const brandingData = data.find(r => r.key === "platform_branding")?.value as BrandingConfig;
      
      return {
        seo: seoData || DEFAULT_SEO,
        branding: brandingData || DEFAULT_BRANDING
      };
    },
  });

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
          value: seo,
          description: "Website SEO and Social Sharing configurations",
          updated_at: new Date().toISOString(),
        }, { onConflict: "key" });

      if (seoError) throw seoError;

      const { error: brandingError } = await supabase
        .from("platform_config")
        .upsert({
          key: "platform_branding",
          value: branding,
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
        title: "Settings saved",
        description: "SEO and Branding settings have been updated.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error saving settings",
        description: error.message || "An unexpected error occurred.",
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
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Globe className="h-8 w-8 text-primary" />
            Website SEO & Social Settings
          </h1>
          <p className="text-muted-foreground mt-2">
            Manage how your website appears on search engines and social media platforms.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={handleReset} disabled={!hasChanges || saveMutation.isPending}>
            <Undo className="h-4 w-4 mr-2" />
            Discard Changes
          </Button>
          <Button onClick={() => saveMutation.mutate({ seo: config, branding })} disabled={!hasChanges || saveMutation.isPending}>
            {saveMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Save Settings
          </Button>
        </div>
      </div>

      <Tabs defaultValue="branding" className="space-y-6">
        <TabsList>
          <TabsTrigger value="branding" className="gap-2">
            <Globe className="h-4 w-4" />
            General Branding
          </TabsTrigger>
          <TabsTrigger value="seo" className="gap-2">
            <Globe className="h-4 w-4" />
            SEO Metadata
          </TabsTrigger>
          <TabsTrigger value="social" className="gap-2">
            <Share2 className="h-4 w-4" />
            Social Sharing
          </TabsTrigger>
        </TabsList>

        <TabsContent value="branding" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Platform Branding</CardTitle>
              <CardDescription>
                Configure core branding elements that appear across the platform.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="platformName">Platform Name</Label>
                <Input
                  id="platformName"
                  value={branding.name}
                  onChange={(e) => handleBrandingChange("name", e.target.value)}
                  placeholder="e.g. ProfitChips"
                />
                <p className="text-xs text-muted-foreground">Used in sidebar, titles, and emails.</p>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="platformLogo">Platform Logo URL</Label>
                <div className="flex gap-4">
                  <div className="flex-1 space-y-2">
                    <Input
                      id="platformLogo"
                      value={branding.logoUrl}
                      onChange={(e) => handleBrandingChange("logoUrl", e.target.value)}
                      placeholder="/logo_without_bg_text.png"
                    />
                    <p className="text-xs text-muted-foreground">Enter image URL or path in public folder.</p>
                  </div>
                  <div className="h-12 w-12 border rounded-lg overflow-hidden bg-muted flex items-center justify-center">
                    <img src={branding.logoUrl} alt="Preview" className="h-full w-full object-contain" />
                  </div>
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="platformUrl">Platform URL</Label>
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
              <CardTitle>Search Engine Optimization</CardTitle>
              <CardDescription>
                Configure the primary metadata for search engine indexing.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="title">Page Title</Label>
                <Input
                  id="title"
                  value={config.title}
                  onChange={(e) => handleSEOChange("title", e.target.value)}
                  placeholder="Enter page title"
                />
                <p className="text-xs text-muted-foreground">Recommended: 50-60 characters</p>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="description">Meta Description</Label>
                <Textarea
                  id="description"
                  value={config.description}
                  onChange={(e) => handleSEOChange("description", e.target.value)}
                  placeholder="Enter meta description"
                  rows={3}
                />
                <p className="text-xs text-muted-foreground">Recommended: 150-160 characters</p>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="keywords">Keywords</Label>
                <Input
                  id="keywords"
                  value={config.keywords}
                  onChange={(e) => handleSEOChange("keywords", e.target.value)}
                  placeholder="e.g. earn online, AI tasks, ProfitChips"
                />
                <p className="text-xs text-muted-foreground">Comma-separated keywords</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="canonicalUrl">Canonical URL</Label>
                  <Input
                    id="canonicalUrl"
                    value={config.canonicalUrl}
                    onChange={(e) => handleSEOChange("canonicalUrl", e.target.value)}
                    placeholder="https://yourdomain.com"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="robots">Robots Meta</Label>
                  <Input
                    id="robots"
                    value={config.robots}
                    onChange={(e) => handleSEOChange("robots", e.target.value)}
                    placeholder="index, follow"
                  />
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="faviconUrl">Favicon URL (PNG)</Label>
                <Input
                  id="faviconUrl"
                  value={config.faviconUrl}
                  onChange={(e) => handleSEOChange("faviconUrl", e.target.value)}
                  placeholder="/logo_without_bg_text.png"
                />
                <p className="text-xs text-muted-foreground">High resolution PNG recommended (192x192 or larger)</p>
              </div>
            </CardContent>
          </Card>

          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>SEO Tip</AlertTitle>
            <AlertDescription>
              Changes to SEO metadata may take several days or even weeks to be reflected in search engine results as crawlers need to re-index your site.
            </AlertDescription>
          </Alert>
        </TabsContent>

        <TabsContent value="social" className="space-y-6">
          <div className="grid lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-blue-600">
                  <Share2 className="h-5 w-5" />
                  Open Graph (Facebook/LinkedIn)
                </CardTitle>
                <CardDescription>
                  How your site appears when shared on Facebook, LinkedIn, WhatsApp, etc.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-2">
                  <Label htmlFor="ogTitle">OG Title</Label>
                  <Input
                    id="ogTitle"
                    value={config.ogTitle}
                    onChange={(e) => handleSEOChange("ogTitle", e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="ogDescription">OG Description</Label>
                  <Textarea
                    id="ogDescription"
                    value={config.ogDescription}
                    onChange={(e) => handleSEOChange("ogDescription", e.target.value)}
                    rows={2}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="ogImage">OG Image URL</Label>
                  <Input
                    id="ogImage"
                    value={config.ogImage}
                    onChange={(e) => handleSEOChange("ogImage", e.target.value)}
                    placeholder="/logo_without_bg_text.png"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="ogUrl">OG URL</Label>
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
                  Twitter / X Cards
                </CardTitle>
                <CardDescription>
                  How your site appears when shared on Twitter/X.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-2">
                  <Label htmlFor="twitterTitle">Twitter Title</Label>
                  <Input
                    id="twitterTitle"
                    value={config.twitterTitle}
                    onChange={(e) => handleSEOChange("twitterTitle", e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="twitterDescription">Twitter Description</Label>
                  <Textarea
                    id="twitterDescription"
                    value={config.twitterDescription}
                    onChange={(e) => handleSEOChange("twitterDescription", e.target.value)}
                    rows={2}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="twitterImage">Twitter Image URL</Label>
                  <Input
                    id="twitterImage"
                    value={config.twitterImage}
                    onChange={(e) => handleSEOChange("twitterImage", e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="twitterCard">Card Type</Label>
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
