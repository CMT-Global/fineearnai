import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Settings } from "lucide-react";
import { Link } from "react-router-dom";
import { useMemo } from "react";

interface UserHeaderCardProps {
  profile?: {
    username: string;
    full_name?: string | null;
    membership_plan: string;
    plan_expires_at?: string | null;
    account_status: string;
    earnings_wallet_balance: number;
    deposit_wallet_balance: number;
  } | null;
}

// Utility: Calculate days until expiry with human-readable format
const calculateDaysUntilExpiry = (expiryDate?: string | null): string => {
  if (!expiryDate) return "No expiry";
  
  const now = new Date();
  const expiry = new Date(expiryDate);
  const diffTime = expiry.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays < 0) return "Expired";
  if (diffDays === 0) return "Expires today";
  if (diffDays === 1) return "1d left";
  if (diffDays < 30) return `${diffDays}d left`;
  if (diffDays < 60) return "1 month";
  if (diffDays < 365) {
    const months = Math.floor(diffDays / 30);
    return `${months} months`;
  }
  const years = Math.floor(diffDays / 365);
  return years === 1 ? "1 year" : `${years} years`;
};

// Utility: Get status color based on account status and expiry
const getAccountStatusColor = (
  status: string,
  expiryDate?: string | null
): 'default' | 'secondary' | 'destructive' | 'warning' => {
  // Check for expired plan first
  if (expiryDate) {
    const now = new Date();
    const expiry = new Date(expiryDate);
    const diffTime = expiry.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return 'destructive'; // Expired
    if (diffDays <= 7) return 'warning'; // Expiring soon
  }
  
  // Account status
  if (status === 'suspended' || status === 'banned') return 'destructive';
  if (status === 'active') return 'default';
  
  return 'secondary';
};

// Sub-component: Account Status Dot
const AccountStatusDot = ({ 
  status, 
  expiryDate 
}: { 
  status: string; 
  expiryDate?: string | null;
}) => {
  const statusColor = getAccountStatusColor(status, expiryDate);
  const displayStatus = status.charAt(0).toUpperCase() + status.slice(1);
  
  return (
    <Badge variant={statusColor} className="text-xs">
      {displayStatus}
    </Badge>
  );
};

// Sub-component: Expiry Countdown
const ExpiryCountdown = ({ expiryDate }: { expiryDate?: string | null }) => {
  const countdown = useMemo(() => calculateDaysUntilExpiry(expiryDate), [expiryDate]);
  
  if (countdown === "No expiry") return null;
  
  const isExpired = countdown === "Expired";
  const isExpiringSoon = countdown.includes("d left") && 
    parseInt(countdown) <= 7;
  
  return (
    <span 
      className={`text-xs ${
        isExpired 
          ? 'text-destructive font-medium' 
          : isExpiringSoon 
          ? 'text-orange-500 font-medium'
          : 'text-muted-foreground'
      }`}
    >
      {countdown}
    </span>
  );
};

// Sub-component: Wallet Quick View (kept for backward compatibility - not rendered)
// This component is temporarily preserved but not used in the UI

export const UserHeaderCard = ({ profile }: UserHeaderCardProps) => {
  // Early return with loading skeleton if profile is not available
  if (!profile) {
    return (
      <div className="p-4 border-b bg-gradient-to-br from-primary/5 to-transparent">
        <div className="flex items-start gap-3 mb-3">
          <div className="h-12 w-12 rounded-full bg-muted animate-pulse" />
          <div className="flex-1 min-w-0 space-y-2">
            <div className="h-4 w-32 bg-muted animate-pulse rounded" />
            <div className="flex items-center gap-2">
              <div className="h-5 w-20 bg-muted animate-pulse rounded" />
              <div className="h-5 w-16 bg-muted animate-pulse rounded" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  const initial = profile.username?.charAt(0).toUpperCase() || 'U';
  const displayName = profile.full_name || profile.username;
  
  // Format membership plan name for display
  const planDisplayName = profile.membership_plan
    ?.split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ') || 'Free';
  
  return (
    <div className="p-4 border-b bg-gradient-to-br from-primary/5 to-transparent">
      {/* User Avatar & Info */}
      <div className="flex items-start gap-3 mb-3">
        <Avatar className="h-12 w-12 border-2 border-primary/20">
          <AvatarFallback className="bg-gradient-to-br from-primary to-primary/70 text-primary-foreground text-lg font-semibold">
            {initial}
          </AvatarFallback>
        </Avatar>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-sm font-semibold truncate">
              {displayName}
            </h3>
            <Link to="/settings">
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-6 w-6 shrink-0"
                title="Settings"
              >
                <Settings className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>
          
          {/* Plan & Status Row */}
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="secondary" className="text-xs font-medium">
              {planDisplayName}
            </Badge>
            <AccountStatusDot 
              status={profile.account_status} 
              expiryDate={profile.plan_expires_at}
            />
            <ExpiryCountdown expiryDate={profile.plan_expires_at} />
          </div>
        </div>
      </div>
    </div>
  );
};
