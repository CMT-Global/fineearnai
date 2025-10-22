import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Phase 7: Real-time Transaction Updates Hook
 * 
 * Subscribes to new transactions and automatically updates React Query cache
 * Provides instant UI updates when new transactions occur
 * Prevents duplicate subscriptions across multiple components
 */
export const useRealtimeTransactions = (userId: string | undefined) => {
  const queryClient = useQueryClient();
  const channelRef = useRef<string | null>(null);

  useEffect(() => {
    if (!userId) return;

    const channelName = `transactions-${userId}`;
    
    // Prevent duplicate subscriptions
    if (channelRef.current === channelName) {
      console.log('🔴 Subscription already exists for:', channelName);
      return;
    }

    console.log('🔴 Setting up real-time subscription for transactions:', userId);
    channelRef.current = channelName;

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'transactions',
          filter: `user_id=eq.${userId}`
        },
        (payload) => {
          console.log('🔴 Real-time transaction insert received:', {
            userId,
            type: payload.new.type,
            amount: payload.new.amount,
            newBalance: payload.new.new_balance
          });

          // Invalidate transactions query to refetch
          queryClient.invalidateQueries({ 
            queryKey: ['transactions', userId] 
          });

          // Also invalidate profile to update wallet balances
          queryClient.invalidateQueries({ 
            queryKey: ['profile', userId] 
          });
          
          console.log('✅ Transaction cache invalidated via real-time subscription');
        }
      )
      .subscribe((status) => {
        console.log('🔴 Real-time transactions subscription status:', status);
      });

    return () => {
      console.log('🔴 Cleaning up real-time subscription for transactions:', userId);
      channelRef.current = null;
      supabase.removeChannel(channel);
    };
  }, [userId, queryClient]);
};
