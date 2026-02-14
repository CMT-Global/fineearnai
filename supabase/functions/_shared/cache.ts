/**
 * In-memory Cache for Deno Edge Functions
 * Provides TTL-based caching for frequently accessed database records
 */

export class TTLCache<K, V> {
  private cache = new Map<K, { value: V; expires: number }>();
  private readonly defaultTTL: number;

  constructor(defaultTTL: number = 5 * 60 * 1000) {
    this.defaultTTL = defaultTTL;
  }

  set(key: K, value: V, ttl?: number): void {
    const expires = Date.now() + (ttl || this.defaultTTL);
    this.cache.set(key, { value, expires });
  }

  get(key: K): V | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;

    if (Date.now() > entry.expires) {
      this.cache.delete(key);
      return undefined;
    }

    return entry.value;
  }

  has(key: K): boolean {
    return this.get(key) !== undefined;
  }

  delete(key: K): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }
}

// Global cache instances for different entities
const plansCache = new TTLCache<string, any>(15 * 60 * 1000); // 15 min TTL for membership plans

export type GetMembershipPlanOptions = { fallbackToDefault?: boolean };

/**
 * Fetches membership plan from cache or database.
 * When fallbackToDefault is true and lookup by name fails (e.g. profile has stale "free" but DB uses "Trainee"),
 * returns the default free-tier plan (account_type = 'free') so callers don't fail.
 */
export async function getMembershipPlan(
  supabaseClient: any,
  planName: string,
  options: GetMembershipPlanOptions = {}
): Promise<any | null> {
  const { fallbackToDefault = false } = options;

  if (!planName && !fallbackToDefault) return null;

  if (planName) {
    const cacheKey = `plan_${planName}`;
    const cached = plansCache.get(cacheKey);
    if (cached) return cached;

    const { data, error } = await supabaseClient
      .from('membership_plans')
      .select('*')
      .eq('name', planName)
      .eq('is_active', true)
      .maybeSingle();

    if (!error && data) {
      plansCache.set(cacheKey, data);
      return data;
    }
    if (error) console.error(`Error fetching plan ${planName}:`, error);
    if (!fallbackToDefault) return null;
  }

  // Fallback: resolve default free-tier plan (account_type = 'free')
  const { data: defaultPlan } = await supabaseClient
    .from('membership_plans')
    .select('*')
    .eq('account_type', 'free')
    .eq('is_active', true)
    .order('price', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (defaultPlan) {
    if (planName) plansCache.set(`plan_${planName}`, defaultPlan);
    return defaultPlan;
  }
  return null;
}

const DEFAULT_PLAN_NAME_KEY = 'default_plan_name';

/**
 * Returns the name of the default (free tier) plan. Source of truth: account_type = 'free'.
 * Use this instead of hardcoding 'Trainee' so renaming the plan in DB works.
 */
export async function getDefaultPlanName(supabaseClient: any): Promise<string | null> {
  const cached = plansCache.get(DEFAULT_PLAN_NAME_KEY);
  if (cached) return cached as string;

  const { data, error } = await supabaseClient
    .from('membership_plans')
    .select('name')
    .eq('account_type', 'free')
    .eq('is_active', true)
    .order('price', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error || !data?.name) return null;
  plansCache.set(DEFAULT_PLAN_NAME_KEY, data.name, 15 * 60 * 1000);
  return data.name;
}
