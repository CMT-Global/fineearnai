import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { callEdgeFunctionWithRetry } from '@/lib/session-refresh';

/**
 * useUserManagement - Hook for admin user management operations
 * 
 * Provides functions and state for:
 * - Fetching user list with filters
 * - Getting user detail
 * - Updating user profile
 * - Managing membership plans
 * - Wallet operations
 * - Account status changes
 * - Bulk operations
 */

export interface UserFilters {
  searchTerm?: string;
  planFilter?: string;
  statusFilter?: string;
  countryFilter?: string;
  roleFilter?: string;
  emailVerifiedFilter?: string;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
}

export const useUserManagement = () => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  // Fetch user list with direct queries (simplified, real-time)
  const useUserList = (filters: UserFilters, page: number = 1, limit: number = 20) => {
    return useQuery({
      queryKey: ['admin-users', filters, page, limit],
      queryFn: async () => {
        // Build query with direct Supabase client
        let query = supabase
          .from('profiles')
          .select(`
            id,
            username,
            email,
            email_verified,
            email_verified_at,
            full_name,
            country,
            phone,
            membership_plan,
            account_status,
            deposit_wallet_balance,
            earnings_wallet_balance,
            total_earned,
            plan_expires_at,
            created_at,
            last_login,
            last_activity,
            tasks_completed_today,
            registration_country,
            registration_country_name,
            last_login_country,
            last_login_country_name
          `, { count: 'exact' });

        // Apply search filter
        if (filters.searchTerm) {
          query = query.or(`username.ilike.%${filters.searchTerm}%,email.ilike.%${filters.searchTerm}%,full_name.ilike.%${filters.searchTerm}%`);
        }

        // Apply plan filter
        if (filters.planFilter && filters.planFilter !== 'all') {
          query = query.eq('membership_plan', filters.planFilter);
        }

        // Apply status filter
        if (filters.statusFilter && filters.statusFilter !== 'all') {
          query = query.eq('account_status', filters.statusFilter as any);
        }

        // Apply country filter (using IPStack-detected registration country)
        if (filters.countryFilter && filters.countryFilter !== 'all') {
          query = query.eq('registration_country', filters.countryFilter);
        }

        // Apply role filter
        if (filters.roleFilter && filters.roleFilter !== 'all') {
          // Get user IDs with the specified role
          const { data: roleUsers, error: roleError } = await supabase
            .from('user_roles')
            .select('user_id')
            .eq('role', filters.roleFilter as 'admin' | 'moderator' | 'user');
          
          if (roleError) throw roleError;
          
          const userIds = roleUsers?.map(r => r.user_id) || [];
          if (userIds.length > 0) {
            query = query.in('id', userIds);
          } else {
            // No users with this role, return empty result
            return {
              users: [],
              totalCount: 0,
              totalPages: 0
            };
          }
        }

        // Apply email verification filter
        if (filters.emailVerifiedFilter && filters.emailVerifiedFilter !== 'all') {
          if (filters.emailVerifiedFilter === 'verified') {
            query = query.eq('email_verified', true);
          } else if (filters.emailVerifiedFilter === 'unverified') {
            query = query.eq('email_verified', false);
          }
        }

        // Apply sorting and pagination
        const { data, error, count } = await query
          .order(filters.sortBy || 'created_at', { ascending: filters.sortOrder === 'ASC' })
          .range((page - 1) * limit, page * limit - 1);

        if (error) throw error;
        
        // Fetch roles for all users in the result
        const userIds = data?.map(u => u.id) || [];
        let userRolesMap: { [key: string]: string[] } = {};
        
        if (userIds.length > 0) {
          const { data: rolesData } = await supabase
            .from('user_roles')
            .select('user_id, role')
            .in('user_id', userIds);
          
          // Build a map of user_id -> roles array
          rolesData?.forEach(r => {
            if (!userRolesMap[r.user_id]) {
              userRolesMap[r.user_id] = [];
            }
            userRolesMap[r.user_id].push(r.role);
          });
        }
        
        // Add roles to each user
        let usersWithRoles = data?.map(user => ({
          ...user,
          roles: userRolesMap[user.id] || ['user']
        })) || [];

        // Compute total earned from transactions (task_earning + referral_commission + referral_earning + adjustment)
        // so the Earned column matches what appears on the All transactions page
        if (userIds.length > 0) {
          const { data: earningsRows } = await supabase
            .from('transactions')
            .select('user_id, amount')
            .in('user_id', userIds)
            .eq('wallet_type', 'earnings')
            .eq('status', 'completed')
            .in('type', ['task_earning', 'referral_commission', 'referral_earning', 'adjustment']);

          const totalEarnedByUser: Record<string, number> = {};
          earningsRows?.forEach((row: { user_id: string; amount: number }) => {
            const uid = row.user_id;
            totalEarnedByUser[uid] = (totalEarnedByUser[uid] || 0) + Number(row.amount || 0);
          });

          usersWithRoles = usersWithRoles.map(u => ({
            ...u,
            total_earned: totalEarnedByUser[u.id] ?? 0
          }));

          // When sorting by total_earned, order the current page by computed value
          if (filters.sortBy === 'total_earned') {
            usersWithRoles = [...usersWithRoles].sort((a, b) => {
              const aVal = Number((a as { total_earned?: number }).total_earned ?? 0);
              const bVal = Number((b as { total_earned?: number }).total_earned ?? 0);
              return filters.sortOrder === 'ASC' ? aVal - bVal : bVal - aVal;
            });
          }
        }

        return {
          users: usersWithRoles,
          totalCount: count || 0,
          totalPages: Math.ceil((count || 0) / limit)
        };
      },
      staleTime: 30000, // 30 seconds
    });
  };

  // Fetch platform statistics with direct queries (real-time)
  const useUserStats = () => {
    return useQuery({
      queryKey: ['admin-user-stats'],
      queryFn: async () => {
        // Get all profiles with their balances
        const { data: profiles, count } = await supabase
          .from('profiles')
          .select('account_status, membership_plan, deposit_wallet_balance, earnings_wallet_balance, total_earned', { count: 'exact' });
        
        // Get referral counts (active status)
        const { count: referralCount } = await supabase
          .from('referrals')
          .select('*', { count: 'exact', head: true });
        
        // Get pending withdrawal counts
        const { count: pendingWithdrawals } = await supabase
          .from('withdrawal_requests')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'pending');
        
        // Get total tasks completed
        const { count: totalTasks } = await supabase
          .from('task_completions')
          .select('*', { count: 'exact', head: true });

        // Get total deposits and withdrawals from transactions
        const { data: transactions } = await supabase
          .from('transactions')
          .select('amount, type, status')
          .in('type', ['deposit', 'withdrawal'])
          .eq('status', 'completed');
        
        // Calculate aggregated stats
        const stats = {
          total_users: count || 0,
          active_users: profiles?.filter(p => p.account_status === 'active').length || 0,
          suspended_users: profiles?.filter(p => p.account_status === 'suspended').length || 0,
          banned_users: profiles?.filter(p => p.account_status === 'banned').length || 0,
          free_plan_users: profiles?.filter(p => p.membership_plan === 'free').length || 0,
          paid_plan_users: profiles?.filter(p => p.membership_plan !== 'free').length || 0,
          total_platform_balance: profiles?.reduce((sum, p) => 
            sum + Number(p.deposit_wallet_balance || 0) + Number(p.earnings_wallet_balance || 0), 0
          ) || 0,
          total_earnings_paid: profiles?.reduce((sum, p) => 
            sum + Number(p.total_earned || 0), 0
          ) || 0,
          total_deposits: transactions?.filter(t => t.type === 'deposit')
            .reduce((sum, t) => sum + Number(t.amount || 0), 0) || 0,
          total_withdrawals: transactions?.filter(t => t.type === 'withdrawal')
            .reduce((sum, t) => sum + Number(t.amount || 0), 0) || 0,
          active_referrals_count: referralCount || 0,
          pending_withdrawals_count: pendingWithdrawals || 0,
          total_tasks_completed: totalTasks || 0,
        };
        
        return stats;
      },
      staleTime: 30000, // 30 seconds for real-time data
    });
  };

  // Fetch single user detail
  const useUserDetail = (userId: string) => {
    return useQuery({
      queryKey: ['admin-user-detail', userId],
      queryFn: async () => {
        console.log('🔍 [useUserDetail] Fetching user detail for:', userId);
        
        const data: any = await callEdgeFunctionWithRetry('admin-manage-user', {
          body: { action: 'get_user_detail', userId }
        });

        if (!data || !data.result) {
          console.error('❌ [useUserDetail] Invalid response:', data);
          throw new Error('Invalid response from server');
        }

        console.log('✅ [useUserDetail] Success:', data.result.profile?.username);
        return data.result;
      },
      enabled: !!userId,
      staleTime: 30000,
      retry: 1, // Retry once (session refresh already retries)
      retryDelay: 1000,
    });
  };

  // Update user profile
  const updateUserProfile = useMutation({
    mutationFn: async ({ userId, profileData }: { userId: string; profileData: any }) => {
      return await callEdgeFunctionWithRetry('admin-manage-user', {
        body: { action: 'update_user_profile', userId, profileData }
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['admin-user-detail', variables.userId] });
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      toast.success(t('admin.toasts.profileUpdatedSuccessfully'));
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update profile');
    }
  });

  // Update user email
  const updateUserEmail = useMutation({
    mutationFn: async ({ userId, newEmail }: { userId: string; newEmail: string }) => {
      return await callEdgeFunctionWithRetry('admin-manage-user', {
        body: { action: 'update_user_email', userId, newEmail }
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['admin-user-detail', variables.userId] });
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      toast.success(t('admin.toasts.emailUpdatedSuccessfully'));
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update email');
    }
  });

  // Adjust wallet balance
  const adjustWalletBalance = useMutation({
    mutationFn: async ({ userId, walletAdjustment }: { userId: string; walletAdjustment: any }) => {
      console.log('💰 Wallet adjustment request:', {
        userId,
        walletType: walletAdjustment.wallet_type,
        amount: walletAdjustment.amount,
        reason: walletAdjustment.reason?.substring(0, 50) + '...'
      });
      
      return await callEdgeFunctionWithRetry('admin-manage-user', {
        body: { 
          action: 'adjust_wallet_balance', 
          userId,
          walletAdjustment: walletAdjustment
        }
      });
    },
    onSuccess: (data, variables) => {
      console.log('✅ Wallet adjustment successful:', data);
      queryClient.invalidateQueries({ queryKey: ['admin-user-detail', variables.userId] });
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      toast.success(t('admin.toasts.walletBalanceAdjustedSuccessfully'));
    },
    onError: (error: any) => {
      console.error('❌ Wallet adjustment failed:', error);
      toast.error(error.message || 'Failed to adjust wallet balance');
    }
  });

  // Change membership plan
  const changeMembershipPlan = useMutation({
    mutationFn: async ({ userId, planData }: { userId: string; planData: any }) => {
      return await callEdgeFunctionWithRetry('admin-manage-user', {
        body: { 
          action: 'change_membership_plan', 
          userId,
          planData: {
            plan_name: planData.plan_name ?? planData.planName,
            expires_at: planData.expires_at ?? planData.expiresAt ?? null
          }
        }
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['admin-user-detail', variables.userId] });
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      toast.success(t('admin.toasts.membershipPlanUpdatedSuccessfully'));
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update membership plan');
    }
  });

  // Suspend user
  const suspendUser = useMutation({
    mutationFn: async ({ userId, suspendReason }: { userId: string; suspendReason?: string }) => {
      return await callEdgeFunctionWithRetry('admin-manage-user', {
        body: { action: 'suspend_user', userId, suspend: true, reason: suspendReason }
      });
    },
    onSuccess: (data: any, variables) => {
      queryClient.invalidateQueries({ queryKey: ['admin-user-detail', variables.userId] });
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      toast.success(data?.result?.message || 'User suspended successfully');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to suspend user');
    }
  });

  // Ban user
  const banUser = useMutation({
    mutationFn: async ({ userId, banReason }: { userId: string; banReason: string }) => {
      return await callEdgeFunctionWithRetry('admin-manage-user', {
        body: { action: 'ban_user', userId, reason: banReason }
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['admin-user-detail', variables.userId] });
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      toast.success(t('admin.toasts.userBannedSuccessfully'));
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to ban user');
    }
  });

  // Reset daily limits
  const resetDailyLimits = useMutation({
    mutationFn: async (userId: string) => {
      return await callEdgeFunctionWithRetry('admin-manage-user', {
        body: { action: 'reset_daily_limits', userId }
      });
    },
    onSuccess: (_, userId) => {
      queryClient.invalidateQueries({ queryKey: ['admin-user-detail', userId] });
      toast.success(t('admin.toasts.dailyLimitsResetSuccessfully'));
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to reset daily limits');
    }
  });

  // Change upline
  const changeUpline = useMutation({
    mutationFn: async ({ userId, newUplineEmail }: { userId: string; newUplineEmail: string }) => {
      return await callEdgeFunctionWithRetry('admin-manage-user', {
        body: { action: 'change_upline', userId, newUplineEmail }
      });
    },
    onSuccess: (_, variables) => {
      // Invalidate ALL related caches
      queryClient.invalidateQueries({ queryKey: ['admin-user-detail', variables.userId] });
      queryClient.invalidateQueries({ queryKey: ['admin-user-referrals'] });
      queryClient.invalidateQueries({ queryKey: ['referral-complete-data', variables.userId] });
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      toast.success(t('admin.toasts.uplineChangedSuccessfully'));
    },
    onError: (error: any) => {
      toast.error(error.message || t('admin.toasts.failedToChangeUpline'));
    }
  });

  // Bulk operations
  const bulkUpdatePlan = useMutation({
    mutationFn: async ({ userIds, planName }: { userIds: string[]; planName: string }) => {
      const { data, error } = await supabase.functions.invoke('admin-bulk-operations', {
        body: { action: 'bulk_update_plan', userIds, planName }
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      toast.success(t('admin.toasts.bulkPlanUpdateCompleted'));
    },
    onError: (error: any) => {
      toast.error(error.message || 'Bulk operation failed');
    }
  });

  const bulkSuspend = useMutation({
    mutationFn: async ({ userIds, suspendReason }: { userIds: string[]; suspendReason?: string }) => {
      const { data, error } = await supabase.functions.invoke('admin-bulk-operations', {
        body: { action: 'bulk_suspend', userIds, suspendReason }
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      toast.success(t('admin.toasts.bulkSuspendCompleted'));
    },
    onError: (error: any) => {
      toast.error(error.message || 'Bulk operation failed');
    }
  });

  const bulkExport = useMutation({
    mutationFn: async ({ userIds, exportFormat }: { userIds: string[]; exportFormat: 'csv' | 'json' }) => {
      const { data, error } = await supabase.functions.invoke('admin-bulk-operations', {
        body: { action: 'bulk_export', userIds, exportFormat }
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      // Download file
      const blob = new Blob([data.result.data], { 
        type: data.result.format === 'csv' ? 'text/csv' : 'application/json' 
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `users-export.${data.result.format}`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Exported ${data.result.count} users`);
    },
    onError: (error: any) => {
      toast.error(error.message || 'Export failed');
    }
  });

  // Get user roles
  const getUserRoles = async (userId: string) => {
    const data: any = await callEdgeFunctionWithRetry('admin-manage-user', {
      body: { action: 'get_user_roles', userId }
    });
    return (data?.roles || []) as string[];
  };

  // Assign role to user
  const assignRole = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      const { data, error } = await supabase.functions.invoke('admin-manage-user', {
        body: { action: 'assign_role', userId, roleData: { role } }
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['admin-user-detail', variables.userId] });
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      queryClient.invalidateQueries({ queryKey: ['user-roles', variables.userId] });
      toast.success(t('admin.toasts.roleAssignedSuccessfully'));
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to assign role');
    }
  });

  // Remove role from user
  const removeRole = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      const { data, error } = await supabase.functions.invoke('admin-manage-user', {
        body: { action: 'remove_role', userId, roleData: { role } }
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['admin-user-detail', variables.userId] });
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      queryClient.invalidateQueries({ queryKey: ['user-roles', variables.userId] });
      toast.success(t('admin.toasts.roleRemovedSuccessfully'));
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to remove role');
    }
  });

  return {
    // Hooks
    useUserList,
    useUserStats,
    useUserDetail,
    
    // Mutations
    updateUserProfile,
    updateUserEmail,
    adjustWalletBalance,
    changeMembershipPlan,
    suspendUser,
    banUser,
    resetDailyLimits,
    changeUpline,
    
    // Role management
    getUserRoles,
    assignRole,
    removeRole,
    
    // Bulk operations
    bulkUpdatePlan,
    bulkSuspend,
    bulkExport,
  };
};