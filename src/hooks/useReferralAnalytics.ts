import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type AnalyticsPeriod = "today" | "7d" | "30d" | "all";

export interface ReferralAnalyticsDailyPoint {
  date: string;
  commission_amount: number;
  team_earnings: number;
  active_count: number;
}

export interface ReferralAnalyticsTopContributor {
  referred_id: string;
  masked_display_name: string;
  tasks_count: number;
  their_earnings: number;
  your_commission: number;
}

export interface ReferralAnalyticsRow {
  team_members_count: number;
  active_members_count: number;
  task_commissions_sum: number;
  team_earnings_sum: number;
  daily_series: ReferralAnalyticsDailyPoint[];
  prev_task_commissions_sum: number;
  prev_team_earnings_sum: number;
  prev_active_members_count: number;
  top_contributors: ReferralAnalyticsTopContributor[];
  signups_from_link: number;
  upgraded_count: number;
  conversion_rate: number;
}

const ALL_TIME_START = "2000-01-01T00:00:00Z";

function getPeriodBounds(period: AnalyticsPeriod): { start: string; end: string } {
  const now = new Date();
  const end = now.toISOString();
  let start: string;

  switch (period) {
    case "today": {
      const s = new Date(now);
      s.setUTCHours(0, 0, 0, 0);
      start = s.toISOString();
      break;
    }
    case "7d": {
      const s = new Date(now);
      s.setDate(s.getDate() - 7);
      start = s.toISOString();
      break;
    }
    case "30d": {
      const s = new Date(now);
      s.setDate(s.getDate() - 30);
      start = s.toISOString();
      break;
    }
    case "all":
    default:
      start = ALL_TIME_START;
      break;
  }
  return { start, end };
}

export function useReferralAnalytics(
  userId: string | undefined,
  period: AnalyticsPeriod
) {
  const query = useQuery({
    queryKey: ["referral-analytics", userId, period],
    queryFn: async (): Promise<ReferralAnalyticsRow | null> => {
      if (!userId) return null;
      const { start, end } = getPeriodBounds(period);
      const { data, error } = await supabase.rpc("get_referral_analytics", {
        p_referrer_id: userId,
        p_start_timestamptz: start,
        p_end_timestamptz: end,
      });
      if (error) {
        console.error("[ReferralAnalytics] RPC error:", error.message, error.details);
        throw error;
      }
      const row = Array.isArray(data) ? data[0] : data;
      if (!row) {
        console.warn("[ReferralAnalytics] RPC returned no row. Ensure migration 20260219140000_get_referral_analytics.sql has been run.");
        return null;
      }
      const rawDaily = (row.daily_series as unknown as ReferralAnalyticsDailyPoint[] | null) ?? [];
      const rawTop = (row.top_contributors as unknown as ReferralAnalyticsTopContributor[] | null) ?? [];
      return {
        team_members_count: Number(row.team_members_count) || 0,
        active_members_count: Number(row.active_members_count) || 0,
        task_commissions_sum: Number(row.task_commissions_sum) || 0,
        team_earnings_sum: Number(row.team_earnings_sum) || 0,
        daily_series: rawDaily.map((d) => ({
          date: String(d?.date ?? ""),
          commission_amount: Number(d?.commission_amount) || 0,
          team_earnings: Number(d?.team_earnings) || 0,
          active_count: Number(d?.active_count) || 0,
        })),
        prev_task_commissions_sum: Number(row.prev_task_commissions_sum) || 0,
        prev_team_earnings_sum: Number(row.prev_team_earnings_sum) || 0,
        prev_active_members_count: Number(row.prev_active_members_count) || 0,
        top_contributors: rawTop.map((c) => ({
          referred_id: String(c?.referred_id ?? ""),
          masked_display_name: String(c?.masked_display_name ?? ""),
          tasks_count: Number(c?.tasks_count) || 0,
          their_earnings: Number(c?.their_earnings) || 0,
          your_commission: Number(c?.your_commission) || 0,
        })),
        signups_from_link: Number(row.signups_from_link) || 0,
        upgraded_count: Number(row.upgraded_count) || 0,
        conversion_rate: Number(row.conversion_rate) || 0,
      };
    },
    enabled: !!userId,
    staleTime: 60 * 1000,
  });

  const periodBounds = getPeriodBounds(period);
  return {
    data: query.data ?? null,
    isLoading: query.isLoading,
    error: query.error,
    periodBounds,
  };
}
