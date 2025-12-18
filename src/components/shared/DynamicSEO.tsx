import { useQuery } from "@tanstack/react-query";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { useBranding } from "@/contexts/BrandingContext";

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

export const DynamicSEO = () => {
  const { platformName, platformLogoUrl, platformUrl } = useBranding();
  
  const { data: seoConfig } = useQuery({
    queryKey: ["seo-config"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("platform_config")
        .select("value")
        .eq("key", "seo_config")
        .maybeSingle();

      if (error) {
        console.error("Error fetching SEO config:", error);
        return null;
      }

      return data?.value as SEOConfig;
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
  });

  const config = seoConfig || {
    ...DEFAULT_SEO,
    title: `${platformName} – Earn Online by Completing AI Tasks`,
    description: `${platformName} lets users earn money online by completing AI-powered tasks and online training. Simple, flexible, and global.`,
    keywords: `earn online, AI tasks, online jobs, ${platformName}, make money online`,
    canonicalUrl: platformUrl,
    ogTitle: `${platformName} – Earn Online Completing AI Tasks`,
    ogDescription: `Start earning online with ${platformName} by completing AI-powered tasks and training. No experience required.`,
    ogImage: platformLogoUrl,
    ogUrl: platformUrl,
    twitterTitle: `${platformName} – Earn Online Completing AI Tasks`,
    twitterDescription: `Start earning online with ${platformName} by completing AI-powered tasks and training. No experience required.`,
    twitterImage: platformLogoUrl,
  };

  return (
    <Helmet>
      {/* Standard SEO */}
      <title>{config.title}</title>
      <meta name="description" content={config.description} />
      <meta name="keywords" content={config.keywords} />
      <link rel="canonical" href={config.canonicalUrl} />
      <meta name="robots" content={config.robots} />

      {/* Favicon */}
      <link rel="icon" type="image/png" href={config.faviconUrl || platformLogoUrl} />
      <link rel="apple-touch-icon" href={config.faviconUrl || platformLogoUrl} />

      {/* Open Graph / Facebook */}
      <meta property="og:type" content="website" />
      <meta property="og:url" content={config.ogUrl} />
      <meta property="og:title" content={config.ogTitle} />
      <meta property="og:description" content={config.ogDescription} />
      <meta property="og:image" content={config.ogImage} />

      {/* Twitter */}
      <meta name="twitter:card" content={config.twitterCard} />
      <meta name="twitter:url" content={config.ogUrl} />
      <meta name="twitter:title" content={config.twitterTitle} />
      <meta name="twitter:description" content={config.twitterDescription} />
      <meta name="twitter:image" content={config.twitterImage} />
    </Helmet>
  );
};
