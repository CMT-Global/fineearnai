import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Mail, Bell, Clock, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface ReminderConfig {
  enabled: boolean;
  first_reminder_days: number;
  second_reminder_days: number;
  third_reminder_days: number;
  reminder_frequency_days: number;
  max_reminders: number;
}

export function EmailVerificationRemindersSettings() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [config, setConfig] = useState<ReminderConfig>({
    enabled: true,
    first_reminder_days: 3,
    second_reminder_days: 7,
    third_reminder_days: 14,
    reminder_frequency_days: 7,
    max_reminders: 5,
  });

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("platform_config")
        .select("value")
        .eq("key", "email_verification_reminders")
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        // Only throw if it's not a "no rows" error
        throw error;
      }

      if (data?.value) {
        setConfig(data.value as unknown as ReminderConfig);
      }
      // If no data found, keep the default config that's already set in state
    } catch (error: any) {
      console.error("Error fetching reminder config:", error);
      // Only show error toast for actual errors, not missing records
      if (error.code !== 'PGRST116') {
      toast({
        title: t("admin.emailSettings.verificationReminders.toasts.errorLoading"),
        description: t("admin.emailSettings.verificationReminders.toasts.errorLoadingDescription"),
        variant: "destructive",
      });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("platform_config")
        .upsert({
          key: "email_verification_reminders",
          value: config as any,
          description: "Email verification reminder settings",
          updated_at: new Date().toISOString(),
        }, { onConflict: "key" });

      if (error) throw error;

      toast({
        title: t("admin.emailSettings.verificationReminders.toasts.settingsSaved"),
        description: t("admin.emailSettings.verificationReminders.toasts.settingsSavedDescription"),
      });
    } catch (error: any) {
      console.error("Error saving reminder config:", error);
      toast({
        title: t("admin.emailSettings.verificationReminders.toasts.errorSaving"),
        description: t("admin.emailSettings.verificationReminders.toasts.errorSavingDescription"),
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestReminders = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        "send-email-verification-reminders"
      );

      if (error) throw error;

      toast({
        title: t("admin.emailSettings.verificationReminders.toasts.remindersSent"),
        description: t("admin.emailSettings.verificationReminders.toasts.remindersSentDescription", {
          sent: data.sent,
          processed: data.processed,
        }),
      });
    } catch (error: any) {
      console.error("Error sending test reminders:", error);
      toast({
        title: t("admin.emailSettings.verificationReminders.toasts.errorSending"),
        description: error.message || t("admin.emailSettings.verificationReminders.toasts.errorSendingDescription"),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading && !config) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              {t("admin.emailSettings.verificationReminders.title")}
            </CardTitle>
            <CardDescription>
              {t("admin.emailSettings.verificationReminders.description")}
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleTestReminders}
            disabled={isLoading || !config.enabled}
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {t("admin.emailSettings.verificationReminders.sending")}
              </>
            ) : (
              <>
                <Mail className="h-4 w-4 mr-2" />
                {t("admin.emailSettings.verificationReminders.sendTestReminders")}
              </>
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {t("admin.emailSettings.verificationReminders.alertDescription")}
          </AlertDescription>
        </Alert>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>{t("admin.emailSettings.verificationReminders.enableReminders")}</Label>
              <p className="text-sm text-muted-foreground">
                {t("admin.emailSettings.verificationReminders.enableRemindersDescription")}
              </p>
            </div>
            <Switch
              checked={config.enabled}
              onCheckedChange={(enabled) =>
                setConfig({ ...config, enabled })
              }
            />
          </div>

          {config.enabled && (
            <>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="first_reminder">
                    <Clock className="h-4 w-4 inline mr-2" />
                    {t("admin.emailSettings.verificationReminders.firstReminder")}
                  </Label>
                  <Input
                    id="first_reminder"
                    type="number"
                    min="1"
                    value={config.first_reminder_days}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        first_reminder_days: parseInt(e.target.value) || 0,
                      })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="second_reminder">
                    {t("admin.emailSettings.verificationReminders.secondReminder")}
                  </Label>
                  <Input
                    id="second_reminder"
                    type="number"
                    min="1"
                    value={config.second_reminder_days}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        second_reminder_days: parseInt(e.target.value) || 0,
                      })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="third_reminder">
                    {t("admin.emailSettings.verificationReminders.thirdReminder")}
                  </Label>
                  <Input
                    id="third_reminder"
                    type="number"
                    min="1"
                    value={config.third_reminder_days}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        third_reminder_days: parseInt(e.target.value) || 0,
                      })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="reminder_frequency">
                    {t("admin.emailSettings.verificationReminders.reminderFrequency")}
                  </Label>
                  <Input
                    id="reminder_frequency"
                    type="number"
                    min="1"
                    value={config.reminder_frequency_days}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        reminder_frequency_days: parseInt(e.target.value) || 0,
                      })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="max_reminders">
                    {t("admin.emailSettings.verificationReminders.maxReminders")}
                  </Label>
                  <Input
                    id="max_reminders"
                    type="number"
                    min="1"
                    max="20"
                    value={config.max_reminders}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        max_reminders: parseInt(e.target.value) || 0,
                      })
                    }
                  />
                </div>
              </div>

              <Alert>
                <AlertDescription className="text-xs">
                  <strong>{t("admin.emailSettings.verificationReminders.howItWorks")}</strong>{" "}
                  {t("admin.emailSettings.verificationReminders.howItWorksDescription", {
                    first: config.first_reminder_days,
                    second: config.second_reminder_days,
                    third: config.third_reminder_days,
                    frequency: config.reminder_frequency_days,
                    max: config.max_reminders,
                  })}
                </AlertDescription>
              </Alert>
            </>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={fetchConfig} disabled={isSaving}>
            {t("admin.emailSettings.verificationReminders.reset")}
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {t("admin.emailSettings.verificationReminders.saving")}
              </>
            ) : (
              t("admin.emailSettings.verificationReminders.saveSettings")
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
