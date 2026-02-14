import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Paginated referrals hook
 *
 * IMPORTANT:
 * The `Referrals` page expects each item to have the shape:
 * {
 *   id: string;
 *   referredUser: {
 *     id: string;
 *     username: string;
 *     email: string;
 *     membershipPlan: string;
 *     accountStatus: string;
 *     joinedAt: string;
 *     lastActivity: string | null;
 *   };
 *   totalCommissionEarned: number;
 *   status: string;
 *   createdAt: string;
 * }
 *
 * To satisfy this, we call the `get_referrals_with_details` RPC
 * (the same data source used by the `get-paginated-referrals` edge function)
 * and reshape its result.
 */
export const usePaginatedReferrals = (
  userId: string | undefined,
  page: number = 1,
  limit: number = 20
) => {
  return useQuery({
    queryKey: ['paginated-referrals', userId, page, limit],
    queryFn: async () => {
      if (!userId) throw new Error('User ID is required');

      const offset = (page - 1) * limit;

      const { data, error } = await supabase.rpc('get_referrals_with_details', {
        p_referrer_id: userId,
        p_limit: limit,
        p_offset: offset,
      });

      if (error) throw error;

      const referrals = data || [];

      // Match the enriched structure previously returned by the edge function
      const enrichedReferrals = referrals.map((ref: any) => ({
        id: ref.id,
        referredUser: {
          id: ref.referred_id,
          username: ref.username || 'Unknown',
          email: ref.email || '',
          membershipPlan: ref.membership_plan || 'Trainee',
          accountStatus: ref.account_status || 'active',
          joinedAt: ref.created_at,
          lastActivity: ref.last_activity || null,
        },
        totalCommissionEarned: Number(ref.total_commission_earned || 0),
        status: ref.status,
        createdAt: ref.created_at,
      }));

      const totalCount =
        referrals && referrals.length > 0
          ? parseInt((referrals[0] as any).total_count)
          : 0;

      const totalPages = totalCount > 0 ? Math.ceil(totalCount / limit) : 1;

      return {
        referrals: enrichedReferrals,
        pagination: {
          page,
          pageSize: limit,
          totalCount,
          totalPages,
          hasMore: page < totalPages,
          hasNextPage: page < totalPages,
          hasPreviousPage: page > 1,
        },
      };
    },
    enabled: !!userId,
    staleTime: 30000,
    placeholderData: (previousData) => previousData,
  });
};
