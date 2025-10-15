import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export const useTransactions = (userId: string | undefined, page: number = 1) => {
  const PAGE_SIZE = 50;
  
  return useQuery({
    queryKey: ['transactions', userId, page],
    queryFn: async () => {
      if (!userId) throw new Error('User ID is required');
      
      const from = (page - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      
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
        hasMore: (count || 0) > to + 1
      };
    },
    enabled: !!userId,
    staleTime: 10000, // 10 seconds (fresh financial data)
    placeholderData: (previousData) => previousData, // Keep old data while fetching
  });
};
