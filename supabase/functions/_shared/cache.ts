/**
 * Phase 2: In-Memory Caching Layer for Membership Plans
 * 
 * This cache reduces redundant database queries for membership plan data
 * which is relatively static and queried millions of times per day.
 * 
 * Expected impact:
 * - 99% cache hit rate
 * - Query reduction: 5M → 50K per day
 * - Response time improvement: -200ms average
 */

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

interface MembershipPlan {
  id: string;
  name: string;
  display_name: string;
  account_type: string;
  price: string;
  daily_task_limit: number;
  earning_per_task: string;
  task_commission_rate: number;
  deposit_commission_rate: number;
  min_withdrawal: string;
  min_daily_withdrawal: string;
  max_daily_withdrawal: string;
  task_skip_limit_per_day: number;
  max_active_referrals: number;
  billing_period_days: number;
  is_active: boolean;
  features?: any;
  [key: string]: any;
}

// In-memory cache with TTL (5 minutes)
const planCache = new Map<string, CacheEntry<MembershipPlan>>();
const allPlansCache: { data: MembershipPlan[] | null; expiresAt: number } = {
  data: null,
  expiresAt: 0
};

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes in milliseconds

/**
 * Get membership plan by name with caching
 * 
 * @param supabase - Supabase client instance
 * @param planName - Name of the membership plan (e.g., 'free', 'basic', 'pro')
 * @returns Membership plan data or null if not found
 */
export async function getMembershipPlan(
  supabase: any,
  planName: string
): Promise<MembershipPlan | null> {
  const cacheKey = planName.toLowerCase();
  const cached = planCache.get(cacheKey);

  // Return cached data if still valid
  if (cached && cached.expiresAt > Date.now()) {
    console.log(`[Cache HIT] Membership plan: ${planName}`);
    return cached.data;
  }

  console.log(`[Cache MISS] Fetching membership plan: ${planName}`);

  // Fetch from database
  const { data, error } = await supabase
    .from('membership_plans')
    .select('*')
    .eq('name', planName)
    .single();

  if (error) {
    console.error(`Error fetching membership plan ${planName}:`, error);
    return null;
  }

  if (!data) {
    return null;
  }

  // Store in cache
  planCache.set(cacheKey, {
    data,
    expiresAt: Date.now() + CACHE_TTL
  });

  return data;
}

/**
 * Get all active membership plans with caching
 * 
 * @param supabase - Supabase client instance
 * @param activeOnly - Whether to fetch only active plans (default: true)
 * @returns Array of membership plans
 */
export async function getAllMembershipPlans(
  supabase: any,
  activeOnly: boolean = true
): Promise<MembershipPlan[]> {
  // Check cache validity
  if (allPlansCache.data && allPlansCache.expiresAt > Date.now()) {
    console.log(`[Cache HIT] All membership plans`);
    return activeOnly 
      ? allPlansCache.data.filter(p => p.is_active) 
      : allPlansCache.data;
  }

  console.log(`[Cache MISS] Fetching all membership plans`);

  // Fetch from database
  let query = supabase.from('membership_plans').select('*');
  
  if (activeOnly) {
    query = query.eq('is_active', true);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching all membership plans:', error);
    return [];
  }

  // Store in cache
  allPlansCache.data = data || [];
  allPlansCache.expiresAt = Date.now() + CACHE_TTL;

  return data || [];
}

/**
 * Invalidate cache for a specific plan or all plans
 * Call this after creating, updating, or deleting membership plans
 * 
 * @param planName - Optional plan name to invalidate. If not provided, clears all cache
 */
export function invalidatePlanCache(planName?: string): void {
  if (planName) {
    const cacheKey = planName.toLowerCase();
    planCache.delete(cacheKey);
    console.log(`[Cache INVALIDATED] Membership plan: ${planName}`);
  } else {
    planCache.clear();
    allPlansCache.data = null;
    allPlansCache.expiresAt = 0;
    console.log(`[Cache INVALIDATED] All membership plans`);
  }
}

/**
 * Get cache statistics for monitoring
 * 
 * @returns Object with cache statistics
 */
export function getCacheStats() {
  return {
    plan_cache_size: planCache.size,
    all_plans_cached: allPlansCache.data !== null,
    all_plans_count: allPlansCache.data?.length || 0,
    cache_ttl_minutes: CACHE_TTL / 60000
  };
}

/**
 * Warm up the cache by pre-loading common plans
 * Call this on function initialization for better performance
 * 
 * @param supabase - Supabase client instance
 */
export async function warmupCache(supabase: any): Promise<void> {
  console.log('[Cache WARMUP] Pre-loading common membership plans...');
  
  // Pre-load common plans
  const commonPlans = ['free', 'basic', 'premium', 'pro', 'business', 'group'];
  
  await Promise.all(
    commonPlans.map(planName => 
      getMembershipPlan(supabase, planName).catch(err => 
        console.error(`Error warming up cache for ${planName}:`, err)
      )
    )
  );
  
  console.log('[Cache WARMUP] Complete');
}
