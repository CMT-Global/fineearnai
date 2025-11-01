import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Zap } from "lucide-react";
import { cn } from "@/lib/utils";

interface USDCFeeSavingsBannerProps {
  variant?: 'banner' | 'inline' | 'compact';
  className?: string;
}

export const USDCFeeSavingsBanner = ({ 
  variant = 'banner', 
  className 
}: USDCFeeSavingsBannerProps) => {
  
  // Compact variant - minimal text display
  if (variant === 'compact') {
    return (
      <div className={cn(
        "text-xs sm:text-sm text-amber-700 dark:text-amber-300",
        className
      )}>
        💡 Tip: Use <strong>USDC (Solana)</strong> for lowest fees
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
        <AlertTitle className="text-xs sm:text-sm font-semibold text-amber-900 dark:text-amber-100 leading-tight">
          💡 Save on Fees!
        </AlertTitle>
        <AlertDescription className="text-[11px] sm:text-xs leading-relaxed text-amber-800 dark:text-amber-200">
          Use <strong>USDC (Solana network)</strong> — especially for <strong>GCash/GCrypto</strong> users. 
          Enjoy ultra-low fees and faster confirmations. All other supported coins still work normally.
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
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3 mb-2 sm:mb-3">
        <div className="flex items-center gap-2">
          <Zap className="h-5 w-5 sm:h-6 sm:w-6 text-amber-600 dark:text-amber-400 shrink-0" />
          <AlertTitle className="text-base sm:text-lg font-bold text-amber-900 dark:text-amber-100 mb-0 leading-tight">
            ⚡ Save on Fees!
          </AlertTitle>
        </div>
        <Badge variant="secondary" className="bg-amber-600 hover:bg-amber-700 text-white text-xs sm:text-sm px-2 sm:px-2.5 py-0.5">
          Recommended
        </Badge>
      </div>
      <AlertDescription className="text-xs sm:text-sm md:text-base text-amber-800 dark:text-amber-200 space-y-1 sm:space-y-2 leading-relaxed">
        <p>
          For the best experience, deposit using <strong className="text-amber-900 dark:text-amber-100">USDC (Solana network)</strong> — especially for <strong className="text-amber-900 dark:text-amber-100">GCash/GCrypto</strong> users.
        </p>
        <p>
          You'll enjoy <strong>ultra-low fees</strong> and <strong>faster confirmations</strong>.
        </p>
        <p className="text-[11px] sm:text-xs text-amber-700 dark:text-amber-300 mt-1">
          All other supported coins still work normally.
        </p>
      </AlertDescription>
    </Alert>
  );
};
