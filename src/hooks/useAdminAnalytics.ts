import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { subDays, differenceInDays, parseISO } from "date-fns";

export interface DailyBreakdown {
  date: string;
  count: number;
  volume?: number;
}

export interface UserGrowthStats {
  today_count: number;
  yesterday_count: number;
  last_7days_count: number;
  daily_breakdown: DailyBreakdown[];
}

export interface DepositStats {
  today_count: number;
  yesterday_count: number;
  last_7days_count: number;
  today_volume: number;
  yesterday_volume: number;
  last_7days_volume: number;
  daily_breakdown: DailyBreakdown[];
}

export interface ReferralStats {
  today_count: number;
  last_7days_count: number;
  daily_breakdown: DailyBreakdown[];
}

export interface PlanUpgradeStats {
  today_count: number;
  yesterday_count: number;
  last_7days_count: number;
  today_volume: number;
  yesterday_volume: number;
  last_7days_volume: number;
  daily_breakdown: DailyBreakdown[];
}

export interface PeriodComparison {
  current: number;
  previous: number;
  change: number;
  changePercent: number;
}

export interface AdminAnalyticsData {
  userGrowth: UserGrowthStats | null;
  deposits: DepositStats | null;
  referrals: ReferralStats | null;
  planUpgrades: PlanUpgradeStats | null;
  comparisons?: {
    userCount: PeriodComparison;
    depositVolume: PeriodComparison;
    referralCount: PeriodComparison;
    upgradeRevenue: PeriodComparison;
  };
}

export interface DateRange {
  startDate: string; // ISO date string (YYYY-MM-DD)
  endDate: string;   // ISO date string (YYYY-MM-DD)
}

const calculateComparison = (current: number, previous: number): PeriodComparison => {
  const change = current - previous;
  const changePercent = previous > 0 ? ((change / previous) * 100) : (current > 0 ? 100 : 0);
  
  return {
    current,
    previous,
    change,
    changePercent: parseFloat(changePercent.toFixed(2))
  };
};

export const useAdminAnalytics = (dateRange?: DateRange) => {
  return useQuery({
    queryKey: ["admin-analytics", dateRange],
    queryFn: async () => {
      // Prepare current period parameters
      const currentParams = dateRange ? {
        p_start_date: dateRange.startDate,
        p_end_date: dateRange.endDate
      } : {};

      // Calculate previous period parameters for comparison
      let previousParams = {};
      if (dateRange) {
        const startDate = parseISO(dateRange.startDate);
        const endDate = parseISO(dateRange.endDate);
        const periodDays = differenceInDays(endDate, startDate);
        
        const previousEndDate = subDays(startDate, 1);
        const previousStartDate = subDays(previousEndDate, periodDays);
        
        previousParams = {
          p_start_date: previousStartDate.toISOString().split('T')[0],
          p_end_date: previousEndDate.toISOString().split('T')[0]
        };
      }

      // Fetch current period data
      const [userGrowthRes, depositsRes, referralsRes, planUpgradesRes] = await Promise.all([
        supabase.rpc("get_user_growth_stats" as any, currentParams),
        supabase.rpc("get_deposit_stats" as any, currentParams),
        supabase.rpc("get_referral_stats_overview" as any, currentParams),
        supabase.rpc("get_plan_upgrade_stats", currentParams),
      ]);

      // Fetch previous period data for comparison
      const [prevUserGrowthRes, prevDepositsRes, prevReferralsRes, prevPlanUpgradesRes] = await Promise.all([
        supabase.rpc("get_user_growth_stats" as any, previousParams),
        supabase.rpc("get_deposit_stats" as any, previousParams),
        supabase.rpc("get_referral_stats_overview" as any, previousParams),
        supabase.rpc("get_plan_upgrade_stats", previousParams),
      ]);


      // Check for errors
      if (userGrowthRes.error) throw userGrowthRes.error;
      if (depositsRes.error) throw depositsRes.error;
      if (referralsRes.error) throw referralsRes.error;
      if (planUpgradesRes.error) throw planUpgradesRes.error;

      // Parse and structure the data
      const userGrowth: UserGrowthStats | null = userGrowthRes.data?.[0]
        ? {
            today_count: userGrowthRes.data[0].today_count,
            yesterday_count: userGrowthRes.data[0].yesterday_count,
            last_7days_count: userGrowthRes.data[0].last_7days_count,
            daily_breakdown: (userGrowthRes.data[0].daily_breakdown as any[]) || [],
          }
        : null;

      const deposits: DepositStats | null = depositsRes.data?.[0]
        ? {
            today_count: depositsRes.data[0].today_count,
            yesterday_count: depositsRes.data[0].yesterday_count,
            last_7days_count: depositsRes.data[0].last_7days_count,
            today_volume: depositsRes.data[0].today_volume,
            yesterday_volume: depositsRes.data[0].yesterday_volume,
            last_7days_volume: depositsRes.data[0].last_7days_volume,
            daily_breakdown: (depositsRes.data[0].daily_breakdown as any[]) || [],
          }
        : null;

      const referrals: ReferralStats | null = referralsRes.data?.[0]
        ? {
            today_count: referralsRes.data[0].today_count,
            last_7days_count: referralsRes.data[0].last_7days_count,
            daily_breakdown: (referralsRes.data[0].daily_breakdown as any[]) || [],
          }
        : null;

      const planUpgrades: PlanUpgradeStats | null = planUpgradesRes.data?.[0]
        ? {
            today_count: planUpgradesRes.data[0].today_count,
            yesterday_count: planUpgradesRes.data[0].yesterday_count,
            last_7days_count: planUpgradesRes.data[0].last_7days_count,
            today_volume: planUpgradesRes.data[0].today_volume,
            yesterday_volume: planUpgradesRes.data[0].yesterday_volume,
            last_7days_volume: planUpgradesRes.data[0].last_7days_volume,
            daily_breakdown: (planUpgradesRes.data[0].daily_breakdown as any[]) || [],
          }
        : null;

      // Calculate period comparisons
      const comparisons = dateRange ? {
        userCount: calculateComparison(
          userGrowth?.last_7days_count || 0,
          prevUserGrowthRes.data?.[0]?.last_7days_count || 0
        ),
        depositVolume: calculateComparison(
          deposits?.last_7days_volume || 0,
          prevDepositsRes.data?.[0]?.last_7days_volume || 0
        ),
        referralCount: calculateComparison(
          referrals?.last_7days_count || 0,
          prevReferralsRes.data?.[0]?.last_7days_count || 0
        ),
        upgradeRevenue: calculateComparison(
          planUpgrades?.last_7days_volume || 0,
          prevPlanUpgradesRes.data?.[0]?.last_7days_volume || 0
        ),
      } : undefined;

      const analyticsData: AdminAnalyticsData = {
        userGrowth,
        deposits,
        referrals,
        planUpgrades,
        comparisons,
      };

      return analyticsData;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes - admin analytics don't need real-time updates
    refetchInterval: 5 * 60 * 1000, // Auto-refetch every 5 minutes
  });
};
