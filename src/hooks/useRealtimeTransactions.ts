import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Real-time Transaction Updates Hook
 * Subscribes to ALL transaction changes (INSERT, UPDATE, DELETE) and invalidates cache
 * This ensures Recent Transactions Card updates instantly for:
 * - Task completions (task_earning)
 * - Deposits (deposit)
 * - Withdrawals (withdrawal)
 * - Referral commissions (referral_commission)
 * - Balance adjustments (adjustment)
 */
export const useRealtimeTransactions = (userId: string | undefined) => {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!userId) return;

    console.log('🔴 Setting up real-time subscription for transactions:', userId);

    const channel = supabase
      .channel(`transaction-changes-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'transactions',
          filter: `user_id=eq.${userId}`
        },
        (payload) => {
          console.log('🔴 Real-time transaction event received:', {
            event: payload.eventType,
            userId,
            type: (payload.new as any)?.type || (payload.old as any)?.type,
            status: (payload.new as any)?.status || (payload.old as any)?.status,
            amount: (payload.new as any)?.amount || (payload.old as any)?.amount,
            timestamp: new Date().toISOString()
          });

          // Invalidate transactions cache to trigger refetch
          queryClient.invalidateQueries({ 
            queryKey: ['transactions', userId] 
          });

          // Also invalidate profile to update wallet balances
          queryClient.invalidateQueries({ 
            queryKey: ['profile', userId] 
          });

          // Invalidate dashboard data for comprehensive update
          queryClient.invalidateQueries({ 
            queryKey: ['dashboard-data', userId] 
          });
          
          console.log('✅ Transaction caches invalidated - UI will update automatically');
        }
      )
      .subscribe((status) => {
        console.log('🔴 Real-time transactions subscription status:', status);
        
        if (status === 'SUBSCRIBED') {
          console.log('✅ Successfully subscribed to transaction updates');
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.error('❌ Real-time subscription error:', status);
        }
      });

    return () => {
      console.log('🔴 Cleaning up real-time subscription for transactions:', userId);
      supabase.removeChannel(channel);
    };
  }, [userId, queryClient]);
};
