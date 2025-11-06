import { supabase } from "@/integrations/supabase/client";

/**
 * Phase 5: Optional debug logger for partner flow
 * 
 * USE SPARINGLY: This function makes backend calls and inserts DB records.
 * Only use for critical decision points in the partner flow.
 * 
 * Rate limited: 10 logs per minute per user
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface DebugLogOptions {
  level: LogLevel;
  event: string;
  data?: Record<string, any>;
  correlationId: string;
}

// Simple client-side rate limiter to prevent excessive calls
const CLIENT_RATE_LIMIT = 5; // Max 5 calls per minute
const CLIENT_RATE_WINDOW = 60000; // 1 minute
let logCount = 0;
let windowStart = Date.now();

function canLog(): boolean {
  const now = Date.now();
  
  if (now - windowStart > CLIENT_RATE_WINDOW) {
    // Reset window
    logCount = 0;
    windowStart = now;
  }
  
  if (logCount >= CLIENT_RATE_LIMIT) {
    console.warn('🚫 [partner-debug-logger] Client rate limit reached');
    return false;
  }
  
  logCount++;
  return true;
}

/**
 * Log a debug event to the partner_debug_logs table
 * 
 * @example
 * logPartnerDebug({
 *   level: 'info',
 *   event: 'partner-wizard.started',
 *   data: { step: 1, totalSteps: 5 },
 *   correlationId: 'partner-123456'
 * });
 */
export async function logPartnerDebug(options: DebugLogOptions): Promise<void> {
  // Client-side rate limiting
  if (!canLog()) {
    return;
  }

  // Console log for immediate feedback
  const logPrefix = `[${options.level.toUpperCase()}] [${options.event}]`;
  console.log(`${logPrefix} correlationId=${options.correlationId}`, options.data || {});

  try {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      console.warn('🚫 [partner-debug-logger] No session, skipping backend log');
      return;
    }

    // Call edge function (don't await - fire and forget)
    fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/log-partner-debug`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          'X-Correlation-Id': options.correlationId,
        },
        body: JSON.stringify({
          level: options.level,
          event: options.event,
          data: options.data || {},
          correlationId: options.correlationId,
        }),
      }
    ).catch(error => {
      // Silent fail - don't let logging errors break the app
      console.warn('🚫 [partner-debug-logger] Failed to send log:', error.message);
    });
  } catch (error) {
    // Silent fail
    console.warn('🚫 [partner-debug-logger] Exception:', error);
  }
}

/**
 * Helper functions for common log levels
 */
export const partnerDebugLogger = {
  debug: (event: string, data?: Record<string, any>, correlationId?: string) => {
    if (correlationId) {
      logPartnerDebug({ level: 'debug', event, data, correlationId });
    }
  },
  
  info: (event: string, data?: Record<string, any>, correlationId?: string) => {
    if (correlationId) {
      logPartnerDebug({ level: 'info', event, data, correlationId });
    }
  },
  
  warn: (event: string, data?: Record<string, any>, correlationId?: string) => {
    if (correlationId) {
      logPartnerDebug({ level: 'warn', event, data, correlationId });
    }
  },
  
  error: (event: string, data?: Record<string, any>, correlationId?: string) => {
    if (correlationId) {
      logPartnerDebug({ level: 'error', event, data, correlationId });
    }
  },
};
