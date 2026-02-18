import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface InviteOnlyRegistrationConfig {
  invite_only_mode: boolean;
  referral_cookie_duration_days: number;
  enable_invite_requests: boolean;
  default_invite_referrer_username: string;
  landing_banner_title: string;
  landing_banner_description: string;
  invite_required_message_title: string;
  invite_required_message_description: string;
  request_submitted_success_message: string;
}

const DEFAULT_CONFIG: InviteOnlyRegistrationConfig = {
  invite_only_mode: false,
  referral_cookie_duration_days: 30,
  enable_invite_requests: true,
  default_invite_referrer_username: "",
  landing_banner_title: "",
  landing_banner_description: "",
  invite_required_message_title: "Invite Required",
  invite_required_message_description: "Registration is by invite only.",
  request_submitted_success_message: "Check your email for a verification code.",
};

const QUERY_KEY = ["invite-only-registration-config"];

export function useInviteOnlyConfig() {
  const { data, isLoading, error } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: async (): Promise<InviteOnlyRegistrationConfig> => {
      const { data: row, error: e } = await supabase
        .from("platform_config")
        .select("value")
        .eq("key", "invite_only_registration_config")
        .single();
      if (e || !row?.value) return DEFAULT_CONFIG;
      return { ...DEFAULT_CONFIG, ...(row.value as Record<string, unknown>) } as InviteOnlyRegistrationConfig;
    },
    staleTime: 2 * 60 * 1000,
  });

  return {
    config: data ?? DEFAULT_CONFIG,
    isLoading,
    error,
    isInviteOnly: data?.invite_only_mode ?? false,
    enableInviteRequests: data?.enable_invite_requests ?? true,
  };
}
