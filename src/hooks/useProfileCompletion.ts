import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Fetches profile_completed (and minimal profile) for the profile completion gate.
 * Used by ProfileCompletionGuard to redirect incomplete users to /profile-wizard.
 */
export function useProfileCompletion(userId: string | undefined) {
  const query = useQuery({
    queryKey: ['profile-completion', userId],
    queryFn: async () => {
      if (!userId) throw new Error('User ID required');
      const { data, error } = await supabase
        .from('profiles')
        .select('id, profile_completed, profile_completed_at, payout_configured, phone_verified')
        .eq('id', userId)
        .single();
      if (error) throw error;
      return data as {
        id: string;
        profile_completed: boolean;
        profile_completed_at: string | null;
        payout_configured: boolean;
        phone_verified: boolean;
      };
    },
    enabled: !!userId,
    staleTime: 60 * 1000,
  });

  return {
    profileCompleted: query.data?.profile_completed ?? false,
    profileCompletedAt: query.data?.profile_completed_at ?? null,
    payoutConfigured: query.data?.payout_configured ?? false,
    phoneVerified: query.data?.phone_verified ?? false,
    loading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}

/** Routes that are allowed when profile is NOT completed. */
export const PROFILE_WIZARD_ALLOWED_PATHS = [
  '/profile-wizard',
  '/settings',
  '/how-it-works',
  '/logout',
] as const;

export function isProfileCompletionAllowedPath(pathname: string): boolean {
  if (pathname === '/profile-wizard' || pathname === '/settings' || pathname === '/how-it-works') return true;
  if (pathname.startsWith('/settings') || pathname.startsWith('/how-it-works')) return true;
  return false;
}
