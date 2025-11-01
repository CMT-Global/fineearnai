import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { X, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface MigrationBannerConfig {
  enabled: boolean;
  dismissible: boolean;
  display_priority: string;
  cutoff_date: string;
  support_link: string;
  message: {
    title: string;
    subtitle: string;
    steps: string[];
  };
}

const STORAGE_KEY = "migrationBannerDismissed_v1";

export const PlatformMigrationBanner = () => {
  const [isDismissed, setIsDismissed] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  // Fetch migration banner config from platform_config
  const { data: config, isLoading } = useQuery({
    queryKey: ["migration-banner-config"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("platform_config")
        .select("value")
        .eq("key", "migration_banner")
        .single();

      if (error) throw error;
      return data?.value as unknown as MigrationBannerConfig;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Check localStorage on mount
  useEffect(() => {
    const dismissed = localStorage.getItem(STORAGE_KEY);
    if (dismissed === "true") {
      setIsDismissed(true);
    } else {
      // Delay visibility for smooth slide-in animation
      setTimeout(() => setIsVisible(true), 300);
    }
  }, []);

  // Handle banner dismissal
  const handleDismiss = () => {
    setIsVisible(false);
    setTimeout(() => {
      setIsDismissed(true);
      localStorage.setItem(STORAGE_KEY, "true");
    }, 300); // Wait for exit animation
  };

  // Don't render if loading, disabled, dismissed, or not dismissible when it should be
  if (isLoading || !config || !config.enabled || isDismissed) {
    return null;
  }

  // Check if user should see banner (based on cutoff date logic can be added later)
  // For now, show to all users when enabled

  return (
    <div
      className={`
        fixed top-0 left-0 right-0 z-50 
        transition-all duration-300 ease-out
        ${isVisible ? "translate-y-0 opacity-100" : "-translate-y-full opacity-0"}
      `}
    >
      <div className="container mx-auto px-4 pt-4 pb-2">
        <Alert
          className="
            relative
            bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-red-500/10
            border-2 border-amber-500/50
            shadow-lg shadow-amber-500/20
            backdrop-blur-sm
          "
        >
          {/* Warning Icon */}
          <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0" />

          {/* Close Button */}
          {config.dismissible && (
            <Button
              variant="ghost"
              size="icon"
              onClick={handleDismiss}
              className="
                absolute top-2 right-2
                h-8 w-8
                hover:bg-amber-500/20
                transition-colors
              "
              aria-label="Dismiss migration banner"
            >
              <X className="h-4 w-4 text-amber-600" />
            </Button>
          )}

          {/* Content */}
          <div className="ml-2 pr-8">
            <AlertTitle className="text-lg font-bold text-amber-700 dark:text-amber-400 mb-2">
              {config.message.title}
            </AlertTitle>

            <AlertDescription className="space-y-3">
              {/* Subtitle */}
              <p className="text-base font-semibold text-foreground">
                {config.message.subtitle}
              </p>

              {/* Steps */}
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">
                  If you joined before November 1, 2025, please:
                </p>
                <ol className="space-y-2 ml-2">
                  {config.message.steps.map((step, index) => (
                    <li
                      key={index}
                      className="flex items-start gap-2 text-sm text-foreground"
                    >
                      <span className="flex-shrink-0 text-base">
                        {["1️⃣", "2️⃣", "3️⃣"][index]}
                      </span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>
              </div>

              {/* Login to Old Platform Button */}
              <div className="pt-3 flex items-center gap-3">
                <Button
                  asChild
                  variant="outline"
                  className="
                    border-2 border-amber-500 
                    bg-amber-50 dark:bg-amber-950
                    hover:bg-amber-100 dark:hover:bg-amber-900
                    text-amber-700 dark:text-amber-300
                    font-semibold
                    shadow-sm
                    transition-all
                  "
                >
                  <a
                    href="https://legacy.fineearn.com"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Login to Old Platform →
                  </a>
                </Button>
                <span className="text-xs text-muted-foreground">
                  (Opens in new tab)
                </span>
              </div>
            </AlertDescription>
          </div>
        </Alert>
      </div>
    </div>
  );
};
