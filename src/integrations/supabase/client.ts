/**
 * Supabase Client Configuration
 * 
 * This file configures the Supabase client for optimal SSR and client-side usage.
 * The client is configured to work seamlessly in both server and client environments.
 * 
 * Usage:
 *   import { supabase } from "@/integrations/supabase/client";
 *   
 *   // Direct database operations
 *   const { data } = await supabase.from('profiles').select('*');
 *   
 *   // Or use the service layer
 *   import { supabaseService } from "@/integrations/supabase/service";
 *   const profile = await supabaseService.profiles.get(userId);
 */

import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';


const SUPABASE_URL =import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY =import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ;
if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
  throw new Error(
    'Missing Supabase environment variables. Please check VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in your .env file.'
  );
  
}

/**
 * Create Supabase client with optimized configuration
 * 
 * Configuration notes:
 * - Uses localStorage for auth persistence (client-side)
 * - Auto-refreshes tokens for seamless user experience
 * - Configured for SSR compatibility
 */
export const supabase = createClient<Database>(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY,
  {
    auth: {
      storage: typeof window !== 'undefined' ? localStorage : undefined,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
    global: {
      headers: {
        'x-client-info': 'fineearn-web',
      },
    },
    db: {
      schema: 'public',
    },
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
    },
  }
);

/**
 * Get a server-side Supabase client (for SSR/API routes)
 * This uses the service role key when available
 * 
 * Note: This is for server-side use only. Use the regular `supabase` client
 * for client-side operations as it respects RLS policies.
 */
export function createServerClient() {
  // In a true SSR environment (like Next.js), you would pass the session here
  // For now, this returns the regular client
  // You can extend this when implementing full SSR
  return supabase;
}

/**
 * Helper to check if we're in a browser environment
 */
export const isBrowser = typeof window !== 'undefined';