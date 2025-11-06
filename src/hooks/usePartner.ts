import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "./useAuth";

// Check if user is a partner
export const useIsPartner = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['is-partner', user?.id],
    queryFn: async () => {
      if (!user) return false;

      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'partner')
        .maybeSingle();

      if (error) {
        console.error('Error checking partner status:', error);
        return false;
      }

      return !!data;
    },
    enabled: !!user,
  });
};

// Check partner application status
export const usePartnerApplication = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['partner-application', user?.id],
    queryFn: async () => {
      if (!user) return null;

      const { data, error } = await supabase
        .from('partner_applications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .maybeSingle();

      if (error) {
        console.error('Error fetching partner application:', error);
        return null;
      }

      return data;
    },
    enabled: !!user,
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
        return null;
      }

      return data;
    },
    enabled: !!user,
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
        return [];
      }

      return data;
    },
    enabled: !!user,
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
