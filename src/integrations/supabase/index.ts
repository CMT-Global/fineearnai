/**
 * Supabase Integration - Main Export
 * 
 * This is the main entry point for Supabase integration.
 * Export all Supabase-related functionality from here.
 * 
 * Usage:
 *   import { supabase, supabaseService, supabaseUtils } from '@/integrations/supabase';
 *   
 *   // Use the client directly
 *   const { data } = await supabase.from('profiles').select('*');
 *   
 *   // Use the service layer (recommended)
 *   const profile = await supabaseService.profiles.get(userId);
 *   
 *   // Use utility functions
 *   const isAdmin = await supabaseUtils.isAdmin();
 */

// Export client
export { supabase, createServerClient, isBrowser } from './client';

// Export service layer
export { supabaseService, default as supabaseServiceDefault } from './service';

// Export utility functions
export * as supabaseUtils from './utils';

// Export types
export type { Database } from './types';

// Re-export commonly used types from Supabase
export type { User, Session } from '@supabase/supabase-js';




