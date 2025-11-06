import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export interface OnboardingSteps {
  profile_completed: boolean;
  payment_methods_set: boolean;
  first_voucher_created: boolean;
  community_joined: boolean;
  guidelines_read: boolean;
}

export interface PartnerOnboarding {
  id: string;
  partner_id: string;
  setup_completed: boolean;
  steps_completed: OnboardingSteps;
  dismissed_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export const usePartnerOnboarding = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['partner-onboarding', user?.id],
    queryFn: async () => {
      if (!user) return null;

      const { data, error } = await supabase
        .from('partner_onboarding')
        .select('*')
        .eq('partner_id', user.id)
        .single();

      if (error) {
        // If no record exists, it means they're not a partner yet
        if (error.code === 'PGRST116') {
          return null;
        }
        throw error;
      }

      return {
        ...data,
        steps_completed: data.steps_completed as unknown as OnboardingSteps
      } as PartnerOnboarding;
    },
    enabled: !!user,
  });
};

export const useUpdateOnboardingStep = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ step, value }: { step: string; value: boolean }) => {
      const { data, error } = await supabase.functions.invoke(
        'update-partner-onboarding',
        {
          body: { step, value },
        }
      );

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['partner-onboarding', user?.id] });
    },
  });
};

export const useDismissOnboarding = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke(
        'update-partner-onboarding',
        {
          body: { dismiss: true },
        }
      );

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['partner-onboarding', user?.id] });
    },
  });
};