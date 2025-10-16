import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Phase 7: Real-time Profile Updates Hook
 * 
 * Subscribes to profile changes and automatically updates React Query cache
 * Provides instant UI updates when wallet balances or user data changes
 */
export const useRealtimeProfile = (userId: string | undefined) => {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!userId) return;

    console.log('🔴 Setting up real-time subscription for profile:', userId);

    const channel = supabase
      .channel(`profile-changes-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${userId}`
        },
        (payload) => {
          console.log('🔴 Real-time profile update received:', {
            event: payload.eventType,
            userId,
            newData: payload.new
          });

          // Update React Query cache with new data
          if (payload.new) {
            queryClient.setQueryData(['profile', userId], payload.new);
            
            // Also invalidate dashboard data to refresh everything
            queryClient.invalidateQueries({ queryKey: ['dashboard-data', userId] });
            
            console.log('✅ Profile cache updated via real-time subscription');
          }
        }
      )
      .subscribe((status) => {
        console.log('🔴 Real-time subscription status:', status);
      });

    return () => {
      console.log('🔴 Cleaning up real-time subscription for profile:', userId);
      supabase.removeChannel(channel);
    };
  }, [userId, queryClient]);
};
