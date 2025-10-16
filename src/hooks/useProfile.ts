import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useRealtimeProfile } from './useRealtimeProfile';

export const useProfile = (userId: string | undefined) => {
  // Phase 7: Enable real-time updates for profile
  useRealtimeProfile(userId);

  return useQuery({
    queryKey: ['profile', userId],
    queryFn: async () => {
      if (!userId) throw new Error('User ID is required');
      
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!userId,
    staleTime: 60000, // 1 minute
  });
};
