import { useQuery } from '@tanstack/react-query';
import { supabaseService } from '@/integrations/supabase';
import { getEarnerBadgeStatus } from '@/lib/earner-badge-utils';

export const useReferralData = (userId: string | undefined) => {
  return useQuery({
    queryKey: ['referral-complete-data-v2', userId],
    queryFn: async () => {
      if (!userId) throw new Error('User ID is required');
      
      // ⚡ ALL queries run in parallel - Step 1: Fetch core data using service layer
      const [profile, stats, earnings, referralData] = await Promise.all([
        supabaseService.profiles.get(userId),
        supabaseService.rpc.getReferralStats(userId),
        supabaseService.referralEarnings.getByReferrer(userId, 20),
        supabaseService.referrals.getByReferred(userId)
      ]);
      
      // Fetch membership plan for badge status
      let accountType = null;
      if (profile.membership_plan) {
        const planData = await supabaseService.membershipPlans.getByName(profile.membership_plan);
        accountType = planData?.account_type;
      }
      
      // Add earner badge status to profile
      const earnerBadge = getEarnerBadgeStatus(accountType);
      
      // Fetch upline profile if referrer exists
      let uplineData = null;
      if (referralData?.referrer_id) {
        const uplineProfile = await supabaseService.profiles.get(referralData.referrer_id);
        
        if (uplineProfile) {
          uplineData = {
            ...uplineProfile,
            referral_code_used: referralData.referral_code_used,
            total_commission_earned: referralData.total_commission_earned,
            status: referralData.status,
            created_at: referralData.created_at
          };
        }
      }
      
      return { 
        profile: { ...profile, earnerBadge },
        stats,
        earnings: earnings || [],
        upline: uplineData ? {
          id: uplineData.id,
          username: uplineData.username,
          membership_plan: uplineData.membership_plan,
          account_status: uplineData.account_status,
          referralCodeUsed: uplineData.referral_code_used,
          totalCommissionEarned: uplineData.total_commission_earned,
          referralStatus: uplineData.status,
          referredOn: uplineData.created_at
        } : null,
      };
    },
    enabled: !!userId,
    staleTime: 1000, // 1 second - real-time subscription keeps cache fresh
    gcTime: 5 * 60 * 1000, // 5 minutes in memory
    refetchOnWindowFocus: false, // Real-time handles updates
    refetchOnMount: false, // Real-time handles updates
  });
};
