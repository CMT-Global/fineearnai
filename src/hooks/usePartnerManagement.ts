import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ApprovalPayload {
  application_id: string;
  action: 'approve' | 'reject';
  rejection_reason?: string;
  custom_commission_rate?: number;
}

// Fetch partner applications with filters
export const usePartnerApplications = (status?: string) => {
  return useQuery({
    queryKey: ['partner-applications', status],
    queryFn: async () => {
      let query = supabase
        .from('partner_applications')
        .select(`
          *,
          profiles!fk_partner_applications_user_id (
            username,
            email,
            full_name,
            membership_plan
          )
        `)
        .order('created_at', { ascending: false });

      if (status && status !== 'all') {
        query = query.eq('status', status);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching partner applications:', error);
        throw new Error('Failed to load partner applications. Please check your connection and try again.');
      }

      return data || [];
    },
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
};

// Approve/Reject partner application
export const useManagePartnerApplication = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: ApprovalPayload) => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error('No active session');
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-partner-management`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to process application');
      }

      return response.json();
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['partner-applications'] });
      queryClient.invalidateQueries({ queryKey: ['partners'] });
      
      toast.success(
        variables.action === 'approve' 
          ? 'Partner application approved successfully!' 
          : 'Partner application rejected'
      );
    },
    onError: (error: Error) => {
      console.error('Error managing partner application:', error);
      toast.error(error.message || 'Failed to process application');
    },
  });
};

// Fetch all partners with stats
export const usePartners = () => {
  return useQuery({
    queryKey: ['partners'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('partner_config')
        .select(`
          *,
          profiles!partner_config_user_id_fkey (
            username,
            email,
            full_name,
            membership_plan,
            account_status
          )
        `)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching partners:', error);
        throw new Error('Failed to load partners list. Please try again.');
      }

      return data || [];
    },
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

// Fetch partner stats
export const usePartnerStats = () => {
  return useQuery({
    queryKey: ['partner-stats'],
    queryFn: async () => {
      const { data: partners, error: partnersError } = await supabase
        .from('partner_config')
        .select('*')
        .eq('is_active', true);

      if (partnersError) {
        console.error('Error fetching partners:', partnersError);
        throw new Error('Failed to load partner statistics. Please try again.');
      }

      const { data: applications, error: appsError } = await supabase
        .from('partner_applications')
        .select('status');

      if (appsError) {
        console.error('Error fetching applications:', appsError);
        throw new Error('Failed to load application statistics. Please try again.');
      }

      const { data: vouchers, error: vouchersError } = await supabase
        .from('vouchers')
        .select('*');

      if (vouchersError) {
        console.error('Error fetching vouchers:', vouchersError);
        throw new Error('Failed to load voucher statistics. Please try again.');
      }

      const totalVouchersSold = vouchers?.filter(v => v.status === 'redeemed').length || 0;
      const totalVoucherValue = vouchers
        ?.filter(v => v.status === 'redeemed')
        .reduce((sum, v) => sum + parseFloat(String(v.voucher_amount)), 0) || 0;

      const pendingApplications = applications?.filter(a => a.status === 'pending').length || 0;

      return {
        totalPartners: partners?.length || 0,
        totalVouchersSold,
        totalVoucherValue,
        pendingApplications,
      };
    },
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

// Fetch vouchers with filters
export const useVouchers = (filters?: { status?: string; partner_id?: string }) => {
  return useQuery({
    queryKey: ['vouchers', filters],
    queryFn: async () => {
      let query = supabase
        .from('vouchers')
        .select(`
          *,
          partner:partner_id (
            username,
            email
          ),
          redeemer:redeemed_by (
            username,
            email
          )
        `)
        .order('created_at', { ascending: false });

      if (filters?.status && filters.status !== 'all') {
        query = query.eq('status', filters.status);
      }

      if (filters?.partner_id) {
        query = query.eq('partner_id', filters.partner_id);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching vouchers:', error);
        throw new Error('Failed to load vouchers. Please check your connection and try again.');
      }

      return data || [];
    },
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    staleTime: 3 * 60 * 1000, // 3 minutes
  });
};
