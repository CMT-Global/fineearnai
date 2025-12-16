/**
 * Supabase Utility Functions
 * 
 * Helper functions for common database operations and patterns.
 */

import { supabase } from './client';
import { supabaseService } from './service';

// ============================================================================
// AUTH UTILITIES
// ============================================================================

/**
 * Get current authenticated user
 */
export async function getCurrentUser() {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) throw error;
  return user;
}

/**
 * Get current session
 */
export async function getCurrentSession() {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) throw error;
  return session;
}

/**
 * Check if user is authenticated
 */
export async function isAuthenticated() {
  const { data: { session } } = await supabase.auth.getSession();
  return !!session;
}

/**
 * Check if user has admin role
 */
export async function isAdmin(userId?: string) {
  const user = userId ? { id: userId } : await getCurrentUser();
  if (!user) return false;
  
  return await supabaseService.userRoles.hasRole(user.id, 'admin');
}

/**
 * Check if user has moderator role
 */
export async function isModerator(userId?: string) {
  const user = userId ? { id: userId } : await getCurrentUser();
  if (!user) return false;
  
  return await supabaseService.userRoles.hasRole(user.id, 'moderator');
}

// ============================================================================
// PROFILE UTILITIES
// ============================================================================

/**
 * Get current user's profile
 */
export async function getCurrentUserProfile() {
  const user = await getCurrentUser();
  if (!user) return null;
  
  return await supabaseService.profiles.get(user.id);
}

/**
 * Get user profile with membership plan details
 */
export async function getProfileWithPlan(userId: string) {
  const profile = await supabaseService.profiles.get(userId);
  if (!profile) return null;

  const plan = profile.membership_plan
    ? await supabaseService.membershipPlans.getByName(profile.membership_plan)
    : null;

  return {
    ...profile,
    membershipPlanDetails: plan,
  };
}

// ============================================================================
// TRANSACTION UTILITIES
// ============================================================================

/**
 * Get user's total earnings
 */
export async function getUserTotalEarnings(userId: string) {
  const { data, error } = await supabase
    .from('transactions')
    .select('amount')
    .eq('user_id', userId)
    .eq('wallet_type', 'earnings')
    .eq('status', 'completed')
    .eq('type', 'task_earning');

  if (error) throw error;

  return (data || []).reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
}

/**
 * Get user's total deposits
 */
export async function getUserTotalDeposits(userId: string) {
  const { data, error } = await supabase
    .from('transactions')
    .select('amount')
    .eq('user_id', userId)
    .eq('wallet_type', 'deposit')
    .eq('status', 'completed')
    .eq('type', 'deposit');

  if (error) throw error;

  return (data || []).reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
}

/**
 * Get user's total withdrawals
 */
export async function getUserTotalWithdrawals(userId: string) {
  const { data, error } = await supabase
    .from('transactions')
    .select('amount')
    .eq('user_id', userId)
    .eq('wallet_type', 'earnings')
    .eq('status', 'completed')
    .eq('type', 'withdrawal');

  if (error) throw error;

  return (data || []).reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
}

// ============================================================================
// TASK UTILITIES
// ============================================================================

/**
 * Get user's task completion stats
 */
export async function getUserTaskStats(userId: string) {
  const { data, error } = await supabase
    .from('task_completions')
    .select('is_correct, earnings_amount')
    .eq('user_id', userId);

  if (error) throw error;

  const completions = data || [];
  const totalTasks = completions.length;
  const correctTasks = completions.filter(t => t.is_correct).length;
  const totalEarnings = completions.reduce(
    (sum, t) => sum + Number(t.earnings_amount || 0),
    0
  );

  return {
    totalTasks,
    correctTasks,
    incorrectTasks: totalTasks - correctTasks,
    accuracy: totalTasks > 0 ? (correctTasks / totalTasks) * 100 : 0,
    totalEarnings,
  };
}

// ============================================================================
// REFERRAL UTILITIES
// ============================================================================

/**
 * Get user's referral summary
 */
export async function getUserReferralSummary(userId: string) {
  const stats = await supabaseService.rpc.getReferralStats(userId);
  const referrals = await supabaseService.referrals.getByReferrer(userId);
  const earnings = await supabaseService.referralEarnings.getByReferrer(userId);

  return {
    stats: stats || {
      total_referrals: 0,
      active_referrals: 0,
      total_earnings: 0,
      task_commission_earnings: 0,
      deposit_commission_earnings: 0,
    },
    referrals: referrals || [],
    earnings: earnings || [],
  };
}

// ============================================================================
// PAGINATION UTILITIES
// ============================================================================

/**
 * Generic pagination helper
 */
export async function paginateQuery<T>(
  query: any,
  page: number = 1,
  pageSize: number = 20
) {
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data, error, count } = await query
    .range(from, to)
    .select('*', { count: 'exact' });

  if (error) throw error;

  return {
    data: (data || []) as T[],
    pagination: {
      page,
      pageSize,
      totalCount: count || 0,
      totalPages: Math.ceil((count || 0) / pageSize),
      hasMore: (count || 0) > to + 1,
    },
  };
}

// ============================================================================
// ERROR HANDLING UTILITIES
// ============================================================================

/**
 * Handle Supabase errors gracefully
 */
export function handleSupabaseError(error: any): string {
  if (!error) return 'An unknown error occurred';

  // Supabase PostgREST errors
  if (error.code === 'PGRST116') {
    return 'No data found';
  }

  if (error.code === '23505') {
    return 'This record already exists';
  }

  if (error.code === '23503') {
    return 'Referenced record does not exist';
  }

  if (error.message) {
    return error.message;
  }

  return 'An error occurred while processing your request';
}

/**
 * Check if error is a not found error
 */
export function isNotFoundError(error: any): boolean {
  return error?.code === 'PGRST116' || error?.message?.includes('No rows');
}

/**
 * Check if error is a duplicate error
 */
export function isDuplicateError(error: any): boolean {
  return error?.code === '23505' || error?.message?.includes('duplicate');
}

// ============================================================================
// REAL-TIME UTILITIES
// ============================================================================

/**
 * Subscribe to table changes
 */
export function subscribeToTable<T>(
  table: string,
  filter: string,
  callback: (payload: any) => void
) {
  return supabase
    .channel(`${table}_changes`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table,
        filter,
      },
      callback
    )
    .subscribe();
}

/**
 * Subscribe to profile changes
 */
export function subscribeToProfile(userId: string, callback: (payload: any) => void) {
  return subscribeToTable('profiles', `id=eq.${userId}`, callback);
}

/**
 * Subscribe to transaction changes
 */
export function subscribeToTransactions(userId: string, callback: (payload: any) => void) {
  return subscribeToTable('transactions', `user_id=eq.${userId}`, callback);
}

/**
 * Subscribe to notification changes
 */
export function subscribeToNotifications(userId: string, callback: (payload: any) => void) {
  return subscribeToTable('notifications', `user_id=eq.${userId}`, callback);
}



