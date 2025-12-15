/**
 * Supabase Service Layer
 * 
 * Comprehensive CRUD operations and helper functions for Supabase database.
 * This service provides type-safe database operations without needing API routes.
 * 
 * Usage:
 *   import { supabaseService } from '@/integrations/supabase/service';
 *   
 *   // Get user profile
 *   const profile = await supabaseService.profiles.get(userId);
 *   
 *   // Create transaction
 *   const transaction = await supabaseService.transactions.create({ ... });
 */

import { supabase } from './client';
import type { Database } from './types';

type Tables = Database['public']['Tables'];
type Functions = Database['public']['Functions'];

// ============================================================================
// TYPE HELPERS
// ============================================================================

type TableName = keyof Tables;
type GetTableRow<T extends TableName> = Tables[T]['Row'];
type GetTableInsert<T extends TableName> = Tables[T]['Insert'];
type GetTableUpdate<T extends TableName> = Tables[T]['Update'];

// ============================================================================
// PROFILES SERVICE
// ============================================================================

export const profilesService = {
  /**
   * Get a single profile by user ID
   */
  async get(userId: string) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    
    if (error) throw error;
    return data;
  },

  /**
   * Get multiple profiles by user IDs
   */
  async getMany(userIds: string[]) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .in('id', userIds);
    
    if (error) throw error;
    return data;
  },

  /**
   * Get profile by username
   */
  async getByUsername(username: string) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('username', username)
      .maybeSingle();
    
    if (error) throw error;
    return data;
  },

  /**
   * Get profile by referral code
   */
  async getByReferralCode(referralCode: string) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('referral_code', referralCode)
      .maybeSingle();
    
    if (error) throw error;
    return data;
  },

  /**
   * Create a new profile
   */
  async create(profile: GetTableInsert<'profiles'>) {
    const { data, error } = await supabase
      .from('profiles')
      .insert(profile)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  /**
   * Update a profile
   */
  async update(userId: string, updates: GetTableUpdate<'profiles'>) {
    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  /**
   * Delete a profile (cascade deletes user)
   */
  async delete(userId: string) {
    const { error } = await supabase
      .from('profiles')
      .delete()
      .eq('id', userId);
    
    if (error) throw error;
  },

  /**
   * Check if username exists
   */
  async usernameExists(username: string, excludeUserId?: string) {
    let query = supabase
      .from('profiles')
      .select('id')
      .eq('username', username)
      .limit(1);
    
    if (excludeUserId) {
      query = query.neq('id', excludeUserId);
    }
    
    const { data, error } = await query;
    if (error) throw error;
    return (data?.length ?? 0) > 0;
  },
};

// ============================================================================
// TRANSACTIONS SERVICE
// ============================================================================

export const transactionsService = {
  /**
   * Get a single transaction by ID
   */
  async get(transactionId: string) {
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('id', transactionId)
      .single();
    
    if (error) throw error;
    return data;
  },

  /**
   * Get transactions for a user with pagination and filters
   */
  async getUserTransactions(
    userId: string,
    options?: {
      page?: number;
      pageSize?: number;
      walletType?: 'deposit' | 'earnings';
      type?: string;
      status?: string;
      dateFrom?: Date;
      dateTo?: Date;
    }
  ) {
    const {
      page = 1,
      pageSize = 50,
      walletType,
      type,
      status,
      dateFrom,
      dateTo,
    } = options || {};

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = supabase
      .from('transactions')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (walletType) {
      query = query.eq('wallet_type', walletType);
    }

    if (type && type !== 'all') {
      query = query.eq('type', type);
    }

    if (status) {
      query = query.eq('status', status);
    }

    if (dateFrom) {
      query = query.gte('created_at', dateFrom.toISOString());
    }

    if (dateTo) {
      const toDate = new Date(dateTo);
      toDate.setHours(23, 59, 59, 999);
      query = query.lte('created_at', toDate.toISOString());
    }

    const { data, error, count } = await query;

    if (error) throw error;

    return {
      transactions: data || [],
      totalCount: count || 0,
      hasMore: (count || 0) > to + 1,
      currentPage: page,
      totalPages: Math.ceil((count || 0) / pageSize),
    };
  },

  /**
   * Create a new transaction
   */
  async create(transaction: GetTableInsert<'transactions'>) {
    const { data, error } = await supabase
      .from('transactions')
      .insert(transaction)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  /**
   * Update a transaction
   */
  async update(transactionId: string, updates: GetTableUpdate<'transactions'>) {
    const { data, error } = await supabase
      .from('transactions')
      .update(updates)
      .eq('id', transactionId)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  /**
   * Get transaction by gateway transaction ID
   */
  async getByGatewayId(gatewayTransactionId: string) {
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('gateway_transaction_id', gatewayTransactionId)
      .maybeSingle();
    
    if (error) throw error;
    return data;
  },
};

// ============================================================================
// TASKS SERVICE
// ============================================================================

export const tasksService = {
  /**
   * Get a single task by ID
   */
  async get(taskId: string) {
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('id', taskId)
      .single();
    
    if (error) throw error;
    return data;
  },

  /**
   * Get active tasks
   */
  async getActive(limit?: number) {
    let query = supabase
      .from('tasks')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (limit) {
      query = query.limit(limit);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  /**
   * Create a new task
   */
  async create(task: GetTableInsert<'tasks'>) {
    const { data, error } = await supabase
      .from('tasks')
      .insert(task)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  /**
   * Update a task
   */
  async update(taskId: string, updates: GetTableUpdate<'tasks'>) {
    const { data, error } = await supabase
      .from('tasks')
      .update(updates)
      .eq('id', taskId)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  /**
   * Delete a task
   */
  async delete(taskId: string) {
    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('id', taskId);
    
    if (error) throw error;
  },
};

// ============================================================================
// AI TASKS SERVICE
// ============================================================================

export const aiTasksService = {
  /**
   * Get a single AI task by ID
   */
  async get(taskId: string) {
    const { data, error } = await supabase
      .from('ai_tasks')
      .select('*')
      .eq('id', taskId)
      .single();
    
    if (error) throw error;
    return data;
  },

  /**
   * Get active AI tasks
   */
  async getActive(limit?: number) {
    let query = supabase
      .from('ai_tasks')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (limit) {
      query = query.limit(limit);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  /**
   * Create a new AI task
   */
  async create(task: GetTableInsert<'ai_tasks'>) {
    const { data, error } = await supabase
      .from('ai_tasks')
      .insert(task)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  /**
   * Update an AI task
   */
  async update(taskId: string, updates: GetTableUpdate<'ai_tasks'>) {
    const { data, error } = await supabase
      .from('ai_tasks')
      .update(updates)
      .eq('id', taskId)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },
};

// ============================================================================
// TASK COMPLETIONS SERVICE
// ============================================================================

export const taskCompletionsService = {
  /**
   * Get task completions for a user
   */
  async getUserCompletions(userId: string, limit?: number) {
    let query = supabase
      .from('task_completions')
      .select('*')
      .eq('user_id', userId)
      .order('completed_at', { ascending: false });

    if (limit) {
      query = query.limit(limit);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  /**
   * Check if user has completed a task
   */
  async hasCompletedTask(userId: string, taskId: string) {
    const { data, error } = await supabase
      .from('task_completions')
      .select('id')
      .eq('user_id', userId)
      .eq('task_id', taskId)
      .limit(1);
    
    if (error) throw error;
    return (data?.length ?? 0) > 0;
  },

  /**
   * Create a task completion
   */
  async create(completion: GetTableInsert<'task_completions'>) {
    const { data, error } = await supabase
      .from('task_completions')
      .insert(completion)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },
};

// ============================================================================
// MEMBERSHIP PLANS SERVICE
// ============================================================================

export const membershipPlansService = {
  /**
   * Get all membership plans
   */
  async getAll() {
    const { data, error } = await supabase
      .from('membership_plans')
      .select('*')
      .order('price', { ascending: true });
    
    if (error) throw error;
    return data || [];
  },

  /**
   * Get a single plan by name
   */
  async getByName(planName: string) {
    const { data, error } = await supabase
      .from('membership_plans')
      .select('*')
      .eq('name', planName)
      .maybeSingle();
    
    if (error) throw error;
    return data;
  },

  /**
   * Get a single plan by ID
   */
  async get(planId: string) {
    const { data, error } = await supabase
      .from('membership_plans')
      .select('*')
      .eq('id', planId)
      .single();
    
    if (error) throw error;
    return data;
  },

  /**
   * Create a new membership plan
   */
  async create(plan: GetTableInsert<'membership_plans'>) {
    const { data, error } = await supabase
      .from('membership_plans')
      .insert(plan)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  /**
   * Update a membership plan
   */
  async update(planId: string, updates: GetTableUpdate<'membership_plans'>) {
    const { data, error } = await supabase
      .from('membership_plans')
      .update(updates)
      .eq('id', planId)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },
};

// ============================================================================
// REFERRALS SERVICE
// ============================================================================

export const referralsService = {
  /**
   * Get referrals for a user (as referrer)
   */
  async getByReferrer(referrerId: string) {
    const { data, error } = await supabase
      .from('referrals')
      .select('*')
      .eq('referrer_id', referrerId)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data || [];
  },

  /**
   * Get referral relationship for a user (as referred)
   */
  async getByReferred(referredId: string) {
    const { data, error } = await supabase
      .from('referrals')
      .select('*')
      .eq('referred_id', referredId)
      .maybeSingle();
    
    if (error) throw error;
    return data;
  },

  /**
   * Create a new referral relationship
   */
  async create(referral: GetTableInsert<'referrals'>) {
    const { data, error } = await supabase
      .from('referrals')
      .insert(referral)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  /**
   * Update a referral relationship
   */
  async update(referralId: string, updates: GetTableUpdate<'referrals'>) {
    const { data, error } = await supabase
      .from('referrals')
      .update(updates)
      .eq('id', referralId)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },
};

// ============================================================================
// REFERRAL EARNINGS SERVICE
// ============================================================================

export const referralEarningsService = {
  /**
   * Get referral earnings for a user
   */
  async getByReferrer(referrerId: string, limit?: number) {
    let query = supabase
      .from('referral_earnings')
      .select('*')
      .eq('referrer_id', referrerId)
      .order('created_at', { ascending: false });

    if (limit) {
      query = query.limit(limit);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  /**
   * Create a new referral earning
   */
  async create(earning: GetTableInsert<'referral_earnings'>) {
    const { data, error } = await supabase
      .from('referral_earnings')
      .insert(earning)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },
};

// ============================================================================
// USER ROLES SERVICE
// ============================================================================

export const userRolesService = {
  /**
   * Get roles for a user
   */
  async getByUserId(userId: string) {
    const { data, error } = await supabase
      .from('user_roles')
      .select('*')
      .eq('user_id', userId);
    
    if (error) throw error;
    return data || [];
  },

  /**
   * Check if user has a specific role
   */
  async hasRole(userId: string, role: 'admin' | 'moderator' | 'user') {
    const { data, error } = await supabase
      .from('user_roles')
      .select('id')
      .eq('user_id', userId)
      .eq('role', role)
      .limit(1);
    
    if (error) throw error;
    return (data?.length ?? 0) > 0;
  },

  /**
   * Assign a role to a user
   */
  async assignRole(userId: string, role: 'admin' | 'moderator' | 'user') {
    const { data, error } = await supabase
      .from('user_roles')
      .insert({ user_id: userId, role })
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  /**
   * Remove a role from a user
   */
  async removeRole(userId: string, role: 'admin' | 'moderator' | 'user') {
    const { error } = await supabase
      .from('user_roles')
      .delete()
      .eq('user_id', userId)
      .eq('role', role);
    
    if (error) throw error;
  },
};

// ============================================================================
// WITHDRAWAL REQUESTS SERVICE
// ============================================================================

export const withdrawalRequestsService = {
  /**
   * Get withdrawal requests for a user
   */
  async getByUserId(userId: string, limit?: number) {
    let query = supabase
      .from('withdrawal_requests')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (limit) {
      query = query.limit(limit);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  /**
   * Get a single withdrawal request by ID
   */
  async get(requestId: string) {
    const { data, error } = await supabase
      .from('withdrawal_requests')
      .select('*')
      .eq('id', requestId)
      .single();
    
    if (error) throw error;
    return data;
  },

  /**
   * Create a new withdrawal request
   */
  async create(request: GetTableInsert<'withdrawal_requests'>) {
    const { data, error } = await supabase
      .from('withdrawal_requests')
      .insert(request)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  /**
   * Update a withdrawal request
   */
  async update(requestId: string, updates: GetTableUpdate<'withdrawal_requests'>) {
    const { data, error } = await supabase
      .from('withdrawal_requests')
      .update(updates)
      .eq('id', requestId)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },
};

// ============================================================================
// NOTIFICATIONS SERVICE
// ============================================================================

export const notificationsService = {
  /**
   * Get notifications for a user
   */
  async getByUserId(userId: string, options?: { unreadOnly?: boolean; limit?: number }) {
    let query = supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (options?.unreadOnly) {
      query = query.eq('read', false);
    }

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  /**
   * Create a new notification
   */
  async create(notification: GetTableInsert<'notifications'>) {
    const { data, error } = await supabase
      .from('notifications')
      .insert(notification)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId: string) {
    const { data, error } = await supabase
      .from('notifications')
      .update({ read: true, read_at: new Date().toISOString() })
      .eq('id', notificationId)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  /**
   * Mark all notifications as read for a user
   */
  async markAllAsRead(userId: string) {
    const { error } = await supabase
      .from('notifications')
      .update({ read: true, read_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('read', false);
    
    if (error) throw error;
  },
};

// ============================================================================
// RPC FUNCTIONS SERVICE
// ============================================================================

export const rpcService = {
  /**
   * Get referral stats for a user
   */
  async getReferralStats(userId: string) {
    const { data, error } = await supabase.rpc('get_referral_stats', {
      user_uuid: userId,
    });
    
    if (error) {
      console.error('❌ get_referral_stats RPC error:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
        userId,
      });
      
      // Return zero values as fallback instead of throwing
      // This prevents the entire query from failing
      console.warn('⚠️ Returning zero stats as fallback due to RPC error');
      return {
        total_referrals: 0,
        active_referrals: 0,
        total_earnings: 0,
        task_commission_earnings: 0,
        deposit_commission_earnings: 0,
      };
    }
    return data?.[0] || {
      total_referrals: 0,
      active_referrals: 0,
      total_earnings: 0,
      task_commission_earnings: 0,
      deposit_commission_earnings: 0,
    };
  },

  /**
   * Get available task count for a user
   */
  async getAvailableTaskCount(userId: string) {
    const { data, error } = await supabase.rpc('get_available_task_count', {
      p_user_id: userId,
    });
    
    if (error) throw error;
    return data || 0;
  },

  /**
   * Get next available task for a user
   */
  async getNextAvailableTask(userId: string) {
    const { data, error } = await supabase.rpc('get_next_available_task', {
      p_user_id: userId,
    });
    
    if (error) throw error;
    return data?.[0] || null;
  },

  /**
   * Complete a task atomically
   */
  async completeTaskAtomic(params: {
    userId: string;
    taskId: string;
    selectedResponse: string;
    isCorrect: boolean;
    earningsAmount: number;
    timeTakenSeconds: number;
  }) {
    const { data, error } = await supabase.rpc('complete_task_atomic', {
      p_user_id: params.userId,
      p_task_id: params.taskId,
      p_selected_response: params.selectedResponse,
      p_is_correct: params.isCorrect,
      p_earnings_amount: params.earningsAmount,
      p_time_taken_seconds: params.timeTakenSeconds,
    });
    
    if (error) throw error;
    return data;
  },

  /**
   * Generate a referral code
   */
  async generateReferralCode() {
    const { data, error } = await supabase.rpc('generate_referral_code');
    
    if (error) throw error;
    return data;
  },

  /**
   * Generate a voucher code
   */
  async generateVoucherCode() {
    const { data, error } = await supabase.rpc('generate_voucher_code');
    
    if (error) throw error;
    return data;
  },
};

// ============================================================================
// PARTNER APPLICATIONS SERVICE
// ============================================================================

export const partnerApplicationsService = {
  /**
   * Get partner application by user ID
   */
  async getByUserId(userId: string) {
    const { data, error } = await supabase
      .from('partner_applications')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    
    if (error) throw error;
    return data;
  },

  /**
   * Get partner application by ID
   */
  async get(applicationId: string) {
    const { data, error } = await supabase
      .from('partner_applications')
      .select('*')
      .eq('id', applicationId)
      .single();
    
    if (error) throw error;
    return data;
  },

  /**
   * Get all partner applications with filters
   */
  async getAll(options?: { status?: string; limit?: number }) {
    let query = supabase
      .from('partner_applications')
      .select('*')
      .order('created_at', { ascending: false });

    if (options?.status) {
      query = query.eq('status', options.status);
    }

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  /**
   * Create a new partner application
   */
  async create(application: GetTableInsert<'partner_applications'>) {
    const { data, error } = await supabase
      .from('partner_applications')
      .insert(application)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  /**
   * Update a partner application
   */
  async update(applicationId: string, updates: GetTableUpdate<'partner_applications'>) {
    const { data, error } = await supabase
      .from('partner_applications')
      .update(updates)
      .eq('id', applicationId)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },
};

// ============================================================================
// VOUCHERS SERVICE
// ============================================================================

export const vouchersService = {
  /**
   * Get voucher by code
   */
  async getByCode(code: string) {
    const { data, error } = await supabase
      .from('vouchers')
      .select('*')
      .eq('code', code)
      .maybeSingle();
    
    if (error) throw error;
    return data;
  },

  /**
   * Get vouchers by user ID
   */
  async getByUserId(userId: string) {
    const { data, error } = await supabase
      .from('vouchers')
      .select('*')
      .eq('purchased_by', userId)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data || [];
  },

  /**
   * Create a new voucher
   */
  async create(voucher: GetTableInsert<'vouchers'>) {
    const { data, error } = await supabase
      .from('vouchers')
      .insert(voucher)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  /**
   * Update a voucher
   */
  async update(voucherId: string, updates: GetTableUpdate<'vouchers'>) {
    const { data, error } = await supabase
      .from('vouchers')
      .update(updates)
      .eq('id', voucherId)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },
};

// ============================================================================
// EMAIL TEMPLATES SERVICE
// ============================================================================

export const emailTemplatesService = {
  /**
   * Get all email templates
   */
  async getAll() {
    const { data, error } = await supabase
      .from('email_templates')
      .select('*')
      .order('name', { ascending: true });
    
    if (error) throw error;
    return data || [];
  },

  /**
   * Get template by ID
   */
  async get(templateId: string) {
    const { data, error } = await supabase
      .from('email_templates')
      .select('*')
      .eq('id', templateId)
      .single();
    
    if (error) throw error;
    return data;
  },

  /**
   * Get template by type
   */
  async getByType(templateType: string) {
    const { data, error } = await supabase
      .from('email_templates')
      .select('*')
      .eq('template_type', templateType)
      .eq('is_active', true)
      .maybeSingle();
    
    if (error) throw error;
    return data;
  },

  /**
   * Create a new email template
   */
  async create(template: GetTableInsert<'email_templates'>) {
    const { data, error } = await supabase
      .from('email_templates')
      .insert(template)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  /**
   * Update an email template
   */
  async update(templateId: string, updates: GetTableUpdate<'email_templates'>) {
    const { data, error } = await supabase
      .from('email_templates')
      .update(updates)
      .eq('id', templateId)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },
};

// ============================================================================
// USER TASKS SERVICE
// ============================================================================

export const userTasksService = {
  /**
   * Get user tasks
   */
  async getByUserId(userId: string, options?: { status?: string; limit?: number }) {
    let query = supabase
      .from('user_tasks')
      .select('*')
      .eq('user_id', userId)
      .order('assigned_at', { ascending: false });

    if (options?.status) {
      query = query.eq('status', options.status);
    }

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  /**
   * Get a single user task
   */
  async get(taskId: string) {
    const { data, error } = await supabase
      .from('user_tasks')
      .select('*')
      .eq('id', taskId)
      .single();
    
    if (error) throw error;
    return data;
  },

  /**
   * Create a new user task
   */
  async create(task: GetTableInsert<'user_tasks'>) {
    const { data, error } = await supabase
      .from('user_tasks')
      .insert(task)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  /**
   * Update a user task
   */
  async update(taskId: string, updates: GetTableUpdate<'user_tasks'>) {
    const { data, error } = await supabase
      .from('user_tasks')
      .update(updates)
      .eq('id', taskId)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },
};

// ============================================================================
// MAIN SERVICE EXPORT
// ============================================================================

export const supabaseService = {
  profiles: profilesService,
  transactions: transactionsService,
  tasks: tasksService,
  aiTasks: aiTasksService,
  taskCompletions: taskCompletionsService,
  userTasks: userTasksService,
  membershipPlans: membershipPlansService,
  referrals: referralsService,
  referralEarnings: referralEarningsService,
  userRoles: userRolesService,
  withdrawalRequests: withdrawalRequestsService,
  notifications: notificationsService,
  partnerApplications: partnerApplicationsService,
  vouchers: vouchersService,
  emailTemplates: emailTemplatesService,
  rpc: rpcService,
};

// Export default for convenience
export default supabaseService;

