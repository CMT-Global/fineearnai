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
      
      // Filter out pending deposits (these are placeholders waiting for webhook confirmation)
      // Users should only see completed transactions
      let filteredTransactions = (data || []).filter(tx => {
        // Hide pending deposits - they're placeholders that will be replaced by completed deposits from webhook
        if (tx.type === 'deposit' && tx.status === 'pending') {
          return false;
        }
        // Show everything else (completed deposits, withdrawals, task earnings, etc.)
        return true;
      });
      
      // Client-side deduplication safety net (Phase 3)
      // This prevents duplicate transactions from appearing in UI even if they somehow slip through database constraints
      const uniqueTransactions = filteredTransactions.reduce((acc, tx) => {
        // Create unique key using gateway_transaction_id or fallback to transaction id
        const uniqueKey = tx.gateway_transaction_id || tx.id;
        
        // Check if we already have a transaction with this key
        const isDuplicate = acc.some(existing => {
          const existingKey = existing.gateway_transaction_id || existing.id;
          return existingKey === uniqueKey;
        });
        
        // Only add if not duplicate
        if (!isDuplicate) {
          acc.push(tx);
        }
        
        return acc;
      }, [] as typeof filteredTransactions);
      
      return {
        transactions: uniqueTransactions,
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
