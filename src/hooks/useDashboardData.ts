import { useQuery } from '@tanstack/react-query';
import { supabaseService } from '@/integrations/supabase';
import { getEarnerBadgeStatus } from '@/lib/earner-badge-utils';

export const useDashboardData = (userId: string | undefined) => {
  return useQuery({
    queryKey: ['dashboard-data-v2', userId],
    queryFn: async () => {
      if (!userId) throw new Error('User ID is required');
      
      // Use service layer for parallel queries
      const [profile, referralStats] = await Promise.all([
        supabaseService.profiles.get(userId),
        supabaseService.rpc.getReferralStats(userId)
      ]);
      
      // Fetch membership plan based on profile
      const planData = profile.membership_plan
        ? await supabaseService.membershipPlans.getByName(profile.membership_plan)
        : null;
      
      // Add earner badge status to profile
      const accountType = planData?.account_type;
      const earnerBadge = getEarnerBadgeStatus(accountType);
      
      return {
        profile: { ...profile, earnerBadge },
        referralStats,
        membershipPlan: planData
      };
    },
    enabled: !!userId,
    staleTime: 30000,
  });
};
