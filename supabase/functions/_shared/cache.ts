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

/**
 * Fetches membership plan from cache or database
 */
export async function getMembershipPlan(supabaseClient: any, planName: string) {
  if (!planName) return null;
  
  const cacheKey = `plan_${planName}`;
  const cached = plansCache.get(cacheKey);
  if (cached) return cached;

  console.log(`Cache miss for plan: ${planName}, fetching from DB...`);
  const { data, error } = await supabaseClient
    .from('membership_plans')
    .select('*')
    .eq('name', planName)
    .eq('is_active', true)
    .maybeSingle();

  if (error || !data) {
    console.error(`Error fetching plan ${planName}:`, error);
    return null;
  }

  plansCache.set(cacheKey, data);
  return data;
}
