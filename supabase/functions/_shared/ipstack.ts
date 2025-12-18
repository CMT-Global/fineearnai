/**
 * IPStack API Integration - Shared Utility
 * 
 * Phase 3: Centralized IP geolocation service with caching and error handling
 * Provides graceful degradation - failures never block user authentication flows
 */

export interface IPStackResponse {
  ip: string;
  country_code: string;
  country_name: string;
  region_name?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
}

interface CacheEntry {
  data: IPStackResponse;
  expiresAt: number;
}

// In-memory cache (1 hour TTL)
const ipCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const API_TIMEOUT_MS = 3000; // 3 seconds max

/**
 * Validates if an IP address is valid and public
 * Returns false for localhost, private IPs, and invalid formats
 */
function isValidPublicIP(ip: string): boolean {
  if (!ip || ip === 'localhost') return false;

  // IPv4 validation
  const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
  const match = ip.match(ipv4Regex);
  
  if (!match) {
    // Not a valid IPv4, could be IPv6 but we'll skip complex validation
    // IPStack handles IPv6, so we'll let the API validate
    if (ip.includes(':')) {
      // Basic IPv6 format check
      return ip.split(':').length >= 3;
    }
    return false;
  }

  // Check each octet
  const octets = match.slice(1).map(Number);
  if (octets.some(octet => octet < 0 || octet > 255)) return false;

  // Block private IP ranges
  const [first, second] = octets;
  
  // 10.0.0.0 - 10.255.255.255
  if (first === 10) return false;
  
  // 172.16.0.0 - 172.31.255.255
  if (first === 172 && second >= 16 && second <= 31) return false;
  
  // 192.168.0.0 - 192.168.255.255
  if (first === 192 && second === 168) return false;
  
  // 127.0.0.0 - 127.255.255.255 (localhost)
  if (first === 127) return false;
  
  // 169.254.0.0 - 169.254.255.255 (link-local)
  if (first === 169 && second === 254) return false;

  return true;
}

/**
 * Cleans up expired cache entries
 * Called before each cache lookup to prevent memory bloat
 */
function cleanupCache(): void {
  const now = Date.now();
  for (const [ip, entry] of ipCache.entries()) {
    if (now > entry.expiresAt) {
      ipCache.delete(ip);
    }
  }
}

/**
 * Fetches location data from IPStack API with caching and error handling
 * 
 * @param ip - IP address to lookup
 * @param supabaseClient - Optional Supabase client to fetch API key from platform_config
 * @returns IPStackResponse or null if lookup fails (graceful degradation)
 * 
 * Key features:
 * - 1-hour in-memory cache to reduce API calls
 * - 3-second timeout to prevent blocking
 * - Validates IP format before API call
 * - Handles rate limiting (429) and errors gracefully
 * - Returns null on any failure - never throws
 * - Reads API key from platform_config if supabaseClient provided, otherwise from env
 */
export async function getLocationFromIP(ip: string, supabaseClient?: any): Promise<IPStackResponse | null> {
  try {
    // Validate IP format
    if (!isValidPublicIP(ip)) {
      console.log(`🔍 IPStack: Invalid or private IP address: ${ip}`);
      return null;
    }

    // Check cache first
    cleanupCache();
    const cached = ipCache.get(ip);
    if (cached && Date.now() < cached.expiresAt) {
      console.log(`✅ IPStack: Cache hit for ${ip}`);
      return cached.data;
    }

    // Get API key - try platform_config first, then fallback to env
    let apiKey: string | null = null;
    
    if (supabaseClient) {
      try {
        const { data: configData } = await supabaseClient
          .from('platform_config')
          .select('key, value')
          .in('key', ['ipstack_api_key', 'ipstack_config'])
          .order('key', { ascending: false }); // ipstack_config will come before ipstack_api_key
        
        const configMap: Record<string, any> = {};
        configData?.forEach((row: any) => {
          configMap[row.key] = row.value;
        });

        if (configMap.ipstack_config?.apiKey) {
          apiKey = configMap.ipstack_config.apiKey;
          console.log('✅ IPStack: API key loaded from platform_config (ipstack_config)');
        } else if (configMap.ipstack_api_key && typeof configMap.ipstack_api_key === 'string') {
          apiKey = configMap.ipstack_api_key;
          console.log('✅ IPStack: API key loaded from platform_config (ipstack_api_key)');
        }
      } catch (error) {
        console.warn('⚠️ IPStack: Failed to load API key from platform_config, trying env variable');
      }
    }
    
    // Fallback to environment variable
    if (!apiKey) {
      // @ts-ignore - Deno global is available in Deno runtime
      apiKey = Deno.env.get('IPSTACK_API_KEY');
    }
    
    if (!apiKey) {
      console.error('❌ IPStack: IPSTACK_API_KEY not configured in platform_config or environment');
      return null;
    }

    // Call IPStack API with timeout
    console.log(`🌍 IPStack: Fetching location for ${ip}`);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

    const response = await fetch(
      `https://api.ipstack.com/${ip}?access_key=${apiKey}`,
      {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
        },
      }
    );

    clearTimeout(timeoutId);

    // Handle rate limiting
    if (response.status === 429) {
      console.warn('⚠️ IPStack: Rate limit exceeded (429)');
      return null;
    }

    // Handle other errors
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ IPStack: API error (${response.status}):`, errorText);
      return null;
    }

    // Parse response
    const data = await response.json();

    // Check for API-level errors
    if (data.error) {
      console.error('❌ IPStack: API returned error:', data.error);
      return null;
    }

    // Validate required fields
    if (!data.country_code || !data.country_name) {
      console.error('❌ IPStack: Invalid response format - missing required fields');
      return null;
    }

    const locationData: IPStackResponse = {
      ip: data.ip || ip,
      country_code: data.country_code,
      country_name: data.country_name,
      region_name: data.region_name,
      city: data.city,
      latitude: data.latitude,
      longitude: data.longitude,
    };

    // Cache successful result
    ipCache.set(ip, {
      data: locationData,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });

    console.log(`✅ IPStack: Successfully fetched location for ${ip}: ${data.country_name} (${data.country_code})`);
    return locationData;

  } catch (error: any) {
    // Log but don't throw - graceful degradation
    if (error.name === 'AbortError') {
      console.warn(`⚠️ IPStack: Request timeout for ${ip} (>${API_TIMEOUT_MS}ms)`);
    } else {
      console.error(`❌ IPStack: Unexpected error for ${ip}:`, error.message);
    }
    return null;
  }
}

/**
 * Extracts client IP from request headers
 * Checks multiple headers in order of preference
 * 
 * @param req - Deno Request object
 * @returns IP address or null if not found
 */
export function extractClientIP(req: Request): string | null {
  // Check common proxy headers in order of preference
  const headers = [
    'x-forwarded-for',      // Most common (proxy/load balancer)
    'x-real-ip',            // Nginx
    'cf-connecting-ip',     // Cloudflare
    'x-client-ip',          // Alternative
    'true-client-ip',       // Akamai/Cloudflare
  ];

  for (const header of headers) {
    const value = req.headers.get(header);
    if (value) {
      // x-forwarded-for can contain multiple IPs (client, proxy1, proxy2)
      // Take the first one (original client)
      const ip = value.split(',')[0].trim();
      if (ip) {
        console.log(`🔍 Extracted IP from ${header}: ${ip}`);
        return ip;
      }
    }
  }

  console.warn('⚠️ Could not extract client IP from request headers');
  return null;
}

/**
 * Cache statistics for monitoring
 */
export function getCacheStats(): {
  size: number;
  entries: Array<{ ip: string; expiresIn: number }>;
} {
  cleanupCache();
  const now = Date.now();
  return {
    size: ipCache.size,
    entries: Array.from(ipCache.entries()).map(([ip, entry]) => ({
      ip,
      expiresIn: Math.max(0, entry.expiresAt - now),
    })),
  };
}
