import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export const usePaginatedReferrals = (userId: string | undefined, page: number = 1, limit: number = 20) => {
  return useQuery({
    queryKey: ['paginated-referrals', userId, page],
    queryFn: async () => {
      if (!userId) throw new Error('User ID is required');
      
      const { data, error } = await supabase.functions.invoke("get-paginated-referrals", {
        body: { page, limit },
      });

      if (error) throw error;

      if (!data?.success) {
        throw new Error('Failed to load referrals');
      }

      return {
        referrals: data.data || [],
        pagination: data.pagination
      };
    },
    enabled: !!userId,
    staleTime: 30000, // 30 seconds
    placeholderData: (previousData) => previousData, // Keep old data while fetching
  });
};
