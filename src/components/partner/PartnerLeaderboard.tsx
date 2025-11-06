import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/lib/wallet-utils";
import { Trophy, Medal, Award, TrendingUp } from "lucide-react";
import { PartnerLeaderboardSkeleton } from "@/components/partner/PartnerLeaderboardSkeleton";

export const PartnerLeaderboard = () => {
  const [timePeriod, setTimePeriod] = useState("month");

  const { data, isLoading } = useQuery({
    queryKey: ['partner-leaderboard', timePeriod],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('get-partner-leaderboard', {
        body: { time_period: timePeriod }
      });

      if (error) throw error;
      return data;
    },
  });

  if (!data?.enabled) {
    return null;
  }

  const getRankColor = (rankName: string) => {
    const colors: Record<string, string> = {
      bronze: "bg-orange-500",
      silver: "bg-gray-400",
      gold: "bg-yellow-500",
      platinum: "bg-purple-500",
    };
    return colors[rankName?.toLowerCase()] || "bg-blue-500";
  };

  const getPositionIcon = (position: number) => {
    if (position === 1) return <Trophy className="h-5 w-5 text-yellow-500" />;
    if (position === 2) return <Medal className="h-5 w-5 text-gray-400" />;
    if (position === 3) return <Medal className="h-5 w-5 text-orange-600" />;
    return <span className="text-sm font-semibold text-muted-foreground">#{position}</span>;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Partner Leaderboard
            </CardTitle>
            <CardDescription>
              Top performing partners in the community
            </CardDescription>
          </div>
          <Select value={timePeriod} onValueChange={setTimePeriod}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="week">This Week</SelectItem>
              <SelectItem value="month">This Month</SelectItem>
              <SelectItem value="year">This Year</SelectItem>
              <SelectItem value="all_time">All Time</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <PartnerLeaderboardSkeleton />
        ) : data?.leaderboard && data.leaderboard.length > 0 ? (
          <div className="space-y-3">
            {data.leaderboard.map((partner: any, index: number) => (
              <div
                key={partner.partner_id}
                className={`flex items-center gap-4 p-4 rounded-lg border-2 transition-all ${
                  index < 3 
                    ? 'bg-gradient-to-r from-primary/5 to-transparent border-primary/20' 
                    : 'bg-muted/30 border-border'
                }`}
              >
                <div className="flex items-center justify-center w-10">
                  {getPositionIcon(index + 1)}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-semibold truncate">
                      {partner.username}
                    </p>
                    <Badge className={`${getRankColor(partner.rank)} text-white text-xs`}>
                      {partner.rank?.toUpperCase()}
                    </Badge>
                  </div>
                  <div className="flex gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Trophy className="h-3 w-3" />
                      {partner.vouchers_sold} vouchers
                    </span>
                  </div>
                </div>

                <div className="text-right">
                  <p className="text-lg font-bold text-primary">
                    {formatCurrency(partner.total_sales)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatCurrency(partner.total_commission)} earned
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <Award className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">
              No leaderboard data available for this period
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
