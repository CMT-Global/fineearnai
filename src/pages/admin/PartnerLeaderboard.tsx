import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Trophy, Medal, Award, TrendingUp, Flame, Target, Crown, Star, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format, subDays, startOfWeek, endOfWeek } from "date-fns";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

type DateRange = "week" | "month" | "quarter" | "all";

interface Achievement {
  type: string;
  label: string;
  icon: any;
  color: string;
  description: string;
}

export default function PartnerLeaderboard() {
  const [dateRange, setDateRange] = useState<DateRange>("week");
  const [tierFilter, setTierFilter] = useState<string>("all");

  // Calculate date boundaries
  const getDateBoundaries = () => {
    const now = new Date();
    switch (dateRange) {
      case "week":
        return {
          start: format(startOfWeek(now), 'yyyy-MM-dd'),
          end: format(endOfWeek(now), 'yyyy-MM-dd'),
        };
      case "month":
        return {
          start: format(subDays(now, 30), 'yyyy-MM-dd'),
          end: format(now, 'yyyy-MM-dd'),
        };
      case "quarter":
        return {
          start: format(subDays(now, 90), 'yyyy-MM-dd'),
          end: format(now, 'yyyy-MM-dd'),
        };
      default:
        return { start: '2020-01-01', end: format(now, 'yyyy-MM-dd') };
    }
  };

  const { start, end } = getDateBoundaries();

  // Fetch bonus tiers
  const { data: tiers } = useQuery({
    queryKey: ["bonus-tiers-filter"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("partner_bonus_tiers")
        .select("*")
        .eq("is_active", true)
        .order("tier_order", { ascending: true });

      if (error) throw error;
      return data;
    },
  });

  // Fetch leaderboard data
  const { data: leaderboard, isLoading } = useQuery({
    queryKey: ["partner-leaderboard", dateRange, tierFilter, start, end],
    queryFn: async () => {
      // Get bonuses for date range
      let query = supabase
        .from("partner_weekly_bonuses")
        .select(`
          partner_id,
          bonus_amount,
          total_weekly_sales,
          week_start_date,
          status,
          qualified_tier_id,
          partner_bonus_tiers(tier_name, tier_order)
        `)
        .gte('week_start_date', start)
        .lte('week_end_date', end);

      if (tierFilter !== "all") {
        query = query.eq('qualified_tier_id', tierFilter);
      }

      const { data: bonuses, error } = await query;
      if (error) throw error;

      // Group by partner
      const partnerMap = bonuses.reduce((acc: any, bonus) => {
        const id = bonus.partner_id;
        if (!acc[id]) {
          acc[id] = {
            partner_id: id,
            total_bonus: 0,
            total_sales: 0,
            weeks_active: 0,
            paid_bonuses: 0,
            highest_tier: null,
            highest_tier_order: -1,
            weeks: [],
          };
        }
        
        acc[id].total_bonus += Number(bonus.bonus_amount);
        acc[id].total_sales += Number(bonus.total_weekly_sales);
        acc[id].weeks_active += 1;
        if (bonus.status === 'paid') acc[id].paid_bonuses += 1;
        
        // Track highest tier achieved
        const tierOrder = bonus.partner_bonus_tiers?.tier_order || -1;
        if (tierOrder > acc[id].highest_tier_order) {
          acc[id].highest_tier_order = tierOrder;
          acc[id].highest_tier = bonus.partner_bonus_tiers?.tier_name;
        }
        
        acc[id].weeks.push({
          week: bonus.week_start_date,
          sales: Number(bonus.total_weekly_sales),
          bonus: Number(bonus.bonus_amount),
        });
        
        return acc;
      }, {});

      // Get partner profiles
      const partnerIds = Object.keys(partnerMap);
      const { data: profiles, error: profileError } = await supabase
        .from("profiles")
        .select("id, username, email, full_name")
        .in('id', partnerIds);

      if (profileError) throw profileError;

      // Calculate achievements for each partner
      const partnersWithProfiles = partnerIds.map(id => {
        const partnerData = partnerMap[id];
        const profile = profiles.find(p => p.id === id);
        
        // Calculate consecutive weeks
        const sortedWeeks = partnerData.weeks
          .sort((a: any, b: any) => new Date(a.week).getTime() - new Date(b.week).getTime());
        
        let consecutiveWeeks = 0;
        let maxConsecutive = 0;
        let lastWeek: Date | null = null;
        
        sortedWeeks.forEach((week: any) => {
          const weekDate = new Date(week.week);
          if (lastWeek && (weekDate.getTime() - lastWeek.getTime()) <= 8 * 24 * 60 * 60 * 1000) {
            consecutiveWeeks++;
          } else {
            consecutiveWeeks = 1;
          }
          maxConsecutive = Math.max(maxConsecutive, consecutiveWeeks);
          lastWeek = weekDate;
        });

        // Calculate achievements
        const achievements: Achievement[] = [];
        
        // Consecutive weeks badges
        if (maxConsecutive >= 4) {
          achievements.push({
            type: 'streak_master',
            label: 'Streak Master',
            icon: Flame,
            color: 'text-orange-500',
            description: `${maxConsecutive} consecutive weeks`,
          });
        } else if (maxConsecutive >= 2) {
          achievements.push({
            type: 'consistent',
            label: 'Consistent',
            icon: Target,
            color: 'text-blue-500',
            description: `${maxConsecutive} week streak`,
          });
        }

        // High sales badges
        if (partnerData.total_sales >= 50000) {
          achievements.push({
            type: 'sales_legend',
            label: 'Sales Legend',
            icon: Crown,
            color: 'text-yellow-500',
            description: `$${partnerData.total_sales.toFixed(0)} in sales`,
          });
        } else if (partnerData.total_sales >= 10000) {
          achievements.push({
            type: 'top_seller',
            label: 'Top Seller',
            icon: Star,
            color: 'text-purple-500',
            description: `$${partnerData.total_sales.toFixed(0)} in sales`,
          });
        }

        // Tier milestone badges
        if (partnerData.highest_tier) {
          achievements.push({
            type: 'tier_achievement',
            label: `${partnerData.highest_tier} Tier`,
            icon: Award,
            color: 'text-green-500',
            description: 'Highest tier reached',
          });
        }

        // Bonus earnings badges
        if (partnerData.total_bonus >= 5000) {
          achievements.push({
            type: 'bonus_king',
            label: 'Bonus King',
            icon: Zap,
            color: 'text-yellow-600',
            description: `$${partnerData.total_bonus.toFixed(0)} in bonuses`,
          });
        }

        return {
          ...partnerData,
          username: profile?.username || 'Unknown',
          email: profile?.email || 'N/A',
          full_name: profile?.full_name || profile?.username || 'Unknown',
          avg_weekly_sales: partnerData.weeks_active > 0 
            ? partnerData.total_sales / partnerData.weeks_active 
            : 0,
          avg_weekly_bonus: partnerData.weeks_active > 0
            ? partnerData.total_bonus / partnerData.weeks_active
            : 0,
          consecutive_weeks: maxConsecutive,
          achievements,
        };
      });

      // Sort by total sales
      return partnersWithProfiles.sort((a, b) => b.total_sales - a.total_sales);
    },
  });

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Trophy className="h-6 w-6 text-yellow-500" />;
      case 2:
        return <Medal className="h-6 w-6 text-gray-400" />;
      case 3:
        return <Medal className="h-6 w-6 text-orange-600" />;
      default:
        return <div className="h-6 w-6 flex items-center justify-center font-bold text-muted-foreground">#{rank}</div>;
    }
  };

  const getRankBadgeColor = (rank: number) => {
    switch (rank) {
      case 1:
        return "bg-gradient-to-r from-yellow-400 to-yellow-600 text-white";
      case 2:
        return "bg-gradient-to-r from-gray-300 to-gray-500 text-white";
      case 3:
        return "bg-gradient-to-r from-orange-400 to-orange-600 text-white";
      default:
        return "bg-muted";
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-64" />
          <div className="flex gap-2">
            <Skeleton className="h-10 w-32" />
            <Skeleton className="h-10 w-32" />
          </div>
        </div>
        <div className="space-y-4">
          {[...Array(10)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <Skeleton className="h-12 w-12 rounded-full" />
                  <div className="flex-1">
                    <Skeleton className="h-6 w-48 mb-2" />
                    <Skeleton className="h-4 w-32" />
                  </div>
                  <Skeleton className="h-8 w-24" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Trophy className="h-8 w-8 text-yellow-500" />
            Partner Leaderboard
          </h1>
          <p className="text-muted-foreground">
            Top performing partners by sales and bonuses
          </p>
        </div>

        {/* Filters */}
        <div className="flex gap-2">
          <Select value={dateRange} onValueChange={(value) => setDateRange(value as DateRange)}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Date Range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="week">This Week</SelectItem>
              <SelectItem value="month">Last 30 Days</SelectItem>
              <SelectItem value="quarter">Last 90 Days</SelectItem>
              <SelectItem value="all">All Time</SelectItem>
            </SelectContent>
          </Select>

          <Select value={tierFilter} onValueChange={setTierFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Tier Filter" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Tiers</SelectItem>
              {tiers?.map(tier => (
                <SelectItem key={tier.id} value={tier.id}>{tier.tier_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Leaderboard */}
      {leaderboard && leaderboard.length > 0 ? (
        <div className="space-y-3">
          {leaderboard.map((partner: any, index: number) => {
            const rank = index + 1;
            const isTopThree = rank <= 3;

            return (
              <Card
                key={partner.partner_id}
                className={`transition-all hover:shadow-lg ${
                  isTopThree ? 'border-2' : ''
                } ${
                  rank === 1 ? 'border-yellow-500/50 bg-yellow-50/30 dark:bg-yellow-950/20' :
                  rank === 2 ? 'border-gray-400/50 bg-gray-50/30 dark:bg-gray-950/20' :
                  rank === 3 ? 'border-orange-500/50 bg-orange-50/30 dark:bg-orange-950/20' : ''
                }`}
              >
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    {/* Rank */}
                    <div className={`flex-shrink-0 w-16 h-16 rounded-full flex items-center justify-center ${getRankBadgeColor(rank)}`}>
                      {getRankIcon(rank)}
                    </div>

                    {/* Partner Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-xl font-bold truncate">{partner.full_name}</h3>
                        {isTopThree && (
                          <Badge variant="secondary" className="ml-2">
                            Top {rank}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground truncate">{partner.email}</p>
                      
                      {/* Achievements */}
                      {partner.achievements && partner.achievements.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-3">
                          {partner.achievements.map((achievement: Achievement, i: number) => {
                            const Icon = achievement.icon;
                            return (
                              <Badge
                                key={i}
                                variant="outline"
                                className="flex items-center gap-1"
                                title={achievement.description}
                              >
                                <Icon className={`h-3 w-3 ${achievement.color}`} />
                                <span className="text-xs">{achievement.label}</span>
                              </Badge>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Stats */}
                    <div className="text-right space-y-2">
                      <div>
                        <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                          ${partner.total_sales.toFixed(2)}
                        </div>
                        <div className="text-xs text-muted-foreground">Total Sales</div>
                      </div>
                      <div>
                        <div className="text-lg font-semibold text-blue-600 dark:text-blue-400">
                          ${partner.total_bonus.toFixed(2)}
                        </div>
                        <div className="text-xs text-muted-foreground">Total Bonus</div>
                      </div>
                    </div>

                    {/* Additional Metrics */}
                    <div className="text-right space-y-2 border-l pl-4 hidden lg:block">
                      <div>
                        <div className="text-sm font-medium">{partner.weeks_active}</div>
                        <div className="text-xs text-muted-foreground">Active Weeks</div>
                      </div>
                      <div>
                        <div className="text-sm font-medium">${partner.avg_weekly_sales.toFixed(0)}</div>
                        <div className="text-xs text-muted-foreground">Avg/Week</div>
                      </div>
                      {partner.consecutive_weeks > 1 && (
                        <div className="flex items-center justify-end gap-1 text-orange-600 dark:text-orange-400">
                          <Flame className="h-3 w-3" />
                          <span className="text-sm font-medium">{partner.consecutive_weeks}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Alert>
          <TrendingUp className="h-4 w-4" />
          <AlertDescription>
            No leaderboard data available for the selected filters. Try adjusting your date range or tier filter.
          </AlertDescription>
        </Alert>
      )}

      {/* Legend */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Achievement Badges</CardTitle>
          <CardDescription>Earn badges by reaching milestones</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            <div className="flex items-start gap-2">
              <Flame className="h-4 w-4 text-orange-500 mt-0.5" />
              <div>
                <div className="text-sm font-medium">Streak Master</div>
                <div className="text-xs text-muted-foreground">4+ consecutive weeks</div>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Target className="h-4 w-4 text-blue-500 mt-0.5" />
              <div>
                <div className="text-sm font-medium">Consistent</div>
                <div className="text-xs text-muted-foreground">2+ week streak</div>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Crown className="h-4 w-4 text-yellow-500 mt-0.5" />
              <div>
                <div className="text-sm font-medium">Sales Legend</div>
                <div className="text-xs text-muted-foreground">$50K+ in sales</div>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Star className="h-4 w-4 text-purple-500 mt-0.5" />
              <div>
                <div className="text-sm font-medium">Top Seller</div>
                <div className="text-xs text-muted-foreground">$10K+ in sales</div>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Zap className="h-4 w-4 text-yellow-600 mt-0.5" />
              <div>
                <div className="text-sm font-medium">Bonus King</div>
                <div className="text-xs text-muted-foreground">$5K+ in bonuses</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
