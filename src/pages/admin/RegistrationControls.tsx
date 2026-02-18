import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useLanguageSync } from "@/hooks/useLanguageSync";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, UserPlus, Link as LinkIcon } from "lucide-react";
import { PageLoading } from "@/components/shared/PageLoading";
import type { Json } from "@/integrations/supabase/types";

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
  landing_banner_title: "We are now invite-only",
  landing_banner_description: "We are onboarding in batches to protect task quality and keep access fair. Request an invite to get started.",
  invite_required_message_title: "Invite Required",
  invite_required_message_description: "Registration is by invite only. Request an invite below or use your invite link to sign up.",
  request_submitted_success_message: "Check your email for a verification code. Enter it below to receive your invite link.",
};

export default function RegistrationControls() {
  const { t } = useTranslation();
  useLanguageSync();
  const queryClient = useQueryClient();
  const [config, setConfig] = useState<InviteOnlyRegistrationConfig>(DEFAULT_CONFIG);
  const [hasChanges, setHasChanges] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["invite-only-registration-config"],
    queryFn: async () => {
      const { data: row, error } = await supabase
        .from("platform_config")
        .select("key, value")
        .eq("key", "invite_only_registration_config")
        .single();
      if (error) {
        if (error.code === "PGRST116") return null;
        throw error;
      }
      return row?.value as InviteOnlyRegistrationConfig | null;
    },
  });

  useEffect(() => {
    if (data) {
      setConfig({ ...DEFAULT_CONFIG, ...data });
      setHasChanges(false);
    }
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: async (payload: InviteOnlyRegistrationConfig) => {
      const { error } = await supabase
        .from("platform_config")
        .upsert(
          {
            key: "invite_only_registration_config",
            value: payload as unknown as Json,
            description: "Invite-only registration: toggles, copy, and default referrer",
            updated_at: new Date().toISOString(),
          },
          { onConflict: "key" }
        );
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invite-only-registration-config"] });
      setHasChanges(false);
      toast.success(t("admin.registrationControls.saved"));
    },
    onError: (error: Error) => {
      toast.error(t("admin.registrationControls.saveFailed", { message: error.message }));
    },
  });

  const updateConfig = (updates: Partial<InviteOnlyRegistrationConfig>) => {
    setConfig((prev) => ({ ...prev, ...updates }));
    setHasChanges(true);
  };

  if (isLoading) {
    return <PageLoading text={t("admin.registrationControls.loading")} />;
  }

  return (
    <div className="container mx-auto px-4 py-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <UserPlus className="h-8 w-8" />
          {t("admin.registrationControls.title")}
        </h1>
        <p className="text-muted-foreground mt-1">
          {t("admin.registrationControls.subtitle")}
        </p>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>{t("admin.registrationControls.modeTitle")}</CardTitle>
          <CardDescription>{t("admin.registrationControls.modeDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="space-y-0.5">
              <Label htmlFor="invite-only-mode">{t("admin.registrationControls.inviteOnlyMode")}</Label>
              <p className="text-sm text-muted-foreground">{t("admin.registrationControls.inviteOnlyModeHelp")}</p>
            </div>
            <Switch
              id="invite-only-mode"
              checked={config.invite_only_mode}
              onCheckedChange={(v) => updateConfig({ invite_only_mode: v })}
            />
          </div>
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="space-y-0.5">
              <Label htmlFor="enable-invite-requests">{t("admin.registrationControls.enableInviteRequests")}</Label>
              <p className="text-sm text-muted-foreground">{t("admin.registrationControls.enableInviteRequestsHelp")}</p>
            </div>
            <Switch
              id="enable-invite-requests"
              checked={config.enable_invite_requests}
              onCheckedChange={(v) => updateConfig({ enable_invite_requests: v })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="referral-cookie-days">{t("admin.registrationControls.referralCookieDays")}</Label>
            <Input
              id="referral-cookie-days"
              type="number"
              min={1}
              max={365}
              value={config.referral_cookie_duration_days}
              onChange={(e) => updateConfig({ referral_cookie_duration_days: parseInt(e.target.value, 10) || 30 })}
            />
            <p className="text-sm text-muted-foreground">{t("admin.registrationControls.referralCookieDaysHelp")}</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="default-referrer">{t("admin.registrationControls.defaultReferrer")}</Label>
            <Input
              id="default-referrer"
              placeholder="username"
              value={config.default_invite_referrer_username}
              onChange={(e) => updateConfig({ default_invite_referrer_username: e.target.value.trim() })}
            />
            <p className="text-sm text-muted-foreground">{t("admin.registrationControls.defaultReferrerHelp")}</p>
          </div>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>{t("admin.registrationControls.copyTitle")}</CardTitle>
          <CardDescription>{t("admin.registrationControls.copyDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>{t("admin.registrationControls.landingBannerTitle")}</Label>
            <Input
              value={config.landing_banner_title}
              onChange={(e) => updateConfig({ landing_banner_title: e.target.value })}
              placeholder={DEFAULT_CONFIG.landing_banner_title}
            />
          </div>
          <div className="space-y-2">
            <Label>{t("admin.registrationControls.landingBannerDescription")}</Label>
            <Textarea
              value={config.landing_banner_description}
              onChange={(e) => updateConfig({ landing_banner_description: e.target.value })}
              placeholder={DEFAULT_CONFIG.landing_banner_description}
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <Label>{t("admin.registrationControls.inviteRequiredTitle")}</Label>
            <Input
              value={config.invite_required_message_title}
              onChange={(e) => updateConfig({ invite_required_message_title: e.target.value })}
              placeholder={DEFAULT_CONFIG.invite_required_message_title}
            />
          </div>
          <div className="space-y-2">
            <Label>{t("admin.registrationControls.inviteRequiredDescription")}</Label>
            <Textarea
              value={config.invite_required_message_description}
              onChange={(e) => updateConfig({ invite_required_message_description: e.target.value })}
              placeholder={DEFAULT_CONFIG.invite_required_message_description}
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <Label>{t("admin.registrationControls.requestSuccessMessage")}</Label>
            <Textarea
              value={config.request_submitted_success_message}
              onChange={(e) => updateConfig({ request_submitted_success_message: e.target.value })}
              placeholder={DEFAULT_CONFIG.request_submitted_success_message}
              rows={2}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LinkIcon className="h-5 w-5" />
            {t("admin.registrationControls.emailTemplatesTitle")}
          </CardTitle>
          <CardDescription>{t("admin.registrationControls.emailTemplatesDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {t("admin.registrationControls.emailTemplatesHelp")}{" "}
            <a href="/admin/communications/templates" className="text-primary underline">
              {t("admin.registrationControls.emailTemplatesLink")}
            </a>
          </p>
        </CardContent>
      </Card>

      <div className="flex gap-2">
        <Button
          onClick={() => saveMutation.mutate(config)}
          disabled={!hasChanges || saveMutation.isPending}
        >
          {saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {t("admin.registrationControls.save")}
        </Button>
        {hasChanges && (
          <Button variant="outline" onClick={() => setConfig(data ? { ...DEFAULT_CONFIG, ...data } : DEFAULT_CONFIG)}>
            {t("admin.registrationControls.discard")}
          </Button>
        )}
      </div>
    </div>
  );
}
