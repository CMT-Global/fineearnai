import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

interface ComparisonBadgeProps {
  changePercent: number;
  change: number;
  previous: number;
  prefix?: string;
  showAbsoluteChange?: boolean;
}

export function ComparisonBadge({ 
  changePercent, 
  change, 
  previous,
  prefix = "",
  showAbsoluteChange = false 
}: ComparisonBadgeProps) {
  const isPositive = changePercent > 0;
  const isNeutral = changePercent === 0;
  
  if (isNeutral) {
    return (
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        <Minus className="h-3 w-3" />
        <span>No change vs previous period</span>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1 text-xs">
        {isPositive ? (
          <TrendingUp className="h-3 w-3 text-green-500" />
        ) : (
          <TrendingDown className="h-3 w-3 text-red-500" />
        )}
        <span className={cn(
          "font-medium",
          isPositive ? "text-green-500" : "text-red-500"
        )}>
          {isPositive ? "+" : ""}{changePercent}%
        </span>
        <span className="text-muted-foreground">vs previous period</span>
      </div>
      
      {showAbsoluteChange && (
        <div className="text-xs text-muted-foreground">
          {isPositive ? "+" : ""}{prefix}{change.toLocaleString()} (from {prefix}{previous.toLocaleString()})
        </div>
      )}
    </div>
  );
}