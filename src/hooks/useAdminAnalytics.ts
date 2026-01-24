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
  yesterday_count: number;
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
  total_count?: number; // Total count for pagination
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
  total_count?: number; // Total count for pagination
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
      // Prepare date parameters - always pass them explicitly to match function signature
      // Functions have defaults, but we pass explicit values to avoid schema cache issues
      const endDate = dateRange?.endDate || new Date().toISOString().split('T')[0];
      const startDate = dateRange?.startDate || new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      
      // Validate date range
      if (new Date(startDate) > new Date(endDate)) {
        throw new Error("Start date must be before or equal to end date");
      }

      // Limit date range to prevent excessive data fetching (max 365 days)
      const maxDays = 365;
      const daysDiff = Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24));
      if (daysDiff > maxDays) {
        throw new Error(`Date range cannot exceed ${maxDays} days. Please select a shorter range.`);
      }
      
      // Base parameters for date range
      const baseParams = {
        p_start_date: startDate,
        p_end_date: endDate
      };

      // Fetch all analytics data in parallel with timeout
      // Core stats only - chunked data (countries/referrers) is handled by useChunkedAnalytics
      const fetchPromise = Promise.all([
        supabase.rpc("get_user_growth_stats", baseParams),
        supabase.rpc("get_deposit_stats", baseParams),
        supabase.rpc("get_referral_stats_overview", baseParams),
        supabase.rpc("get_plan_upgrade_stats", baseParams),
        supabase.rpc("get_withdrawal_stats", baseParams),
      ]);

      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error("Request timeout after 30 seconds")), 30000)
      );

      const [userGrowthRes, depositsRes, referralsRes, planUpgradesRes, withdrawalsRes] = 
        await Promise.race([fetchPromise, timeoutPromise]) as any[];

      // Check for errors with detailed messages
      if (userGrowthRes.error) {
        console.error("Error fetching user growth stats:", userGrowthRes.error);
        throw new Error(`Failed to fetch user growth stats: ${userGrowthRes.error.message}`);
      }
      if (depositsRes.error) {
        console.error("Error fetching deposit stats:", depositsRes.error);
        throw new Error(`Failed to fetch deposit stats: ${depositsRes.error.message}`);
      }
      if (referralsRes.error) {
        console.error("Error fetching referral stats:", referralsRes.error);
        throw new Error(`Failed to fetch referral stats: ${referralsRes.error.message}`);
      }
      if (planUpgradesRes.error) {
        console.error("Error fetching plan upgrade stats:", planUpgradesRes.error);
        throw new Error(`Failed to fetch plan upgrade stats: ${planUpgradesRes.error.message}`);
      }
      if (withdrawalsRes.error) {
        console.error("Error fetching withdrawal stats:", withdrawalsRes.error);
        throw new Error(`Failed to fetch withdrawal stats: ${withdrawalsRes.error.message}`);
      }

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
            yesterday_count: referralsRes.data[0].yesterday_count,
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

      // Country stats and referrers are now handled by useChunkedAnalytics hook
      // Return empty arrays here - they will be populated by the chunked hook
      const countryStats: CountryStats[] = [];
      const topReferrers: TopReferrer[] = [];

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
