import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Award, DollarSign, TrendingUp, Clock, Target, Zap } from "lucide-react";
import { format, differenceInDays, differenceInHours } from "date-fns";

interface BonusTier {
  id: string;
  name: string;
  bonus_percentage: number;
  min_sales: number;
  max_sales: number;
}

interface BonusProgressData {
  success: boolean;
  week_start_date: string;
  week_end_date: string;
  current_week_sales: number;
  current_tier: BonusTier | null;
  current_bonus: number;
  next_tier: BonusTier | null;
  amount_to_next_tier: number;
  progress_to_next_tier: number;
  potential_bonus_at_next_tier: number;
  all_tiers: BonusTier[];
  velocity: {
    days_into_week: number;
    days_remaining: number;
    daily_average_sales: number;
    projected_week_end_sales: number;
    projected_tier: string | null;
    projected_bonus: number;
  };
  countdown: {
    days: number;
    hours: number;
    message: string;
  };
}

export function WeeklyBonusProgressCard() {
  const { data: progressData, isLoading } = useQuery({
    queryKey: ["partner-bonus-progress"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("get-partner-bonus-progress");
      if (error) throw error;
      return data as BonusProgressData;
    },
    refetchInterval: 60000, // Refresh every minute
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            Weekly Bonus Progress
          </CardTitle>
          <CardDescription>Loading your bonus progress...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="h-20 bg-muted animate-pulse rounded-lg" />
            <div className="h-32 bg-muted animate-pulse rounded-lg" />
            <div className="h-24 bg-muted animate-pulse rounded-lg" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!progressData?.success) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            Weekly Bonus Progress
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            Unable to load bonus progress
          </div>
        </CardContent>
      </Card>
    );
  }

  const weekPeriod = `${format(new Date(progressData.week_start_date), "MMM d")} - ${format(new Date(progressData.week_end_date), "MMM d, yyyy")}`;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" />
              Weekly Bonus Progress
            </CardTitle>
            <CardDescription>Week of {weekPeriod}</CardDescription>
          </div>
          <Badge variant="outline" className="text-sm">
            <Clock className="h-3 w-3 mr-1" />
            {progressData.countdown.message}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Key Metrics Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="border-primary/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Current Week Sales</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">${progressData.current_week_sales.toFixed(2)}</div>
            </CardContent>
          </Card>

          <Card className="border-success/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Current Bonus</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-success">${progressData.current_bonus.toFixed(2)}</div>
              {progressData.current_tier && (
                <p className="text-xs text-muted-foreground mt-1">
                  {(progressData.current_tier.bonus_percentage * 100).toFixed(1)}% rate
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="border-warning/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Potential Bonus</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-warning">${progressData.potential_bonus_at_next_tier.toFixed(2)}</div>
              {progressData.next_tier && (
                <p className="text-xs text-muted-foreground mt-1">At next tier</p>
              )}
            </CardContent>
          </Card>

          <Card className="border-muted">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">To Next Tier</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${progressData.amount_to_next_tier.toFixed(2)}</div>
              {progressData.next_tier && (
                <p className="text-xs text-muted-foreground mt-1">{progressData.next_tier.name}</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Current Tier & Progress */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Award className="h-5 w-5 text-primary" />
              <span className="font-semibold">
                {progressData.current_tier ? progressData.current_tier.name : "No Tier Yet"}
              </span>
              {progressData.current_tier && (
                <Badge className="bg-primary/10 text-primary hover:bg-primary/20">
                  {(progressData.current_tier.bonus_percentage * 100).toFixed(1)}% Bonus
                </Badge>
              )}
            </div>
            {progressData.next_tier && (
              <span className="text-sm text-muted-foreground">
                Next: {progressData.next_tier.name} ({(progressData.next_tier.bonus_percentage * 100).toFixed(1)}%)
              </span>
            )}
          </div>

          <Progress value={progressData.progress_to_next_tier} className="h-3" />

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>${progressData.current_tier?.min_sales.toFixed(0) || '0'}</span>
            <span className="font-medium text-primary">
              {progressData.progress_to_next_tier.toFixed(1)}% Complete
            </span>
            <span>
              {progressData.next_tier 
                ? `$${progressData.next_tier.min_sales.toFixed(0)}`
                : '∞'
              }
            </span>
          </div>
        </div>

        {/* Tier Visualization */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 mb-3">
            <Target className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">All Bonus Tiers</span>
          </div>
          <div className="space-y-2">
            {progressData.all_tiers.map((tier, index) => {
              const isCurrentTier = progressData.current_tier?.id === tier.id;
              const isNextTier = progressData.next_tier?.id === tier.id;
              const isPastTier = progressData.current_tier && tier.min_sales < progressData.current_tier.min_sales;

              return (
                <div
                  key={tier.id}
                  className={`relative rounded-lg p-3 transition-all ${
                    isCurrentTier
                      ? 'bg-primary/10 border border-primary'
                      : isNextTier
                      ? 'bg-warning/5 border border-warning/30'
                      : isPastTier
                      ? 'bg-muted/50 border border-transparent'
                      : 'bg-muted border border-transparent'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Award className={`h-4 w-4 ${isCurrentTier ? 'text-primary' : 'text-muted-foreground'}`} />
                      <span className={`font-medium ${isCurrentTier ? 'text-primary' : ''}`}>
                        {tier.name}
                      </span>
                      {isCurrentTier && (
                        <Badge variant="default" className="text-xs">You are here</Badge>
                      )}
                      {isNextTier && (
                        <Badge variant="outline" className="text-xs border-warning text-warning">Next tier</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                      <span className="text-muted-foreground">
                        ${tier.min_sales.toFixed(0)} - ${tier.max_sales >= 999999999 ? '∞' : tier.max_sales.toFixed(0)}
                      </span>
                      <Badge className={isCurrentTier ? 'bg-primary' : 'bg-muted'}>
                        {(tier.bonus_percentage * 100).toFixed(1)}%
                      </Badge>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Sales Velocity & Projections */}
        <Card className="bg-muted/30 border-muted">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Sales Velocity & Projection
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Daily Average</p>
                <p className="font-semibold text-lg">${progressData.velocity.daily_average_sales.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Days Remaining</p>
                <p className="font-semibold text-lg">{progressData.velocity.days_remaining} days</p>
              </div>
              <div>
                <p className="text-muted-foreground">Projected Week-End Sales</p>
                <p className="font-semibold text-lg text-primary">${progressData.velocity.projected_week_end_sales.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Projected Tier</p>
                <p className="font-semibold text-lg">
                  {progressData.velocity.projected_tier || progressData.current_tier?.name || "None"}
                </p>
              </div>
            </div>
            <div className="pt-2 border-t border-border">
              <p className="text-xs text-muted-foreground">Projected Bonus at Current Pace</p>
              <p className="text-2xl font-bold text-success mt-1">${progressData.velocity.projected_bonus.toFixed(2)}</p>
            </div>
            {progressData.velocity.projected_tier !== progressData.current_tier?.name && progressData.velocity.projected_tier && (
              <div className="p-3 bg-success/10 border border-success/20 rounded-lg">
                <p className="text-sm text-success font-medium">
                  🎯 At your current pace, you'll reach the {progressData.velocity.projected_tier} tier by week's end!
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </CardContent>
    </Card>
  );
}
