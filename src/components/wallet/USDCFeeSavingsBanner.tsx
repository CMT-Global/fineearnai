import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Zap, Coins } from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface USDCFeeSavingsBannerProps {
  variant?: 'banner' | 'inline' | 'compact';
  className?: string;
}

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

export const USDCFeeSavingsBanner = ({ 
  variant = 'banner', 
  className 
}: USDCFeeSavingsBannerProps) => {
  // Fetch banner config
  const { data: configData, isLoading } = useQuery({
    queryKey: ['fee-savings-banner-config'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('platform_config')
        .select('value')
        .eq('key', 'fee_savings_banner')
        .maybeSingle();

      if (error) throw error;
      return (data?.value as unknown as FeeSavingsBannerConfig) || DEFAULT_CONFIG;
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  // Don't render until config is loaded to prevent flickering
  if (isLoading || !configData) {
    return null;
  }

  const config = configData;

  // Don't render if not visible
  if (!config.isVisible) {
    return null;
  }
  
  // Compact variant - minimal text display
  if (variant === 'compact') {
    return (
      <div className={cn(
        "text-xs sm:text-sm text-amber-700 dark:text-amber-300 flex items-center gap-1.5 flex-wrap",
        className
      )}>
        <Zap className="h-3 w-3 sm:h-4 sm:w-4 text-amber-600 dark:text-amber-400 shrink-0" />
        <span>Tip: Use</span>
        <Badge variant="secondary" className="bg-amber-600 text-white text-[10px] sm:text-xs px-1.5 py-0 h-5">
          {config.option1.label}
        </Badge>
        <span>or</span>
        <Badge variant="secondary" className="bg-amber-600 text-white text-[10px] sm:text-xs px-1.5 py-0 h-5">
          {config.option2.label}
        </Badge>
        <span>for lowest fees</span>
      </div>
    );
  }
  
  // Inline variant - for use inside dialogs/forms
  if (variant === 'inline') {
    return (
      <Alert className={cn(
        "bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-950/20 dark:to-yellow-950/20 border-amber-200 dark:border-amber-800 p-3 sm:p-4",
        className
      )}>
        <Zap className="h-4 w-4 sm:h-5 sm:w-5 text-amber-600 dark:text-amber-400" />
        <AlertTitle className="text-xs sm:text-sm font-semibold text-amber-900 dark:text-amber-100 leading-tight mb-2">
          {config.title}
        </AlertTitle>
        <AlertDescription className="text-[11px] sm:text-xs leading-relaxed text-amber-800 dark:text-amber-200 space-y-2">
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            <span>Use</span>
            <Badge variant="secondary" className="bg-amber-600 hover:bg-amber-700 text-white text-[10px] sm:text-xs px-2 py-0.5 font-semibold">
              {config.option1.label}
            </Badge>
            <span>or</span>
            <Badge variant="secondary" className="bg-amber-600 hover:bg-amber-700 text-white text-[10px] sm:text-xs px-2 py-0.5 font-semibold">
              {config.option2.label}
            </Badge>
            <span dangerouslySetInnerHTML={{ __html: config.highlightText.replace('GCash/GCrypto', '<strong>GCash/GCrypto</strong>') }} />
          </div>
          <p className="text-[10px] sm:text-xs">
            {config.benefitsText}
          </p>
          <p className="text-xs sm:text-sm font-extrabold text-amber-950 dark:text-amber-50 tracking-wide pt-1 border-t border-amber-300 dark:border-amber-700">
            {config.footerText}
          </p>
        </AlertDescription>
      </Alert>
    );
  }
  
  // Banner variant (default) - full-width prominent display
  return (
    <Alert className={cn(
      "bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-950/20 dark:to-yellow-950/20 border-amber-200 dark:border-amber-800 p-4 sm:p-6",
      className
    )}>
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
        <div className="flex items-center gap-2">
          <Zap className="h-5 w-5 sm:h-6 sm:w-6 text-amber-600 dark:text-amber-400 shrink-0" />
          <AlertTitle className="text-base sm:text-lg font-bold text-amber-900 dark:text-amber-100 mb-0 leading-tight">
            {config.title}
          </AlertTitle>
        </div>
        <Badge variant="secondary" className="bg-amber-600 hover:bg-amber-700 text-white text-xs sm:text-sm px-2 sm:px-2.5 py-0.5">
          {config.recommendedBadge}
        </Badge>
      </div>
      <AlertDescription className="text-xs sm:text-sm md:text-base text-amber-800 dark:text-amber-200 space-y-2 sm:space-y-3 leading-relaxed">
        <div className="space-y-2">
          <p className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            <span>{config.subtitle}</span>
          </p>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <Badge variant="secondary" className="bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white text-xs sm:text-sm px-3 sm:px-4 py-1 sm:py-1.5 font-bold shadow-sm">
              <Coins className="h-3 w-3 sm:h-4 sm:w-4 mr-1.5" />
              {config.option1.label}
            </Badge>
            <span className="text-amber-700 dark:text-amber-300 font-semibold">or</span>
            <Badge variant="secondary" className="bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white text-xs sm:text-sm px-3 sm:px-4 py-1 sm:py-1.5 font-bold shadow-sm">
              <Coins className="h-3 w-3 sm:h-4 sm:w-4 mr-1.5" />
              {config.option2.label}
            </Badge>
          </div>
          <p className="text-[11px] sm:text-xs md:text-sm" dangerouslySetInnerHTML={{ __html: config.highlightText.replace('GCash/GCrypto', '<strong class="text-amber-900 dark:text-amber-100">GCash/GCrypto</strong>') }} />
        </div>
        <p className="text-[11px] sm:text-xs md:text-sm">
          {config.benefitsText}
        </p>
        <div className="pt-2 sm:pt-3 mt-2 sm:mt-3 border-t-2 border-amber-300 dark:border-amber-700">
          <p className="text-sm sm:text-base md:text-lg font-extrabold text-amber-950 dark:text-amber-50 tracking-wide leading-tight">
            {config.footerText}
          </p>
        </div>
      </AlertDescription>
    </Alert>
  );
};
