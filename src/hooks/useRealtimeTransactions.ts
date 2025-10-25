import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Real-time Transaction Updates Hook
 * - Single shared channel per user (module-level)
 * - Listens to INSERT and UPDATE events
 * - Invalidates transactions and profile caches on change
 */

// Module-level registry to prevent duplicate channels across components
const activeChannels: Record<string, { count: number }> = {};

export const useRealtimeTransactions = (userId: string | undefined) => {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!userId) return;

    const channelName = `rt-transactions-${userId}`;

    // If already active, just increase ref count and return a cleanup that decrements
    if (activeChannels[channelName]) {
      activeChannels[channelName].count += 1;
      return () => {
        activeChannels[channelName].count -= 1;
        if (activeChannels[channelName].count <= 0) {
          delete activeChannels[channelName];
          // Channel removal is handled by the instance that created it
        }
      };
    }

    // Mark as active and create the channel
    activeChannels[channelName] = { count: 1 };
    console.log('🔴 Setting up real-time subscription for transactions:', userId);

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*', // INSERT and UPDATE
          schema: 'public',
          table: 'transactions',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          try {
            const action = payload.eventType || 'change';
            const txType = (payload.new as any)?.type;
            const txStatus = (payload.new as any)?.status;
            const txAmount = (payload.new as any)?.amount;
            
            console.log(`🔴 Realtime ${action} for transactions:`, {
              userId,
              type: txType,
              status: txStatus,
              amount: txAmount,
            });
            
            // PHASE 4: EXPLICIT CHECK - Log if this is an adjustment transaction
            if (txType === 'adjustment') {
              console.log('🔵 ADJUSTMENT TRANSACTION DETECTED via real-time:', {
                id: (payload.new as any)?.id,
                amount: txAmount,
                description: (payload.new as any)?.description,
                wallet_type: (payload.new as any)?.wallet_type,
                new_balance: (payload.new as any)?.new_balance
              });
            }
          } catch (error) {
            console.error('Error processing real-time transaction event:', error);
          }

          // Invalidate transactions and profile queries (prefix match)
          queryClient.invalidateQueries({ queryKey: ['transactions', userId] });
          queryClient.invalidateQueries({ queryKey: ['profile', userId] });
        }
      )
      .subscribe((status) => {
        console.log('🔴 Real-time transactions subscription status:', status);
        if (status === 'CHANNEL_ERROR') {
          // Light retry: invalidate to keep UI reasonably fresh even if realtime fails
          queryClient.invalidateQueries({ queryKey: ['transactions', userId] });
        }
      });

    return () => {
      // Decrement and cleanup if this was the last subscriber
      if (activeChannels[channelName]) {
        activeChannels[channelName].count -= 1;
        if (activeChannels[channelName].count <= 0) {
          console.log('🔴 Cleaning up real-time subscription for transactions:', userId);
          delete activeChannels[channelName];
          supabase.removeChannel(channel);
        }
      }
    };
  }, [userId, queryClient]);
};
