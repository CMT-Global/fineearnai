import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

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

export interface WithdrawalStats {
  today_count: number;
  yesterday_count: number;
  today_volume: number;
  yesterday_volume: number;
  total_volume: number;
  daily_breakdown: DailyBreakdown[];
}

export interface CountryStats {
  country_code: string;
  country_name: string;
  user_count: number;
  total_deposits: number;
  percentage: number;
}

export interface TopReferrer {
  user_id: string;
  username: string;
  country_code: string;
  country_name: string;
  referral_count: number;
  total_commission: number;
  total_referral_deposits: number;
  rank: number;
}

export interface AdminAnalyticsData {
  userGrowth: UserGrowthStats | null;
  deposits: DepositStats | null;
  referrals: ReferralStats | null;
  planUpgrades: PlanUpgradeStats | null;
  withdrawals: WithdrawalStats | null;
  countryStats: CountryStats[];
  topReferrers: TopReferrer[];
}

export interface DateRange {
  startDate: string; // ISO date string (YYYY-MM-DD)
  endDate: string;   // ISO date string (YYYY-MM-DD)
}

export const useAdminAnalytics = (dateRange?: DateRange) => {
  return useQuery({
    queryKey: ["admin-analytics", dateRange],
    queryFn: async () => {
      // Prepare date parameters
      const params = dateRange ? {
        p_start_date: dateRange.startDate,
        p_end_date: dateRange.endDate
      } : {};

      // Fetch all analytics data in parallel
      const [userGrowthRes, depositsRes, referralsRes, planUpgradesRes, withdrawalsRes, countryStatsRes, topReferrersRes] = await Promise.all([
        supabase.rpc("get_user_growth_stats" as any, params),
        supabase.rpc("get_deposit_stats" as any, params),
        supabase.rpc("get_referral_stats_overview" as any, params),
        supabase.rpc("get_plan_upgrade_stats", params),
        supabase.rpc("get_withdrawal_stats" as any, params),
        supabase.rpc("get_country_stats" as any, params),
        supabase.rpc("get_top_referrers" as any, params),
      ]);

      // Check for errors
      if (userGrowthRes.error) throw userGrowthRes.error;
      if (depositsRes.error) throw depositsRes.error;
      if (referralsRes.error) throw referralsRes.error;
      if (planUpgradesRes.error) throw planUpgradesRes.error;
      if (withdrawalsRes.error) throw withdrawalsRes.error;
      if (countryStatsRes.error) throw countryStatsRes.error;
      if (topReferrersRes.error) throw topReferrersRes.error;

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

      const withdrawals: WithdrawalStats | null = withdrawalsRes.data?.[0]
        ? {
            today_count: withdrawalsRes.data[0].today_count,
            yesterday_count: withdrawalsRes.data[0].yesterday_count,
            today_volume: withdrawalsRes.data[0].today_volume,
            yesterday_volume: withdrawalsRes.data[0].yesterday_volume,
            total_volume: withdrawalsRes.data[0].total_volume,
            daily_breakdown: (withdrawalsRes.data[0].daily_breakdown as any[]) || [],
          }
        : null;

      const countryStats: CountryStats[] = (countryStatsRes.data as any[]) || [];
      const topReferrers: TopReferrer[] = (topReferrersRes.data as any[]) || [];

      const analyticsData: AdminAnalyticsData = {
        userGrowth,
        deposits,
        referrals,
        planUpgrades,
        withdrawals,
        countryStats,
        topReferrers,
      };

      return analyticsData;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes - admin analytics don't need real-time updates
    refetchInterval: 5 * 60 * 1000, // Auto-refetch every 5 minutes
  });
};
