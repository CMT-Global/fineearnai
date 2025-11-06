import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Award, TrendingUp, Target } from "lucide-react";
import { formatCurrency } from "@/lib/wallet-utils";

interface Rank {
  id: string;
  rank_name: string;
  daily_sales_target: number;
  commission_rate: number;
  rank_order: number;
}

interface RankProgressCardProps {
  currentRank: string;
  totalSales: number;
  ranks: Rank[];
}

export const RankProgressCard = ({ currentRank, totalSales, ranks }: RankProgressCardProps) => {
  const sortedRanks = [...ranks].sort((a, b) => a.rank_order - b.rank_order);
  
  const currentRankData = sortedRanks.find(
    r => r.rank_name.toLowerCase() === currentRank.toLowerCase()
  );
  
  const currentRankIndex = sortedRanks.findIndex(
    r => r.rank_name.toLowerCase() === currentRank.toLowerCase()
  );
  
  const nextRank = currentRankIndex >= 0 && currentRankIndex < sortedRanks.length - 1
    ? sortedRanks[currentRankIndex + 1]
    : null;

  const currentTarget = currentRankData?.daily_sales_target || 0;
  const nextTarget = nextRank?.daily_sales_target || currentTarget;
  const progressToNext = nextRank 
    ? Math.min(((totalSales - currentTarget) / (nextTarget - currentTarget)) * 100, 100)
    : 100;

  const getRankColor = (rankName: string) => {
    const colors: Record<string, string> = {
      bronze: "bg-orange-500",
      silver: "bg-gray-400",
      gold: "bg-yellow-500",
      platinum: "bg-purple-500",
    };
    return colors[rankName.toLowerCase()] || "bg-blue-500";
  };

  const getRankTextColor = (rankName: string) => {
    const colors: Record<string, string> = {
      bronze: "text-orange-500",
      silver: "text-gray-400",
      gold: "text-yellow-500",
      platinum: "text-purple-500",
    };
    return colors[rankName.toLowerCase()] || "text-blue-500";
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Award className="h-5 w-5" />
          Rank Progression
        </CardTitle>
        <CardDescription>
          Your journey through partner ranks
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Current Rank Display */}
        <div className="text-center p-6 bg-gradient-to-br from-primary/10 to-primary/5 rounded-lg border-2 border-primary/20">
          <p className="text-sm text-muted-foreground mb-2">Current Rank</p>
          <Badge className={`${getRankColor(currentRank)} text-white text-lg py-2 px-4`}>
            <Award className="h-5 w-5 mr-2" />
            {currentRank.toUpperCase()}
          </Badge>
          {currentRankData && (
            <p className="text-2xl font-bold mt-3">
              {(currentRankData.commission_rate * 100).toFixed(0)}% Commission
            </p>
          )}
        </div>

        {/* Progress to Next Rank */}
        {nextRank ? (
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Progress to {nextRank.rank_name}</span>
              </div>
              <Badge variant="outline" className={getRankTextColor(nextRank.rank_name)}>
                {(nextRank.commission_rate * 100).toFixed(0)}% rate
              </Badge>
            </div>
            
            <Progress value={progressToNext} className="h-3" />
            
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                {formatCurrency(totalSales)} sales
              </span>
              <span className="font-medium">
                {formatCurrency(nextTarget - totalSales)} to go
              </span>
            </div>

            <div className="p-3 bg-muted/50 rounded-lg">
              <div className="flex items-start gap-2">
                <Target className="h-4 w-4 mt-0.5 text-muted-foreground" />
                <div className="text-xs">
                  <p className="font-medium mb-1">Next Milestone:</p>
                  <p className="text-muted-foreground">
                    Reach {formatCurrency(nextTarget)} in total sales to unlock {nextRank.rank_name} rank
                    with {((nextRank.commission_rate - (currentRankData?.commission_rate || 0)) * 100).toFixed(0)}% 
                    higher commission
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center p-6 bg-gradient-to-br from-purple-500/10 to-purple-500/5 rounded-lg border-2 border-purple-500/20">
            <Award className="h-12 w-12 mx-auto mb-3 text-purple-500" />
            <p className="font-semibold text-purple-600 mb-1">Maximum Rank Achieved!</p>
            <p className="text-sm text-muted-foreground">
              You've reached the highest partner rank. Keep up the amazing work!
            </p>
          </div>
        )}

        {/* All Ranks Overview */}
        <div className="space-y-2">
          <p className="text-sm font-medium mb-3">All Ranks</p>
          <div className="space-y-2">
            {sortedRanks.map((rank, idx) => {
              const isCurrentRank = rank.rank_name.toLowerCase() === currentRank.toLowerCase();
              const isAchieved = totalSales >= rank.daily_sales_target;
              
              return (
                <div
                  key={rank.id}
                  className={`flex items-center justify-between p-3 rounded-lg border-2 transition-all ${
                    isCurrentRank 
                      ? 'border-primary bg-primary/5' 
                      : isAchieved
                      ? 'border-green-500/30 bg-green-500/5'
                      : 'border-border bg-muted/30'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Badge 
                      className={`${getRankColor(rank.rank_name)} text-white`}
                      variant={isAchieved ? "default" : "outline"}
                    >
                      {rank.rank_name}
                    </Badge>
                    <div className="text-sm">
                      <p className="font-medium">{(rank.commission_rate * 100).toFixed(0)}% commission</p>
                      <p className="text-xs text-muted-foreground">
                        {formatCurrency(rank.daily_sales_target)} sales target
                      </p>
                    </div>
                  </div>
                  {isCurrentRank && (
                    <Badge variant="secondary">Current</Badge>
                  )}
                  {isAchieved && !isCurrentRank && (
                    <Badge variant="outline" className="text-green-600 border-green-600">
                      Unlocked
                    </Badge>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
