import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface TransactionFilters {
  walletType?: 'deposit' | 'earnings';
  type?: string;
  status?: 'completed' | 'pending' | 'failed' | 'cancelled';
  dateRange?: { from?: Date; to?: Date };
  searchQuery?: string;
}

export const useTransactions = (
  userId: string | undefined, 
  page: number = 1, 
  pageSize: number = 50,
  enabled: boolean = true,
  filters?: TransactionFilters
) => {
  return useQuery({
    queryKey: ['transactions', userId, page, pageSize, filters],
    queryFn: async () => {
      if (!userId) throw new Error('User ID is required');
      
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      
      // Build query with server-side filters
      let query = supabase
        .from('transactions')
        .select('*', { count: 'exact' })
        .eq('user_id', userId);
      
      // Apply wallet type filter
      if (filters?.walletType) {
        query = query.eq('wallet_type', filters.walletType);
      }
      
      // Apply transaction type filter
      if (filters?.type && filters.type !== 'all') {
        query = query.eq('type', filters.type as any);
      }
      
      // Apply status filter
      if (filters?.status) {
        query = query.eq('status', filters.status);
      }
      
      // Apply date range filter
      if (filters?.dateRange?.from) {
        const fromISO = new Date(filters.dateRange.from).toISOString();
        query = query.gte('created_at', fromISO);
      }
      if (filters?.dateRange?.to) {
        const toDate = new Date(filters.dateRange.to);
        toDate.setHours(23, 59, 59, 999);
        const toISO = toDate.toISOString();
        query = query.lte('created_at', toISO);
      }
      
      // Apply ordering and pagination
      query = query
        .order('created_at', { ascending: false })
        .range(from, to);
      
      const { data, error, count } = await query;
      
      if (error) throw error;
      
      // Filter out pending deposits (these are placeholders waiting for webhook confirmation)
      let filteredTransactions = (data || []).filter(tx => {
        // Hide pending deposits - they're placeholders that will be replaced by completed deposits from webhook
        if (tx.type === 'deposit' && tx.status === 'pending') {
          return false;
        }
        return true;
      });
      
      // Apply client-side search filter (lightweight text matching)
      if (filters?.searchQuery && filters.searchQuery.trim()) {
        const searchLower = filters.searchQuery.toLowerCase();
        filteredTransactions = filteredTransactions.filter(tx => {
          return (
            tx.description?.toLowerCase().includes(searchLower) ||
            tx.payment_gateway?.toLowerCase().includes(searchLower) ||
            tx.gateway_transaction_id?.toLowerCase().includes(searchLower) ||
            tx.id?.toLowerCase().includes(searchLower)
          );
        });
      }
      
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
    // PHASE 4 FIX: Force refetch when window gains focus (catches admin adjustments)
    refetchOnWindowFocus: true,
    refetchInterval: false, // Don't poll continuously
  });
};
