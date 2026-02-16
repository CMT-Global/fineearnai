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
        title: t("adminEmailSettings.verificationReminders.toasts.errorLoading"),
        description: t("adminEmailSettings.verificationReminders.toasts.errorLoadingDescription"),
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
        title: t("adminEmailSettings.verificationReminders.toasts.settingsSaved"),
        description: t("adminEmailSettings.verificationReminders.toasts.settingsSavedDescription"),
      });
    } catch (error: any) {
      console.error("Error saving reminder config:", error);
      toast({
        title: t("adminEmailSettings.verificationReminders.toasts.errorSaving"),
        description: t("adminEmailSettings.verificationReminders.toasts.errorSavingDescription"),
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
        title: t("adminEmailSettings.verificationReminders.toasts.remindersSent"),
        description: t("adminEmailSettings.verificationReminders.toasts.remindersSentDescription", {
          sent: data.sent,
          processed: data.processed,
        }),
      });
    } catch (error: any) {
      console.error("Error sending test reminders:", error);
      toast({
        title: t("adminEmailSettings.verificationReminders.toasts.errorSending"),
        description: error.message || t("adminEmailSettings.verificationReminders.toasts.errorSendingDescription"),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading && !config) {
    return (
      <Card className="min-w-0 overflow-hidden">
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="min-w-0 overflow-hidden">
      <CardHeader className="min-w-0 p-4 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between min-w-0">
          <div className="space-y-1 min-w-0">
            <CardTitle className="flex flex-wrap items-center gap-2 break-words text-lg sm:text-xl md:text-2xl">
              <Bell className="h-5 w-5 flex-shrink-0" />
              {t("adminEmailSettings.verificationReminders.title")}
            </CardTitle>
            <CardDescription className="break-words min-w-0">
              {t("adminEmailSettings.verificationReminders.description")}
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleTestReminders}
            disabled={isLoading || !config.enabled}
            className="flex-shrink-0 w-full sm:w-auto"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {t("adminEmailSettings.verificationReminders.sending")}
              </>
            ) : (
              <>
                <Mail className="h-4 w-4 mr-2" />
                {t("adminEmailSettings.verificationReminders.sendTestReminders")}
              </>
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6 p-4 sm:p-6 pt-0 min-w-0">
        <Alert className="min-w-0">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <AlertDescription className="break-words min-w-0">
            {t("adminEmailSettings.verificationReminders.alertDescription")}
          </AlertDescription>
        </Alert>

        <div className="space-y-4 min-w-0">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between min-w-0">
            <div className="space-y-0.5 min-w-0">
              <Label className="break-words">{t("adminEmailSettings.verificationReminders.enableReminders")}</Label>
              <p className="text-sm text-muted-foreground break-words min-w-0">
                {t("adminEmailSettings.verificationReminders.enableRemindersDescription")}
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
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 min-w-0">
                <div className="space-y-2 min-w-0">
                  <Label htmlFor="first_reminder" className="break-words">
                    <Clock className="h-4 w-4 inline mr-2 flex-shrink-0" />
                    {t("adminEmailSettings.verificationReminders.firstReminder")}
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
                    className="min-w-0 w-full max-w-full"
                  />
                </div>

                <div className="space-y-2 min-w-0">
                  <Label htmlFor="second_reminder" className="break-words">
                    {t("adminEmailSettings.verificationReminders.secondReminder")}
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

                <div className="space-y-2 min-w-0">
                  <Label htmlFor="third_reminder" className="break-words">
                    {t("adminEmailSettings.verificationReminders.thirdReminder")}
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
                    className="min-w-0 w-full max-w-full"
                  />
                </div>

                <div className="space-y-2 min-w-0">
                  <Label htmlFor="reminder_frequency" className="break-words">
                    {t("adminEmailSettings.verificationReminders.reminderFrequency")}
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
                    className="min-w-0 w-full max-w-full"
                  />
                </div>

                <div className="space-y-2 min-w-0">
                  <Label htmlFor="max_reminders" className="break-words">
                    {t("adminEmailSettings.verificationReminders.maxReminders")}
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
                    className="min-w-0 w-full max-w-full"
                  />
                </div>
              </div>

              <Alert className="min-w-0">
                <AlertDescription className="text-xs break-words min-w-0">
                  <strong>{t("adminEmailSettings.verificationReminders.howItWorks")}</strong>{" "}
                  {t("adminEmailSettings.verificationReminders.howItWorksDescription", {
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

        <div className="w-full flex flex-col-reverse sm:flex-row flex-wrap justify-end items-stretch sm:items-center gap-2 min-w-0 overflow-hidden">
          <Button
            variant="outline"
            onClick={fetchConfig}
            disabled={isSaving}
            className="w-full sm:w-auto min-w-0 max-w-full !whitespace-normal py-2 h-auto min-h-10 text-center overflow-hidden"
          >
            <span className="min-w-0 break-words text-inherit">{t("adminEmailSettings.verificationReminders.reset")}</span>
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="w-full sm:w-auto min-w-0 max-w-full !whitespace-normal py-2 h-auto min-h-10 text-center overflow-hidden"
          >
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 flex-shrink-0 animate-spin" />
                <span className="min-w-0 break-words text-inherit">{t("adminEmailSettings.verificationReminders.saving")}</span>
              </>
            ) : (
              <span className="min-w-0 break-words text-inherit">{t("adminEmailSettings.verificationReminders.saveSettings")}</span>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
