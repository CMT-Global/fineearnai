import { useState, useEffect } from "react";
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
        .single();

      if (error) throw error;

      if (data?.value) {
        setConfig(data.value as unknown as ReminderConfig);
      }
    } catch (error: any) {
      console.error("Error fetching reminder config:", error);
      toast({
        title: "Error",
        description: "Failed to load reminder settings",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("platform_config")
        .update({
          value: config as any,
          updated_at: new Date().toISOString(),
        })
        .eq("key", "email_verification_reminders");

      if (error) throw error;

      toast({
        title: "✅ Settings Saved",
        description: "Email verification reminder settings updated successfully",
      });
    } catch (error: any) {
      console.error("Error saving reminder config:", error);
      toast({
        title: "Error",
        description: "Failed to save reminder settings",
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
        title: "✅ Reminders Sent",
        description: `Successfully sent ${data.sent} reminder emails to ${data.processed} unverified users`,
      });
    } catch (error: any) {
      console.error("Error sending test reminders:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to send test reminders",
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
              Email Verification Reminders
            </CardTitle>
            <CardDescription>
              Configure automated reminders for users who haven't verified their email addresses
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
                Sending...
              </>
            ) : (
              <>
                <Mail className="h-4 w-4 mr-2" />
                Send Test Reminders Now
              </>
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            These settings control the automated email verification reminder system. 
            Reminders are sent via the scheduled edge function that runs daily.
          </AlertDescription>
        </Alert>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Enable Reminders</Label>
              <p className="text-sm text-muted-foreground">
                Automatically send verification reminders to unverified users
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
                    First Reminder (days after signup)
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
                    Second Reminder (days after signup)
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
                    Third Reminder (days after signup)
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
                    Reminder Frequency (days between reminders)
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
                    Maximum Reminders per User
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
                  <strong>How it works:</strong> First reminder sent after{" "}
                  {config.first_reminder_days} days. Second reminder at{" "}
                  {config.second_reminder_days} days. Third at{" "}
                  {config.third_reminder_days} days. After that, reminders every{" "}
                  {config.reminder_frequency_days} days until max{" "}
                  {config.max_reminders} reminders reached.
                </AlertDescription>
              </Alert>
            </>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={fetchConfig} disabled={isSaving}>
            Reset
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              "Save Settings"
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
