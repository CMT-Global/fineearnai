import React, { createContext, useContext, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface BrandingConfig {
  platformName: string;
  platformLogoUrl: string;
  platformUrl: string;
}

interface BrandingContextType extends BrandingConfig {
  isLoading: boolean;
}

const DEFAULT_BRANDING: BrandingConfig = {
  platformName: "ProfitChips",
  platformLogoUrl: "/logo_without_bg_text.png",
  platformUrl: "https://profitchips.com",
};

const BrandingContext = createContext<BrandingContextType>({
  ...DEFAULT_BRANDING,
  isLoading: true,
});

export const useBranding = () => useContext(BrandingContext);

export const BrandingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { data: config, isLoading } = useQuery({
    queryKey: ["branding-config"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("platform_config")
        .select("key, value")
        .in("key", ["platform_branding", "email_settings"]);

      if (error) {
        console.error("Error fetching branding config:", error);
        return DEFAULT_BRANDING;
      }

      const brandingRow = data.find((r) => r.key === "platform_branding");
      const emailSettingsRow = data.find((r) => r.key === "email_settings");

      const branding = brandingRow?.value as any;
      const emailSettings = emailSettingsRow?.value as any;

      return {
        platformName: branding?.name || emailSettings?.platform_name || DEFAULT_BRANDING.platformName,
        platformLogoUrl: branding?.logoUrl || DEFAULT_BRANDING.platformLogoUrl,
        platformUrl: branding?.url || emailSettings?.platform_url || DEFAULT_BRANDING.platformUrl,
      };
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
  });

  const value = {
    ...(config || DEFAULT_BRANDING),
    isLoading,
  };

  return (
    <BrandingContext.Provider value={value}>
      {children}
    </BrandingContext.Provider>
  );
};
