import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { supabaseService } from '@/integrations/supabase';
import { getEarnerBadgeStatus } from '@/lib/earner-badge-utils';

export const useReferralData = (userId: string | undefined) => {
  return useQuery({
    queryKey: ['referral-complete-data-v2', userId],
    queryFn: async () => {
      if (!userId) throw new Error('User ID is required');
      
      // ⚡ ALL queries run in parallel - Step 1: Fetch core data using service layer
      const [profile, stats, earnings, referralData, affiliateRow] = await Promise.all([
        supabaseService.profiles.get(userId),
        supabaseService.rpc.getReferralStats(userId),
        supabaseService.referralEarnings.getByReferrer(userId, 20),
        supabaseService.referrals.getByReferred(userId),
        supabase.from('user_affiliate_settings').select('*').eq('user_id', userId).maybeSingle().then(({ data }) => data),
      ]);
      
      // Fetch membership plan for badge status and default commission rates
      let accountType = null;
      let planTaskRate: number | null = null;
      let planDepositRate: number | null = null;
      if (profile.membership_plan) {
        const planData = await supabaseService.membershipPlans.getByName(profile.membership_plan);
        accountType = planData?.account_type;
        planTaskRate = planData?.task_commission_rate != null ? Number(planData.task_commission_rate) : null;
        planDepositRate = planData?.deposit_commission_rate != null ? Number(planData.deposit_commission_rate) : null;
      }
      if (planTaskRate == null || planDepositRate == null) {
        const defaultPlan = await supabaseService.membershipPlans.getDefaultPlan();
        planTaskRate = planTaskRate ?? (defaultPlan?.task_commission_rate != null ? Number(defaultPlan.task_commission_rate) : 0);
        planDepositRate = planDepositRate ?? (defaultPlan?.deposit_commission_rate != null ? Number(defaultPlan.deposit_commission_rate) : 0);
      }
      const isAffiliate = !!(affiliateRow?.is_affiliate);
      const effectiveRates = isAffiliate && affiliateRow
        ? {
            taskCommissionRate: affiliateRow.task_commission_pct != null ? Number(affiliateRow.task_commission_pct) / 100 : (planTaskRate ?? 0),
            depositCommissionRate: affiliateRow.deposit_commission_pct != null ? Number(affiliateRow.deposit_commission_pct) / 100 : (planDepositRate ?? 0),
          }
        : { taskCommissionRate: planTaskRate ?? 0, depositCommissionRate: planDepositRate ?? 0 };
      
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
        isAffiliate,
        effectiveRates,
        affiliateSettings: affiliateRow ? { override_withdrawal_days: affiliateRow.override_withdrawal_days, withdrawal_days: affiliateRow.withdrawal_days } : null,
      };
    },
    enabled: !!userId,
    staleTime: 1000, // 1 second - real-time subscription keeps cache fresh
    gcTime: 5 * 60 * 1000, // 5 minutes in memory
    refetchOnWindowFocus: false, // Real-time handles updates
    refetchOnMount: false, // Real-time handles updates
  });
};
