import { supabase } from "@/integrations/supabase/client";

/**
 * Ensures we have a valid session before making authenticated requests
 * Refreshes the session if it's expired or about to expire
 */
export async function ensureValidSession() {
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error) {
      console.error("❌ [Session] Error getting session:", error);
      throw new Error("Failed to get session");
    }

    if (!session) {
      console.error("❌ [Session] No active session found");
      throw new Error("No active session");
    }

    // Check if token is expired or about to expire (within 60 seconds)
    const expiresAt = session.expires_at;
    const now = Math.floor(Date.now() / 1000);
    const timeUntilExpiry = expiresAt ? expiresAt - now : 0;

    if (timeUntilExpiry < 60) {
      console.log("🔄 [Session] Token expiring soon, refreshing...");
      const { data: { session: newSession }, error: refreshError } = await supabase.auth.refreshSession();
      
      if (refreshError) {
        console.error("❌ [Session] Failed to refresh session:", refreshError);
        throw new Error("Session expired and refresh failed");
      }

      if (!newSession) {
        console.error("❌ [Session] No session returned after refresh");
        throw new Error("Session refresh returned no session");
      }

      console.log("✅ [Session] Token refreshed successfully");
      return newSession;
    }

    console.log("✅ [Session] Valid session found");
    return session;
  } catch (error) {
    console.error("❌ [Session] ensureValidSession error:", error);
    throw error;
  }
}

/** Edge functions that require admin; we force a fresh session before calling to avoid 403 from expired JWT */
const ADMIN_FUNCTIONS = new Set(['admin-manage-user', 'admin-bulk-operations', 'admin-verify-email', 'process-withdrawal-payment']);

/**
 * Wraps an edge function call with session validation and retry logic
 */
export async function callEdgeFunctionWithRetry<T>(
  functionName: string,
  params: any
): Promise<T> {
  try {
    // Ensure valid session before first attempt
    let session = await ensureValidSession();

    // For admin/secure functions, force a session refresh so the token is as fresh as possible (avoids gateway 403)
    if (ADMIN_FUNCTIONS.has(functionName)) {
      const { data: { session: fresh }, error: refreshErr } = await supabase.auth.refreshSession();
      if (!refreshErr && fresh) session = fresh;
    }

    console.log(`🚀 [EdgeFunction] Calling ${functionName}`, params);
    const { data, error } = await supabase.functions.invoke(functionName, params);

    if (error) {
      console.error(`❌ [EdgeFunction] ${functionName} error:`, error);
      
      // On 401/403, try refreshing session and retry once (stale or expired token)
      const isAuthError = error.message?.includes('403') || error.message?.includes('401') || error.message?.includes('Unauthorized');
      if (isAuthError) {
        console.log(`🔄 [EdgeFunction] Got auth error, refreshing session and retrying ${functionName}...`);
        
        const { data: { session: newSession }, error: refreshError } = await supabase.auth.refreshSession();
        
        if (refreshError || !newSession) {
          console.error("❌ [Session] Failed to refresh on auth error:", refreshError);
          throw new Error("Session expired. Please log in again.");
        }

        console.log("✅ [Session] Refreshed, retrying edge function...");
        
        const { data: retryData, error: retryError } = await supabase.functions.invoke(functionName, params);
        
        if (retryError) {
          console.error(`❌ [EdgeFunction] ${functionName} retry failed:`, retryError);
          throw retryError;
        }

        console.log(`✅ [EdgeFunction] ${functionName} retry succeeded`);
        return retryData as T;
      }

      throw error;
    }

    console.log(`✅ [EdgeFunction] ${functionName} succeeded`);
    return data as T;
  } catch (error) {
    console.error(`❌ [EdgeFunction] ${functionName} final error:`, error);
    throw error;
  }
}
