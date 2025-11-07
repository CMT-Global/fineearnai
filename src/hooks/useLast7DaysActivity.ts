import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface Last7DaysActivity {
  activity_date: string;
  new_registrations: number;
  referred_users: number;
  deposits_count: number;
  deposits_volume: number;
  withdrawals_count: number;
  withdrawals_volume: number;
  plan_upgrades_count: number;
  plan_upgrades_volume: number;
}

export const useLast7DaysActivity = () => {
  return useQuery({
    queryKey: ['last-7days-activity'],
    queryFn: async () => {
      const { data, error } = await supabase
        .rpc('get_last_7days_activity');
      
      if (error) {
        console.error('[7DAYS] Error fetching activity:', error);
        throw error;
      }
      
      return (data || []) as Last7DaysActivity[];
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: 2 * 60 * 1000, // Auto-refresh every 2 minutes
  });
};
