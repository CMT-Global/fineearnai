import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getEarnerBadgeStatus } from '@/lib/earner-badge-utils';

export const useDashboardData = (userId: string | undefined) => {
  return useQuery({
    queryKey: ['dashboard-data', userId],
    queryFn: async () => {
      if (!userId) throw new Error('User ID is required');
      
      const [profile, referralStats] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', userId).single(),
        supabase.rpc('get_referral_stats', { user_uuid: userId })
      ]);
      
      // Fetch membership plan based on profile
      const { data: planData } = await supabase
        .from('membership_plans')
        .select('*')
        .eq('name', profile.data?.membership_plan)
        .single();
      
      // Add earner badge status to profile
      const accountType = planData?.account_type;
      const earnerBadge = getEarnerBadgeStatus(accountType);
      
      return {
        profile: profile.data ? { ...profile.data, earnerBadge } : null,
        referralStats: referralStats.data?.[0],
        membershipPlan: planData
      };
    },
    enabled: !!userId,
    staleTime: 30000,
  });
};
