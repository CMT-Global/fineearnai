import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { User, Calendar, TrendingUp } from "lucide-react";
import { toast } from "sonner";

interface UplineInfoCardProps {
  userId: string;
}

interface UplineInfo {
  referrer: {
    id: string;
    username: string;
    email: string;
    membershipPlan: string;
    joinedAt: string;
  };
  referralInfo: {
    joinedVia: string;
    totalCommissionEarned: number;
    status: string;
  };
}

export const UplineInfoCard = ({ userId }: UplineInfoCardProps) => {
  const [uplineInfo, setUplineInfo] = useState<UplineInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUplineInfo();
  }, [userId]);

  const loadUplineInfo = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("get-referrer-info", {
        headers: {
          Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
      });

      if (error) {
        console.error("Error loading upline info:", error);
        return;
      }

      if (data?.hasReferrer) {
        setUplineInfo(data);
      }
    } catch (error) {
      console.error("Error:", error);
      toast.error("Failed to load upline information");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card className="p-6">
        <p className="text-sm text-muted-foreground">Loading upline information...</p>
      </Card>
    );
  }

  if (!uplineInfo) {
    return (
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-2">
          <User className="h-5 w-5" />
          <h3 className="font-semibold">Your Upline</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          You joined directly without a referrer
        </p>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 mb-4">
        <User className="h-5 w-5" />
        <h3 className="font-semibold">Your Upline</h3>
      </div>

      <div className="space-y-3">
        <div>
          <p className="text-sm text-muted-foreground">Referred by</p>
          <p className="font-medium">{uplineInfo.referrer.username}</p>
          {uplineInfo.referrer.email && (
            <p className="text-sm text-muted-foreground">{uplineInfo.referrer.email}</p>
          )}
        </div>

        <div className="flex items-center gap-2 text-sm">
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
          <span className="text-muted-foreground">Plan:</span>
          <span className="capitalize font-medium">{uplineInfo.referrer.membershipPlan}</span>
        </div>

        <div className="flex items-center gap-2 text-sm">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <span className="text-muted-foreground">Member since:</span>
          <span className="font-medium">
            {new Date(uplineInfo.referrer.joinedAt).toLocaleDateString()}
          </span>
        </div>

        {uplineInfo.referralInfo.status && (
          <div className="pt-2 border-t">
            <p className="text-sm">
              <span className="text-muted-foreground">Status: </span>
              <span className={`capitalize font-medium ${
                uplineInfo.referralInfo.status === 'active' 
                  ? 'text-green-600' 
                  : 'text-orange-600'
              }`}>
                {uplineInfo.referralInfo.status}
              </span>
            </p>
          </div>
        )}
      </div>
    </Card>
  );
};
