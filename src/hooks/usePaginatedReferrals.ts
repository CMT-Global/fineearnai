import { useQuery } from '@tanstack/react-query';
import { supabaseService, supabase } from '@/integrations/supabase';

export const usePaginatedReferrals = (userId: string | undefined, page: number = 1, limit: number = 20) => {
  return useQuery({
    queryKey: ['paginated-referrals', userId, page, limit],
    queryFn: async () => {
      if (!userId) throw new Error('User ID is required');
      
      // Use service layer - get all referrals and paginate manually
      // For better performance with large datasets, we can use direct query with pagination
      const from = (page - 1) * limit;
      const to = from + limit - 1;
      
      const { data, error, count } = await supabase
        .from('referrals')
        .select('*', { count: 'exact' })
        .eq('referrer_id', userId)
        .order('created_at', { ascending: false })
        .range(from, to);

      if (error) throw error;

      return {
        referrals: data || [],
        pagination: {
          page,
          pageSize: limit,
          totalCount: count || 0,
          totalPages: Math.ceil((count || 0) / limit),
          hasMore: (count || 0) > to + 1,
        }
      };
    },
    enabled: !!userId,
    staleTime: 30000, // 30 seconds
    placeholderData: (previousData) => previousData, // Keep old data while fetching
  });
};
