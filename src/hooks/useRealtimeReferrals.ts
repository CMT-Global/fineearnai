import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Real-time Referral Updates Hook
 * Matches the pattern used in useRealtimeTransactions and useRealtimeProfile
 * - Listens to referrals and referral_earnings table changes
 * - Invalidates referral cache when data changes
 * - Secure: filters by referred_id (user can only see their own referral relationship)
 */

// Module-level registry to prevent duplicate channels (same pattern as transactions)
const activeChannels: Record<string, { count: number }> = {};

export const useRealtimeReferrals = (userId: string | undefined) => {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!userId) return;

    const channelName = `rt-referrals-${userId}`;

    // Prevent duplicate channels
    if (activeChannels[channelName]) {
      activeChannels[channelName].count += 1;
      return () => {
        activeChannels[channelName].count -= 1;
        if (activeChannels[channelName].count <= 0) {
          delete activeChannels[channelName];
        }
      };
    }

    activeChannels[channelName] = { count: 1 };
    console.log('🔗 Setting up real-time subscription for referrals:', userId);

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*', // INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'referrals',
          filter: `referred_id=eq.${userId}` // User's referral relationship (upline)
        },
        (payload) => {
          console.log('🔗 Referral relationship changed:', payload.eventType);
          queryClient.invalidateQueries({ queryKey: ['referral-complete-data', userId] });
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'referral_earnings',
          filter: `referrer_id=eq.${userId}` // User's commission earnings
        },
        (payload) => {
          console.log('🔗 Referral earnings updated:', payload.eventType);
          queryClient.invalidateQueries({ queryKey: ['referral-complete-data', userId] });
        }
      )
      .subscribe((status) => {
        console.log('🔗 Real-time referrals subscription status:', status);
        if (status === 'CHANNEL_ERROR') {
          queryClient.invalidateQueries({ queryKey: ['referral-complete-data', userId] });
        }
      });

    return () => {
      if (activeChannels[channelName]) {
        activeChannels[channelName].count -= 1;
        if (activeChannels[channelName].count <= 0) {
          console.log('🔗 Cleaning up real-time subscription for referrals:', userId);
          delete activeChannels[channelName];
          supabase.removeChannel(channel);
        }
      }
    };
  }, [userId, queryClient]);
};
