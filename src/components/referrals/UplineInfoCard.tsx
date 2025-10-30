import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { CurrencyDisplay } from "@/components/ui/CurrencyDisplay";
import { UserPlus, Link2, Calendar, UserCheck } from "lucide-react";
import { format } from "date-fns";

interface UplineInfoCardProps {
  upline: {
    username: string;
    membership_plan: string;
    referralCodeUsed: string;
    totalCommissionEarned: number;
    referralStatus: string;
    referredOn: string;
  } | null;
  isLoading?: boolean;
}

export const UplineInfoCard = ({ upline, isLoading }: UplineInfoCardProps) => {
  if (isLoading) {
    return (
      <Card className="p-6 mb-8">
        <div className="flex items-center gap-2 mb-4">
          <UserPlus className="h-5 w-5" />
          <h2 className="text-xl font-semibold">My Upline</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Skeleton className="h-20 col-span-full" />
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
        </div>
      </Card>
    );
  }

  if (!upline) {
    return (
      <Card className="p-6 mb-8">
        <div className="flex items-center gap-2 mb-4">
          <UserPlus className="h-5 w-5" />
          <h2 className="text-xl font-semibold">My Upline</h2>
        </div>
        <div className="flex items-center gap-2 text-muted-foreground">
          <Link2 className="h-4 w-4" />
          <p className="text-sm">You signed up without a referral link</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6 mb-8">
      <div className="flex items-center gap-2 mb-4">
        <UserPlus className="h-5 w-5" />
        <h2 className="text-xl font-semibold">My Upline</h2>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="col-span-full mb-2">
          <p className="text-sm text-muted-foreground mb-1">Upline Username</p>
          <div className="flex items-center gap-2">
            <UserCheck className="h-6 w-6 text-primary" />
            <p className="font-bold text-2xl text-primary">{upline.username}</p>
          </div>
        </div>
        
        <div>
          <p className="text-sm text-muted-foreground mb-1">Upline Plan</p>
          <Badge variant="outline" className="capitalize">
            {upline.membership_plan}
          </Badge>
        </div>
        
        <div>
          <p className="text-sm text-muted-foreground mb-1">Referral Code Used</p>
          <p className="font-mono font-medium">{upline.referralCodeUsed}</p>
        </div>
        
        <div>
          <p className="text-sm text-muted-foreground mb-1">Referral Status</p>
          <Badge variant={upline.referralStatus === "active" ? "default" : "secondary"}>
            {upline.referralStatus}
          </Badge>
        </div>
        
        <div>
          <p className="text-sm text-muted-foreground mb-1">Total Commission Earned by Upline</p>
          <p className="font-medium text-lg text-green-600">
            <CurrencyDisplay amountUSD={upline.totalCommissionEarned} />
          </p>
        </div>
        
        <div>
          <p className="text-sm text-muted-foreground mb-1">
            <Calendar className="h-4 w-4 inline mr-1" />
            Referred On
          </p>
          <p className="font-medium">
            {format(new Date(upline.referredOn), "PPP")}
          </p>
        </div>
      </div>
    </Card>
  );
};
