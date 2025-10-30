import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export const useReferralData = (userId: string | undefined) => {
  return useQuery({
    queryKey: ['referral-complete-data', userId],
    queryFn: async () => {
      if (!userId) throw new Error('User ID is required');
      
      // ⚡ ALL queries run in parallel - Step 1: Fetch core data
      const [profile, stats, earnings, referralData] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', userId).single(),
        supabase.rpc('get_referral_stats', { user_uuid: userId }),
        supabase.from('referral_earnings')
          .select('*')
          .eq('referrer_id', userId)
          .order('created_at', { ascending: false })
          .limit(20),
        // Fetch active referral relationship data
        supabase
          .from('referrals')
          .select('referrer_id, status, total_commission_earned, created_at, referral_code_used')
          .eq('referred_id', userId)
          .eq('status', 'active')
          .maybeSingle()
      ]);
      
      // Fetch upline profile if referrer exists
      let uplineData = null;
      if (referralData.data?.referrer_id) {
        const uplineProfile = await supabase
          .from('profiles')
          .select('id, username, membership_plan, account_status')
          .eq('id', referralData.data.referrer_id)
          .maybeSingle();
        
        if (uplineProfile.data) {
          uplineData = {
            ...uplineProfile.data,
            referral_code_used: referralData.data.referral_code_used,
            total_commission_earned: referralData.data.total_commission_earned,
            status: referralData.data.status,
            created_at: referralData.data.created_at
          };
        }
      }
      
      return { 
        profile: profile.data,
        stats: stats.data?.[0],
        earnings: earnings.data,
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
