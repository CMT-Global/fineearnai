import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { UserHeaderCard } from "@/components/layout/UserHeaderCard";
import { Badge } from "@/components/ui/badge";
import { Check } from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { EarnerBadgeStatus } from "@/lib/earner-badge-utils";

interface MobileUserBadgeProps {
  profile?: {
    username: string;
    full_name?: string | null;
    membership_plan: string;
    plan_expires_at?: string | null;
    account_status: string;
    earnings_wallet_balance: number;
    deposit_wallet_balance: number;
    earnerBadge?: EarnerBadgeStatus;
  } | null;
}

// Check if plan is expiring soon (< 7 days, not yet expired)
const isPlanExpiringSoon = (expiryDate?: string | null): boolean => {
  if (!expiryDate) return false;
  
  const now = new Date();
  const expiry = new Date(expiryDate);
  const diffTime = expiry.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return diffDays >= 0 && diffDays <= 7;
};

// Check if plan has expired
const isPlanExpired = (expiryDate?: string | null): boolean => {
  if (!expiryDate) return false;
  return new Date(expiryDate) < new Date();
};

export const MobileUserBadge = ({ profile }: MobileUserBadgeProps) => {
  const { t } = useTranslation();
  // Runtime type guard - validate profile structure
  const isValidProfile = (p: any): p is NonNullable<MobileUserBadgeProps['profile']> => {
    return p && 
           typeof p.username === 'string' && 
           typeof p.membership_plan === 'string' &&
           typeof p.account_status === 'string';
  };

  // Early return with loading skeleton if profile is not available
  if (!profile || !isValidProfile(profile)) {
    // Dev mode warning
    if (import.meta.env.DEV && profile) {
      console.warn('[MobileUserBadge] Invalid profile structure:', profile);
    }
    
    return (
      <button className="relative flex items-center justify-center" disabled>
        <div className="h-8 w-8 rounded-full bg-muted animate-pulse border-2 border-primary/20" />
      </button>
    );
  }

  const initial = profile.username?.charAt(0).toUpperCase() || 'U';
  const showExpiringSoon = useMemo(
    () => isPlanExpiringSoon(profile?.plan_expires_at),
    [profile?.plan_expires_at]
  );
  const showExpired = useMemo(
    () => isPlanExpired(profile?.plan_expires_at),
    [profile?.plan_expires_at]
  );

  return (
    <Sheet>
      <SheetTrigger asChild>
        <button className="relative flex items-center justify-center">
          <Avatar className="h-8 w-8 border-2 border-primary/20">
            <AvatarFallback className="bg-gradient-to-br from-primary to-primary/70 text-primary-foreground text-sm font-semibold">
              {initial}
            </AvatarFallback>
          </Avatar>
          
          {/* Verified Earner Checkmark - Bottom Right */}
          {profile.earnerBadge?.isVerified && (
            <span 
              className="absolute -bottom-0.5 -right-0.5 bg-green-500 rounded-full p-0.5 border border-background shadow-sm"
              title="Verified Earner"
            >
              <Check className="h-2.5 w-2.5 text-white stroke-[3]" />
            </span>
          )}
          
          {/* Notification Dot - Plan Expiring Soon (Top Right, takes priority over verification) */}
          {showExpiringSoon && !showExpired && (
            <span className="absolute -top-0.5 -right-0.5 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-orange-500 border border-background"></span>
            </span>
          )}
        </button>
      </SheetTrigger>
      
      <SheetContent 
        side="top" 
        className="h-auto max-h-[90vh] overflow-y-auto p-0"
      >
        <div className="bg-background">
          {/* Full User Details Card */}
          <UserHeaderCard profile={profile} />
          
          {/* Account Expired Banner */}
          {showExpired && (
            <div className="px-4 pb-4">
              <Badge variant="destructive" className="w-full justify-center py-2">
                {t("layout.mobile.accountExpiredBanner")}
              </Badge>
            </div>
          )}
          {/* Expiry Warning Banner - Plan Expiring Soon */}
          {showExpiringSoon && !showExpired && (
            <div className="px-4 pb-4">
              <Badge variant="warning" className="w-full justify-center py-2">
                {t("layout.mobile.planExpiringSoonBanner")}
              </Badge>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};
