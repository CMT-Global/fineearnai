import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export const useTransactions = (
  userId: string | undefined, 
  page: number = 1, 
  pageSize: number = 50,
  enabled: boolean = true
) => {
  return useQuery({
    queryKey: ['transactions', userId, page, pageSize],
    queryFn: async () => {
      if (!userId) throw new Error('User ID is required');
      
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      
      const { data, error, count } = await supabase
        .from('transactions')
        .select('*', { count: 'exact' })
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .range(from, to);
      
      if (error) throw error;
      
      return {
        transactions: data || [],
        totalCount: count || 0,
        hasMore: (count || 0) > to + 1,
        currentPage: page,
        totalPages: Math.ceil((count || 0) / pageSize)
      };
    },
    enabled: !!userId && enabled,
    staleTime: 10000, // 10 seconds (fresh financial data)
    refetchOnMount: false, // Prevent redundant fetches
    placeholderData: (previousData) => previousData, // Keep old data while fetching
  });
};
