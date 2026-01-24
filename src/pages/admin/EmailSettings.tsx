import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLanguageSync } from "@/hooks/useLanguageSync";

import { AdminBreadcrumb } from "@/components/admin/AdminBreadcrumb";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Mail, Send, RotateCcw, AlertCircle, CheckCircle2, Settings, Loader2 } from "lucide-react";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { z } from "zod";
import { EmailVerificationRemindersSettings } from "@/components/admin/EmailVerificationRemindersSettings";

// Validation schema - only essential email settings
const emailSettingsSchema = z.object({
  from_address: z.string().email("Invalid email address").max(255, "Email too long"),
  from_name: z.string().trim().min(1, "From name is required").max(100, "Name too long"),
  reply_to_address: z.string().email("Invalid email address").max(255, "Email too long"),
  reply_to_name: z.string().trim().min(1, "Reply-to name is required").max(100, "Name too long"),
  support_email: z.string().email("Invalid email address").max(255, "Email too long"),
  platform_name: z.string().trim().min(1, "Platform name is required").max(100, "Name too long"),
  platform_url: z.string().url("Invalid URL").max(500, "URL too long"),
  admin_notification_email: z.string().email("Invalid email address").max(255, "Email too long"),
  footer_text: z.string().max(1000, "Footer text too long"),
});

// Default settings - only essential fields
const DEFAULT_SETTINGS = {
  from_address: "noreply@profitchips.com",
  from_name: "ProfitChips",
  reply_to_address: "support@profitchips.com",
  reply_to_name: "ProfitChips Support",
  support_email: "support@profitchips.com",
  platform_name: "ProfitChips",
  platform_url: "https://profitchips.com",
  admin_notification_email: "admin@profitchips.com",
  footer_text: "This is an automated email from ProfitChips. Please do not reply to this email.",
};

export default function EmailSettings() {
  const { t } = useTranslation();
  useLanguageSync(); // Sync language and force re-render when language changes
  
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [hasChanges, setHasChanges] = useState(false);
  const [testEmailSent, setTestEmailSent] = useState(false);
  
  // Fetch email settings
  const { data: configData, isLoading } = useQuery({
    queryKey: ['email-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('platform_config')
        .select('value')
        .eq('key', 'email_settings')
        .maybeSingle();

      if (error) throw error;
      return data?.value as typeof DEFAULT_SETTINGS | null;
    },
  });

  // Update settings when data loads
  useEffect(() => {
    if (configData && typeof configData === 'object') {
      setSettings({ ...DEFAULT_SETTINGS, ...configData });
    }
  }, [configData]);

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async (newSettings: typeof settings) => {
      const { error } = await supabase
        .from('platform_config')
        .upsert({
          key: 'email_settings',
          value: newSettings,
          description: 'Email sending configuration for the platform',
          updated_at: new Date().toISOString(),
        }, { onConflict: 'key' });

      if (error) throw error;
    },  
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-settings'] });
      setHasChanges(false);
      toast({
        title: t("admin.emailSettings.toasts.settingsSaved"),
        description: t("admin.emailSettings.toasts.settingsSavedDescription"),
      });
    },
    onError: (error) => {
      toast({
        title: t("admin.emailSettings.toasts.errorSaving"),
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Send test email mutation - simplified
  const testEmailMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) throw new Error("No user email found");

      const { error } = await supabase.functions.invoke('send-test-email', {
        body: {
          test_email: user.email,
        }
      });

      if (error) throw error;
    },
    onSuccess: () => {
      setTestEmailSent(true);
      setTimeout(() => setTestEmailSent(false), 5000);
      toast({
        title: t("admin.emailSettings.toasts.testEmailSent"),
        description: t("admin.emailSettings.toasts.testEmailSentDescription"),
      });
    },
    onError: (error) => {
      toast({
        title: t("admin.emailSettings.toasts.errorSendingTest"),
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleInputChange = (field: string, value: any) => {
    setSettings(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);
    setErrors(prev => ({ ...prev, [field]: "" }));
  };

  const handleSave = () => {
    // Validate settings
    try {
      emailSettingsSchema.parse(settings);
      setErrors({});
      saveMutation.mutate(settings);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const newErrors: Record<string, string> = {};
        error.errors.forEach(err => {
          if (err.path[0]) {
            newErrors[err.path[0] as string] = err.message;
          }
        });
        setErrors(newErrors);
        toast({
          title: t("admin.emailSettings.toasts.validationError"),
          description: t("admin.emailSettings.toasts.validationErrorDescription"),
          variant: "destructive",
        });
      }
    }
  };

  const handleReset = () => {
    setSettings(DEFAULT_SETTINGS);
    setHasChanges(true);
    setErrors({});
    toast({
      title: t("admin.emailSettings.toasts.settingsReset"),
      description: t("admin.emailSettings.toasts.settingsResetDescription"),
    });
  };

  const handleSendTest = () => {
    testEmailMutation.mutate();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <LoadingSpinner size="lg" text={t("common.loading")} />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      <AdminBreadcrumb
        items={[
          { label: t("admin.emailSettings.breadcrumb.communications") },
          { label: t("admin.emailSettings.breadcrumb.emailSettings") },
        ]}
      />

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">{t("admin.emailSettings.title")}</h1>
            <p className="text-muted-foreground mt-1">
              {t("admin.emailSettings.subtitle")}
            </p>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleReset}
              disabled={saveMutation.isPending}
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              {t("admin.emailSettings.actions.resetToDefaults")}
            </Button>
            
            <Button
              variant="outline"
              onClick={handleSendTest}
              disabled={testEmailMutation.isPending || !settings.from_address}
            >
              {testEmailMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              {t("admin.emailSettings.actions.sendTestEmail")}
            </Button>

            <Button
              onClick={handleSave}
              disabled={!hasChanges || saveMutation.isPending}
            >
              {saveMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Mail className="h-4 w-4 mr-2" />
              )}
              {t("admin.emailSettings.actions.saveSettings")}
            </Button>
          </div>
        </div>

        {testEmailSent && (
          <Alert className="border-green-500 bg-green-50">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800">
              {t("admin.emailSettings.testEmailSent")}
            </AlertDescription>
          </Alert>
        )}

        {/* Sender Information */}
        <Card>
          <CardHeader>
            <CardTitle>{t("admin.emailSettings.senderInformation.title")}</CardTitle>
            <CardDescription>
              {t("admin.emailSettings.senderInformation.description")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="from_address">{t("admin.emailSettings.senderInformation.fromAddress")}</Label>
                    <Input
                      id="from_address"
                      type="email"
                      value={settings.from_address}
                      onChange={(e) => handleInputChange('from_address', e.target.value)}
                      placeholder="noreply@profitchips.com"
                    />
                    {errors.from_address && (
                      <p className="text-sm text-destructive flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        {errors.from_address}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="from_name">{t("admin.emailSettings.senderInformation.fromName")}</Label>
                    <Input
                      id="from_name"
                      value={settings.from_name}
                      onChange={(e) => handleInputChange('from_name', e.target.value)}
                      placeholder="ProfitChips"
                    />
                    {errors.from_name && (
                      <p className="text-sm text-destructive flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        {errors.from_name}
                      </p>
                    )}
                  </div>
                </div>
          </CardContent>
        </Card>

        {/* Reply-To Information */}
        <Card>
          <CardHeader>
            <CardTitle>{t("admin.emailSettings.replyToInformation.title")}</CardTitle>
            <CardDescription>
              {t("admin.emailSettings.replyToInformation.description")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="reply_to_address">{t("admin.emailSettings.replyToInformation.replyToAddress")}</Label>
                    <Input
                      id="reply_to_address"
                      type="email"
                      value={settings.reply_to_address}
                      onChange={(e) => handleInputChange('reply_to_address', e.target.value)}
                      placeholder="support@profitchips.com"
                    />
                    {errors.reply_to_address && (
                      <p className="text-sm text-destructive flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        {errors.reply_to_address}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="reply_to_name">{t("admin.emailSettings.replyToInformation.replyToName")}</Label>
                    <Input
                      id="reply_to_name"
                      value={settings.reply_to_name}
                      onChange={(e) => handleInputChange('reply_to_name', e.target.value)}
                      placeholder="ProfitChips Support"
                    />
                    {errors.reply_to_name && (
                      <p className="text-sm text-destructive flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        {errors.reply_to_name}
                      </p>
                    )}
                  </div>
                </div>
          </CardContent>
        </Card>

        {/* Platform Information */}
        <Card>
          <CardHeader>
            <CardTitle>{t("admin.emailSettings.platformInformation.title")}</CardTitle>
            <CardDescription>
              {t("admin.emailSettings.platformInformation.description")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="platform_name">{t("admin.emailSettings.platformInformation.platformName")}</Label>
                    <Input
                      id="platform_name"
                      value={settings.platform_name}
                      onChange={(e) => handleInputChange('platform_name', e.target.value)}
                      placeholder="ProfitChips"
                    />
                    {errors.platform_name && (
                      <p className="text-sm text-destructive flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        {errors.platform_name}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="platform_url">{t("admin.emailSettings.platformInformation.platformUrl")}</Label>
                    <Input
                      id="platform_url"
                      type="url"
                      value={settings.platform_url}
                      onChange={(e) => handleInputChange('platform_url', e.target.value)}
                      placeholder="https://fineearn.com"
                    />
                    {errors.platform_url && (
                      <p className="text-sm text-destructive flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        {errors.platform_url}
                      </p>
                    )}
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="support_email">{t("admin.emailSettings.platformInformation.supportEmail")}</Label>
                    <Input
                      id="support_email"
                      type="email"
                      value={settings.support_email}
                      onChange={(e) => handleInputChange('support_email', e.target.value)}
                      placeholder="support@profitchips.com"
                    />
                    {errors.support_email && (
                      <p className="text-sm text-destructive flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        {errors.support_email}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="admin_notification_email">{t("admin.emailSettings.platformInformation.adminNotificationEmail")}</Label>
                    <Input
                      id="admin_notification_email"
                      type="email"
                      value={settings.admin_notification_email}
                      onChange={(e) => handleInputChange('admin_notification_email', e.target.value)}
                      placeholder="admin@profitchips.com"
                    />
                    {errors.admin_notification_email && (
                      <p className="text-sm text-destructive flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        {errors.admin_notification_email}
                      </p>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="footer_text">{t("admin.emailSettings.platformInformation.footerText")}</Label>
                  <Textarea
                    id="footer_text"
                    value={settings.footer_text}
                    onChange={(e) => handleInputChange('footer_text', e.target.value)}
                    placeholder="This is an automated email from ProfitChips..."
                    rows={3}
                  />
                  {errors.footer_text && (
                    <p className="text-sm text-destructive flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      {errors.footer_text}
                    </p>
                  )}
                </div>
          </CardContent>
        </Card>

        {/* Email Verification Reminders */}
        <EmailVerificationRemindersSettings />
    </div>
  );
}
