import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export const useReferralData = (userId: string | undefined) => {
  return useQuery({
    queryKey: ['referral-complete-data', userId],
    queryFn: async () => {
      if (!userId) throw new Error('User ID is required');
      
      // ⚡ ALL queries run in parallel
      const [profile, stats, upline, earnings] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', userId).single(),
        supabase.rpc('get_referral_stats', { user_uuid: userId }),
        supabase.functions.invoke('get-referrer-info'),
        supabase.from('referral_earnings')
          .select('*')
          .eq('referrer_id', userId)
          .order('created_at', { ascending: false })
          .limit(20)
      ]);
      
      return { 
        profile: profile.data,
        stats: stats.data?.[0],
        upline: upline.data,
        earnings: earnings.data,
      };
    },
    enabled: !!userId,
    staleTime: 30000, // 30 seconds
  });
};
