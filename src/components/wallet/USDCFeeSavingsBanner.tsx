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
        "text-xs text-amber-700 dark:text-amber-300",
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
        "bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-950/20 dark:to-yellow-950/20 border-amber-200 dark:border-amber-800",
        className
      )}>
        <Zap className="h-4 w-4 text-amber-600 dark:text-amber-400" />
        <AlertTitle className="text-sm font-semibold text-amber-900 dark:text-amber-100">
          💡 Save on Fees!
        </AlertTitle>
        <AlertDescription className="text-xs text-amber-800 dark:text-amber-200">
          Use <strong>USDC (Solana network)</strong> — especially for <strong>GCash/GCrypto</strong> users. 
          Enjoy ultra-low fees and faster confirmations. All other supported coins still work normally.
        </AlertDescription>
      </Alert>
    );
  }
  
  // Banner variant (default) - full-width prominent display
  return (
    <Alert className={cn(
      "bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-950/20 dark:to-yellow-950/20 border-amber-200 dark:border-amber-800",
      className
    )}>
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-2">
        <div className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-amber-600 dark:text-amber-400" />
          <AlertTitle className="text-base sm:text-lg font-bold text-amber-900 dark:text-amber-100 mb-0">
            ⚡ Save on Fees!
          </AlertTitle>
        </div>
        <Badge variant="secondary" className="bg-amber-600 hover:bg-amber-700 text-white">
          Recommended
        </Badge>
      </div>
      <AlertDescription className="text-sm sm:text-base text-amber-800 dark:text-amber-200 space-y-1">
        <p>
          For the best experience, deposit using <strong className="text-amber-900 dark:text-amber-100">USDC (Solana network)</strong> — especially for <strong className="text-amber-900 dark:text-amber-100">GCash/GCrypto</strong> users.
        </p>
        <p>
          You'll enjoy <strong>ultra-low fees</strong> and <strong>faster confirmations</strong>.
        </p>
        <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
          All other supported coins still work normally.
        </p>
      </AlertDescription>
    </Alert>
  );
};
