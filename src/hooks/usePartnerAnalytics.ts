import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface AnalyticsRequest {
  partner_id?: string;
  date_range?: 'week' | 'month' | 'quarter' | 'year';
}

interface AnalyticsOverview {
  total_vouchers: number;
  redeemed_vouchers: number;
  active_vouchers: number;
  expired_vouchers: number;
  conversion_rate: number;
  total_sales: number;
  redeemed_sales: number;
  total_commission: number;
}

interface SalesTrend {
  date: string;
  sales: number;
  vouchers: number;
  commission: number;
}

interface CommissionTrend {
  date: string;
  commission: number;
}

interface TopSellingAmount {
  amount: number;
  count: number;
  percentage: number;
}

interface PartnerPerformance {
  partner_id: string;
  partner_name: string;
  total_vouchers: number;
  redeemed_vouchers: number;
  total_sales: number;
  total_commission: number;
}

export interface PartnerAnalyticsData {
  success: boolean;
  date_range: string;
  start_date: string;
  end_date: string;
  partner_id?: string;
  is_admin: boolean;
  overview: AnalyticsOverview;
  sales_trend: SalesTrend[];
  commission_trend: CommissionTrend[];
  top_selling_amounts: TopSellingAmount[];
  partner_performance: PartnerPerformance[];
}

export const usePartnerAnalytics = ({ partner_id, date_range = 'month' }: AnalyticsRequest = {}) => {
  return useQuery({
    queryKey: ['partner-analytics', partner_id, date_range],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error('No active session');
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-partner-analytics`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ partner_id, date_range }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to fetch partner analytics');
      }

      return response.json() as Promise<PartnerAnalyticsData>;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: 5 * 60 * 1000, // Auto-refetch every 5 minutes
  });
};
