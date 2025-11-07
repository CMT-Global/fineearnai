import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trophy, DollarSign, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

interface TopReferrer {
  user_id: string;
  username: string;
  country_code: string;
  country_name: string;
  referral_count: number;
  total_commission: number;
  total_referral_deposits: number;
  rank: number;
}

interface TopReferrersCardProps {
  data: TopReferrer[];
  dateRange: { startDate: string; endDate: string };
}

const getRankColor = (rank: number) => {
  if (rank === 1) return "text-yellow-500";
  if (rank === 2) return "text-gray-400";
  if (rank === 3) return "text-amber-600";
  return "text-muted-foreground";
};

const getRankBadgeVariant = (rank: number): "default" | "secondary" | "outline" => {
  if (rank <= 3) return "default";
  if (rank <= 10) return "secondary";
  return "outline";
};

export const TopReferrersCard = ({ data, dateRange }: TopReferrersCardProps) => {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5" />
            Top 20 Referrers
          </CardTitle>
          <Badge variant="outline" className="text-xs">
            {format(new Date(dateRange.startDate), "MMM dd")} - {format(new Date(dateRange.endDate), "MMM dd")}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Highest performing referrers ranked by total commission earned
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {data.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No referrer data available for the selected period
            </div>
          ) : (
            data.map((referrer) => (
              <div 
                key={referrer.user_id} 
                className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
              >
                <div className="flex items-center gap-3 flex-1">
                  <div className={`font-bold text-lg min-w-[2rem] text-center ${getRankColor(referrer.rank)}`}>
                    #{referrer.rank}
                  </div>
                  <span 
                    className="text-2xl"
                    title={referrer.country_name}
                  >
                    {referrer.country_code ? 
                      String.fromCodePoint(...[...referrer.country_code.toUpperCase()].map(c => 127397 + c.charCodeAt(0))) 
                      : '🌍'
                    }
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{referrer.username}</div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {referrer.referral_count} refs
                      </span>
                      <span className="flex items-center gap-1">
                        <DollarSign className="h-3 w-3" />
                        ${referrer.total_referral_deposits.toLocaleString()} deposits
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Badge variant={getRankBadgeVariant(referrer.rank)}>
                    ${referrer.total_commission.toLocaleString()}
                  </Badge>
                  <span className="text-xs text-muted-foreground">commission</span>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
};
