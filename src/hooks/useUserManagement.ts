import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

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
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
}

export const useUserManagement = () => {
  const queryClient = useQueryClient();

  // Fetch user list with optimized search
  const useUserList = (filters: UserFilters, page: number = 1, limit: number = 20) => {
    return useQuery({
      queryKey: ['admin-users', filters, page, limit],
      queryFn: async () => {
        const { data, error } = await supabase.rpc('search_users_optimized', {
          p_search_term: filters.searchTerm || null,
          p_plan_filter: filters.planFilter === 'all' ? null : filters.planFilter,
          p_status_filter: filters.statusFilter === 'all' ? null : (filters.statusFilter as 'active' | 'banned' | 'suspended' | null),
          p_country_filter: filters.countryFilter || null,
          p_sort_by: filters.sortBy || 'created_at',
          p_sort_order: filters.sortOrder || 'DESC',
          p_limit: limit,
          p_offset: (page - 1) * limit
        });

        if (error) throw error;
        
        return {
          users: data || [],
          totalCount: data?.[0]?.total_count || 0,
          totalPages: Math.ceil((data?.[0]?.total_count || 0) / limit)
        };
      },
      staleTime: 30000, // 30 seconds
    });
  };

  // Fetch platform statistics
  const useUserStats = () => {
    return useQuery({
      queryKey: ['admin-user-stats'],
      queryFn: async () => {
        const { data, error } = await supabase.rpc('get_user_management_stats');
        if (error) throw error;
        return data;
      },
      staleTime: 60000, // 1 minute
    });
  };

  // Fetch single user detail
  const useUserDetail = (userId: string) => {
    return useQuery({
      queryKey: ['admin-user-detail', userId],
      queryFn: async () => {
        const { data, error } = await supabase.functions.invoke('admin-manage-user', {
          body: { action: 'get_user_detail', userId }
        });

        if (error) throw error;
        return data.result;
      },
      enabled: !!userId,
      staleTime: 30000,
    });
  };

  // Update user profile
  const updateUserProfile = useMutation({
    mutationFn: async ({ userId, profileData }: { userId: string; profileData: any }) => {
      const { data, error } = await supabase.functions.invoke('admin-manage-user', {
        body: { action: 'update_user_profile', userId, profileData }
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['admin-user-detail', variables.userId] });
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      toast.success('Profile updated successfully');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update profile');
    }
  });

  // Update user email
  const updateUserEmail = useMutation({
    mutationFn: async ({ userId, newEmail }: { userId: string; newEmail: string }) => {
      const { data, error } = await supabase.functions.invoke('admin-manage-user', {
        body: { action: 'update_user_email', userId, newEmail }
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['admin-user-detail', variables.userId] });
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      toast.success('Email updated successfully');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update email');
    }
  });

  // Adjust wallet balance
  const adjustWalletBalance = useMutation({
    mutationFn: async ({ userId, walletAdjustment }: { userId: string; walletAdjustment: any }) => {
      const { data, error } = await supabase.functions.invoke('admin-manage-user', {
        body: { action: 'adjust_wallet_balance', userId, walletAdjustment }
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['admin-user-detail', variables.userId] });
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      toast.success('Wallet balance adjusted successfully');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to adjust wallet balance');
    }
  });

  // Change membership plan
  const changeMembershipPlan = useMutation({
    mutationFn: async ({ userId, planData }: { userId: string; planData: any }) => {
      const { data, error } = await supabase.functions.invoke('admin-manage-user', {
        body: { action: 'change_membership_plan', userId, planData }
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['admin-user-detail', variables.userId] });
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      toast.success('Membership plan updated successfully');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update membership plan');
    }
  });

  // Suspend user
  const suspendUser = useMutation({
    mutationFn: async ({ userId, suspendReason }: { userId: string; suspendReason?: string }) => {
      const { data, error } = await supabase.functions.invoke('admin-manage-user', {
        body: { action: 'suspend_user', userId, suspendReason }
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['admin-user-detail', variables.userId] });
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      toast.success(data.result.message);
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to suspend user');
    }
  });

  // Ban user
  const banUser = useMutation({
    mutationFn: async ({ userId, banReason }: { userId: string; banReason: string }) => {
      const { data, error } = await supabase.functions.invoke('admin-manage-user', {
        body: { action: 'ban_user', userId, banReason }
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['admin-user-detail', variables.userId] });
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      toast.success('User banned successfully');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to ban user');
    }
  });

  // Reset daily limits
  const resetDailyLimits = useMutation({
    mutationFn: async (userId: string) => {
      const { data, error } = await supabase.functions.invoke('admin-manage-user', {
        body: { action: 'reset_daily_limits', userId }
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (_, userId) => {
      queryClient.invalidateQueries({ queryKey: ['admin-user-detail', userId] });
      toast.success('Daily limits reset successfully');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to reset daily limits');
    }
  });

  // Change upline
  const changeUpline = useMutation({
    mutationFn: async ({ userId, newUplineEmail }: { userId: string; newUplineEmail: string }) => {
      const { data, error } = await supabase.functions.invoke('admin-manage-user', {
        body: { action: 'change_upline', userId, newUplineEmail }
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['admin-user-detail', variables.userId] });
      toast.success('Upline changed successfully');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to change upline');
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
      toast.success('Bulk plan update completed');
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
      toast.success('Bulk suspend completed');
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
    
    // Bulk operations
    bulkUpdatePlan,
    bulkSuspend,
    bulkExport,
  };
};