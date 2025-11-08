import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useRealtimeProfile } from './useRealtimeProfile';
import { getEarnerBadgeStatus } from '@/lib/earner-badge-utils';

const PROFILE_CACHE_KEY = 'fineearn_profile_cache';
const CACHE_VERSION = '1.0';
const CACHE_EXPIRY_DAYS = 7;

/**
 * Get cached profile from localStorage
 */
const getCachedProfile = (userId: string) => {
  try {
    const cached = localStorage.getItem(`${PROFILE_CACHE_KEY}_${userId}`);
    if (!cached) return null;

    const parsed = JSON.parse(cached);
    
    // Check version
    if (parsed.version !== CACHE_VERSION) {
      localStorage.removeItem(`${PROFILE_CACHE_KEY}_${userId}`);
      return null;
    }

    // Check expiry (7 days)
    const expiryTime = parsed.timestamp + (CACHE_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
    if (Date.now() > expiryTime) {
      localStorage.removeItem(`${PROFILE_CACHE_KEY}_${userId}`);
      return null;
    }

    return parsed.data;
  } catch (error) {
    console.error('Error reading profile cache:', error);
    return null;
  }
};

/**
 * Save profile to localStorage
 */
const setCachedProfile = (userId: string, data: any) => {
  try {
    const cacheData = {
      userId,
      data,
      timestamp: Date.now(),
      version: CACHE_VERSION
    };
    localStorage.setItem(`${PROFILE_CACHE_KEY}_${userId}`, JSON.stringify(cacheData));
  } catch (error) {
    console.error('Error saving profile cache:', error);
  }
};

/**
 * Clear profile cache (called on logout)
 */
export const clearProfileCache = (userId?: string) => {
  try {
    if (userId) {
      localStorage.removeItem(`${PROFILE_CACHE_KEY}_${userId}`);
    } else {
      // Clear all profile caches
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith(PROFILE_CACHE_KEY)) {
          localStorage.removeItem(key);
        }
      });
    }
  } catch (error) {
    console.error('Error clearing profile cache:', error);
  }
};

export const useProfile = (userId: string | undefined) => {
  // Phase 7: Enable real-time updates for profile
  useRealtimeProfile(userId);

  return useQuery({
    queryKey: ['profile-v2', userId],
    queryFn: async () => {
      if (!userId) throw new Error('User ID is required');
      
      // Fetch profile data
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      
      if (profileError) throw profileError;
      
      // Fetch membership plan details to get account_type
      let accountType = null;
      if (profileData.membership_plan) {
        const { data: planData } = await supabase
          .from('membership_plans')
          .select('account_type, name, display_name')
          .eq('name', profileData.membership_plan)
          .single();
        
        accountType = planData?.account_type;
      }
      
      // Transform profile data to include earner badge status
      const earnerBadge = getEarnerBadgeStatus(accountType);
      
      const transformedData = {
        ...profileData,
        earnerBadge
      };
      
      // Save to cache after successful fetch
      setCachedProfile(userId, transformedData);
      
      return transformedData;
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    placeholderData: userId ? getCachedProfile(userId) : undefined, // Instant render from cache!
  });
};
