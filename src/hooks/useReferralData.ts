import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export const useReferralData = (userId: string | undefined) => {
  return useQuery({
    queryKey: ['referral-complete-data', userId],
    queryFn: async () => {
      if (!userId) throw new Error('User ID is required');
      
      // ⚡ ALL queries run in parallel - including upline data
      const [profile, stats, earnings, uplineData] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', userId).single(),
        supabase.rpc('get_referral_stats', { user_uuid: userId }),
        supabase.from('referral_earnings')
          .select('*')
          .eq('referrer_id', userId)
          .order('created_at', { ascending: false })
          .limit(20),
        // Fetch upline information from referrals table
        supabase
          .from('referrals')
          .select(`
            id,
            status,
            total_commission_earned,
            created_at,
            referral_code_used,
            referrer:profiles!referrals_referrer_id_fkey (
              id,
              username,
              email,
              membership_plan,
              account_status
            )
          `)
          .eq('referred_id', userId)
          .maybeSingle()
      ]);
      
      return { 
        profile: profile.data,
        stats: stats.data?.[0],
        earnings: earnings.data,
        upline: uplineData.data && uplineData.data.referrer ? {
          id: uplineData.data.referrer.id,
          username: uplineData.data.referrer.username,
          email: uplineData.data.referrer.email,
          membership_plan: uplineData.data.referrer.membership_plan,
          account_status: uplineData.data.referrer.account_status,
          referralCodeUsed: uplineData.data.referral_code_used,
          totalCommissionEarned: uplineData.data.total_commission_earned,
          referralStatus: uplineData.data.status,
          referredOn: uplineData.data.created_at
        } : null,
      };
    },
    enabled: !!userId,
    staleTime: 30000, // 30 seconds
  });
};
