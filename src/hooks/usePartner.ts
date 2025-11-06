import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "./useAuth";
import { generateCorrelationId } from "@/lib/utils";

// 🔧 PHASE 4: Feature flag for server-side status checks
// Set to false to instantly revert to direct database queries
const USE_SERVER_STATUS = true;

// Check if user is a partner
export const useIsPartner = (correlationId?: string) => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['is-partner', user?.id],
    queryFn: async () => {
      const cid = correlationId || generateCorrelationId();
      console.log('🔍 [useIsPartner] Starting query for user:', user?.id, 'correlationId:', cid);
      
      if (!user) {
        console.log('⚠️ [useIsPartner] No user, returning false');
        return false;
      }

      // PHASE 4: Use server-side function with correlation tracking
      if (USE_SERVER_STATUS) {
        console.log('🚀 [useIsPartner] Using server-side get-partner-status function');
        try {
          const { data: { session } } = await supabase.auth.getSession();
          
          if (!session) {
            console.error('🚨 [useIsPartner] No active session');
            throw new Error('No active session');
          }

          const response = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-partner-status`,
            {
              method: 'GET',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`,
                'X-Correlation-Id': cid,
              },
            }
          );

          if (!response.ok) {
            const error = await response.json();
            console.error('🚨 [useIsPartner] Server error:', error);
            throw new Error(error.error || 'Failed to check partner status');
          }

          const result = await response.json();
          const isPartner = result.is_partner;
          console.log('✅ [useIsPartner] Server result:', { isPartner, correlationId: cid });
          return isPartner;
        } catch (error) {
          console.error('🚨 [useIsPartner] Exception:', error);
          throw error;
        }
      }

      // FALLBACK: Direct database query (original implementation)
      console.log('🔍 [useIsPartner] Using fallback: direct database query');
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'partner')
        .maybeSingle();

      if (error) {
        console.error('🚨 [useIsPartner] ERROR:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });
        throw new Error('Failed to check partner status. Please try again.');
      }

      const isPartner = !!data;
      console.log('✅ [useIsPartner] Fallback result:', { isPartner, data });
      return isPartner;
    },
    enabled: !!user,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });
};

// Check partner application status
export const usePartnerApplication = (correlationId?: string) => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['partner-application', user?.id],
    queryFn: async () => {
      const cid = correlationId || generateCorrelationId();
      console.log('🔍 [usePartnerApplication] Starting query for user:', user?.id, 'correlationId:', cid);
      
      if (!user) {
        console.log('⚠️ [usePartnerApplication] No user, returning null');
        return null;
      }

      // PHASE 4: Use server-side function with correlation tracking
      if (USE_SERVER_STATUS) {
        console.log('🚀 [usePartnerApplication] Using server-side get-partner-status function');
        try {
          const { data: { session } } = await supabase.auth.getSession();
          
          if (!session) {
            console.error('🚨 [usePartnerApplication] No active session');
            throw new Error('No active session');
          }

          const response = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-partner-status`,
            {
              method: 'GET',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`,
                'X-Correlation-Id': cid,
              },
            }
          );

          if (!response.ok) {
            const error = await response.json();
            console.error('🚨 [usePartnerApplication] Server error:', error);
            throw new Error(error.error || 'Failed to load application status');
          }

          const result = await response.json();
          const application = result.application;
          console.log('✅ [usePartnerApplication] Server result:', {
            hasApplication: !!application,
            applicationId: application?.id,
            status: application?.status,
            correlationId: cid
          });
          return application;
        } catch (error) {
          console.error('🚨 [usePartnerApplication] Exception:', error);
          throw error;
        }
      }

      // FALLBACK: Direct database query (original implementation)
      console.log('🔍 [usePartnerApplication] Using fallback: direct database query');
      const { data, error } = await supabase
        .from('partner_applications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .maybeSingle();

      if (error) {
        console.error('🚨 [usePartnerApplication] ERROR:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });
        throw new Error('Failed to load application status. Please try again.');
      }

      console.log('✅ [usePartnerApplication] Fallback result:', {
        hasApplication: !!data,
        applicationId: data?.id,
        status: data?.status,
        createdAt: data?.created_at
      });
      return data;
    },
    enabled: !!user,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    staleTime: 2 * 60 * 1000, // 2 minutes
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });
};

// Submit partner application
export const useSubmitPartnerApplication = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (data: {
      preferred_contact_method: string;
      whatsapp_number?: string;
      telegram_username?: string;
      whatsapp_group_link?: string;
      telegram_group_link?: string;
      application_notes?: string;
    }) => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error('No active session');
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/partner-application`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify(data),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to submit application');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['partner-application'] });
      toast.success('Application submitted successfully! We will review it within 24 hours.');
    },
    onError: (error: Error) => {
      console.error('Error submitting application:', error);
      toast.error(error.message || 'Failed to submit application');
    },
  });
};

// Get partner config and stats
export const usePartnerConfig = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['partner-config', user?.id],
    queryFn: async () => {
      if (!user) return null;

      const { data, error } = await supabase
        .from('partner_config')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error) {
        console.error('Error fetching partner config:', error);
        throw new Error('Failed to load partner configuration. Please try again.');
      }

      return data;
    },
    enabled: !!user,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

// Get partner vouchers
export const usePartnerVouchers = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['partner-vouchers', user?.id],
    queryFn: async () => {
      if (!user) return [];

      const { data, error } = await supabase
        .from('vouchers')
        .select(`
          *,
          redeemer:redeemed_by_user_id (
            username,
            email
          )
        `)
        .eq('partner_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching partner vouchers:', error);
        throw new Error('Failed to load vouchers. Please try again.');
      }

      return data || [];
    },
    enabled: !!user,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    staleTime: 3 * 60 * 1000, // 3 minutes
  });
};

// Purchase voucher
export const usePurchaseVoucher = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      voucher_amount: number;
      recipient_username: string;
    }) => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error('No active session');
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/purchase-voucher`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify(data),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to purchase voucher');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['partner-config'] });
      queryClient.invalidateQueries({ queryKey: ['partner-vouchers'] });
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      toast.success('Voucher purchased successfully!');
    },
    onError: (error: Error) => {
      console.error('Error purchasing voucher:', error);
      toast.error(error.message || 'Failed to purchase voucher');
    },
  });
};

// Update payment methods
export const useUpdatePaymentMethods = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (paymentMethods: any[]) => {
      if (!user) throw new Error('User not authenticated');

      const { error } = await supabase
        .from('partner_config')
        .update({ payment_methods: paymentMethods })
        .eq('user_id', user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['partner-config'] });
      toast.success('Payment methods updated successfully!');
    },
    onError: (error: Error) => {
      console.error('Error updating payment methods:', error);
      toast.error('Failed to update payment methods');
    },
  });
};
