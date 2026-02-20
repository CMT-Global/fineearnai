import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useLanguageSync } from "@/hooks/useLanguageSync";
import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Mail, Send, Loader2, Clock } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import { PageLoading } from "@/components/shared/PageLoading";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { format } from "date-fns";

/** Format a Date in UTC for display (e.g. "Feb 21, 2026, 5:09 AM UTC") */
function formatUtc(date: Date): string {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth();
  const d = date.getUTCDate();
  const h = date.getUTCHours();
  const min = date.getUTCMinutes();
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  const minStr = min < 10 ? "0" + min : String(min);
  return `${monthNames[m]} ${d}, ${y}, ${h12}:${minStr} ${ampm} UTC`;
}

type RecipientType = "admins" | "all_users";

interface CampaignConfig {
  enabled: boolean;
  send_time_utc: string;
  recipient_type: RecipientType;
}

interface EmailTemplateRow {
  id: string;
  subject: string;
  body: string;
}

interface LogRow {
  id: string;
  run_date: string;
  total_eligible: number;
  sent_count: number;
  failed_count: number;
  run_at: string;
}

const DEFAULT_SEND_TIME = "06:00";

/** Normalize "H:mm" or "HH:mm" to "HH:mm" (24h UTC) for consistent storage and cron matching */
function normalizeSendTimeUtc(value: string): string {
  const trimmed = (value || "").trim();
  if (!trimmed) return DEFAULT_SEND_TIME;
  const [h = "0", m = "0"] = trimmed.split(":");
  const hour = Math.min(23, Math.max(0, parseInt(h, 10) || 0));
  const minute = Math.min(59, Math.max(0, parseInt(m, 10) || 0));
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function getNextRunUtc(sendTimeUtc: string): Date {
  const normalized = normalizeSendTimeUtc(sendTimeUtc);
  const [h = "0", m = "0"] = normalized.split(":");
  const hour = parseInt(h, 10) || 0;
  const minute = parseInt(m, 10) || 0;
  const now = new Date();
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), hour, minute, 0, 0));
  if (next.getTime() <= now.getTime()) {
    next.setUTCDate(next.getUTCDate() + 1);
  }
  return next;
}

export default function DailyTasksReminderCampaign() {
  const { t } = useTranslation();
  useLanguageSync();
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdmin();
  const navigate = useNavigate();

  const [config, setConfig] = useState<CampaignConfig>({ enabled: false, send_time_utc: DEFAULT_SEND_TIME, recipient_type: "all_users" });
  const [template, setTemplate] = useState<EmailTemplateRow | null>(null);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const [runningNow, setRunningNow] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) navigate("/login");
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!adminLoading && !isAdmin) {
      toast.error(t("toasts.admin.accessDenied"));
      navigate("/dashboard");
    }
  }, [isAdmin, adminLoading, navigate, t]);

  useEffect(() => {
    if (!isAdmin) return;

    const load = async () => {
      setLoading(true);
      try {
        const [configRes, templateRes, logsRes] = await Promise.all([
          supabase.from("platform_config").select("value").eq("key", "daily_tasks_reminder_campaign").maybeSingle(),
          supabase.from("email_templates").select("id, subject, body").eq("template_type", "daily_tasks_reminder").maybeSingle(),
          supabase.from("daily_tasks_reminder_logs").select("id, run_date, total_eligible, sent_count, failed_count, run_at").order("run_date", { ascending: false }).limit(50),
        ]);

        const cfg = (configRes.data?.value as CampaignConfig) || { enabled: false, send_time_utc: DEFAULT_SEND_TIME, recipient_type: "all_users" };
        setConfig({
          enabled: !!cfg.enabled,
          send_time_utc: normalizeSendTimeUtc(cfg.send_time_utc || DEFAULT_SEND_TIME),
          recipient_type: cfg.recipient_type === "admins" ? "admins" : "all_users",
        });

        if (templateRes.data) {
          setTemplate(templateRes.data as EmailTemplateRow);
          setSubject(templateRes.data.subject);
          setBody(templateRes.data.body);
        }
        setLogs((logsRes.data as LogRow[]) || []);
      } catch (e) {
        console.error(e);
        toast.error(t("admin.dailyTasksReminder.loadFailed"));
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [isAdmin, t]);

  const handleSaveConfig = async () => {
    setSaving(true);
    try {
      const normalizedConfig = {
        ...config,
        send_time_utc: normalizeSendTimeUtc(config.send_time_utc),
      };
      const { error } = await supabase.from("platform_config").upsert(
        { key: "daily_tasks_reminder_campaign", value: normalizedConfig, description: "Daily Tasks Reminder campaign", updated_at: new Date().toISOString() },
        { onConflict: "key" }
      );
      if (error) throw error;
      toast.success(t("admin.dailyTasksReminder.configSaved"));
    } catch (e: unknown) {
      toast.error((e as Error)?.message || t("admin.dailyTasksReminder.saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  const handleSaveTemplate = async () => {
    if (!template?.id) {
      toast.error(t("admin.dailyTasksReminder.templateNotFound"));
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from("email_templates").update({ subject, body, updated_at: new Date().toISOString() }).eq("id", template.id);
      if (error) throw error;
      toast.success(t("admin.dailyTasksReminder.templateSaved"));
    } catch (e: unknown) {
      toast.error((e as Error)?.message || t("admin.dailyTasksReminder.saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  const handleTestSend = async () => {
    setSendingTest(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-daily-tasks-reminder-test", { body: {} });
      if (error) throw error;
      if (data?.success === false) throw new Error(data.error);
      toast.success(t("admin.dailyTasksReminder.testSent"));
    } catch (e: unknown) {
      toast.error((e as Error)?.message || t("admin.dailyTasksReminder.testSendFailed"));
    } finally {
      setSendingTest(false);
    }
  };

  const handleRunNow = async () => {
    setRunningNow(true);
    try {
      const { data, error } = await supabase.functions.invoke("process-daily-tasks-reminder", { body: { force_run: true } });
      if (error) throw error;
      if (data?.run !== true) {
        const reason = data?.reason || "unknown";
        throw new Error(data?.error || reason);
      }
      const count = data?.sent_count ?? 0;
      toast.success(t("admin.dailyTasksReminder.runNowSuccess", { count }));
      // Refresh logs
      const { data: logsRes } = await supabase
        .from("daily_tasks_reminder_logs")
        .select("id, run_date, total_eligible, sent_count, failed_count, run_at")
        .order("run_date", { ascending: false })
        .limit(50);
      setLogs((logsRes as LogRow[]) || []);
    } catch (e: unknown) {
      toast.error((e as Error)?.message || t("admin.dailyTasksReminder.runNowFailed"));
    } finally {
      setRunningNow(false);
    }
  };

  if (authLoading || adminLoading || loading) {
    return <PageLoading text={t("admin.dailyTasksReminder.loading")} />;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <Button variant="ghost" onClick={() => navigate("/admin")} className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t("admin.dailyTasksReminder.backToAdmin")}
        </Button>
        <h1 className="text-3xl font-bold">{t("admin.dailyTasksReminder.title")}</h1>
        <p className="text-muted-foreground mt-1">{t("admin.dailyTasksReminder.subtitle")}</p>
      </div>

      <div className="space-y-6">
        {/* Campaign controls */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              {t("admin.dailyTasksReminder.campaignSettings")}
            </CardTitle>
            <CardDescription>{t("admin.dailyTasksReminder.campaignDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div>
                <Label className="text-base">{t("admin.dailyTasksReminder.enableCampaign")}</Label>
                <p className="text-sm text-muted-foreground">{t("admin.dailyTasksReminder.enableCampaignHelp")}</p>
              </div>
              <Switch checked={config.enabled} onCheckedChange={(v) => setConfig((c) => ({ ...c, enabled: v }))} />
            </div>
            <div className="space-y-2">
              <Label>{t("admin.dailyTasksReminder.sendTimeUtc")}</Label>
              <Input
                type="time"
                value={config.send_time_utc}
                onChange={(e) => setConfig((c) => ({ ...c, send_time_utc: normalizeSendTimeUtc(e.target.value || DEFAULT_SEND_TIME) }))}
                step={60}
              />
              <p className="text-sm text-muted-foreground">{t("admin.dailyTasksReminder.sendTimeHelp")}</p>
            </div>
            <div className="space-y-2">
              <Label>{t("admin.dailyTasksReminder.whoGetsIt")}</Label>
              <RadioGroup
                value={config.recipient_type}
                onValueChange={(v) => setConfig((c) => ({ ...c, recipient_type: v as RecipientType }))}
                className="flex flex-col gap-3"
              >
                <div className="flex items-start space-x-3 rounded-lg border p-4">
                  <RadioGroupItem value="admins" id="recipient-admins" />
                  <div className="grid gap-1">
                    <Label htmlFor="recipient-admins" className="font-normal cursor-pointer">
                      {t("admin.dailyTasksReminder.recipientAdmins")}
                    </Label>
                    <p className="text-sm text-muted-foreground">{t("admin.dailyTasksReminder.recipientAdminsHelp")}</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3 rounded-lg border p-4">
                  <RadioGroupItem value="all_users" id="recipient-all-users" />
                  <div className="grid gap-1">
                    <Label htmlFor="recipient-all-users" className="font-normal cursor-pointer">
                      {t("admin.dailyTasksReminder.recipientAllUsers")}
                    </Label>
                    <p className="text-sm text-muted-foreground">{t("admin.dailyTasksReminder.recipientAllUsersHelp")}</p>
                  </div>
                </div>
              </RadioGroup>
            </div>
            {config.enabled && (
              <Alert className="flex items-start gap-2">
                <Clock className="h-4 w-4 mt-0.5 shrink-0" />
                <AlertDescription>
                  {t("admin.dailyTasksReminder.nextRun")}{" "}
                  <strong>{formatUtc(getNextRunUtc(config.send_time_utc))}</strong>.{" "}
                  {t("admin.dailyTasksReminder.nextRunHelp")}
                </AlertDescription>
              </Alert>
            )}
            <div className="flex flex-wrap gap-2">
              <Button onClick={handleSaveConfig} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                {t("admin.dailyTasksReminder.saveConfig")}
              </Button>
              {config.enabled && (
                <Button variant="outline" onClick={handleRunNow} disabled={runningNow} title={t("admin.dailyTasksReminder.runNowHelp")}>
                  {runningNow ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                  {t("admin.dailyTasksReminder.runNow")}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Email template */}
        <Card>
          <CardHeader>
            <CardTitle>{t("admin.dailyTasksReminder.emailTemplate")}</CardTitle>
            <CardDescription>{t("admin.dailyTasksReminder.emailTemplateDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <AlertDescription>{t("admin.dailyTasksReminder.variablesHelp")}</AlertDescription>
            </Alert>
            <div className="space-y-2">
              <Label>{t("admin.dailyTasksReminder.subject")}</Label>
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder={t("admin.dailyTasksReminder.subjectPlaceholder")} />
            </div>
            <div className="space-y-2">
              <Label>{t("admin.dailyTasksReminder.body")}</Label>
              <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={12} className="font-mono text-sm" placeholder={t("admin.dailyTasksReminder.bodyPlaceholder")} />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSaveTemplate} disabled={saving || !template}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                {t("admin.dailyTasksReminder.saveTemplate")}
              </Button>
              <Button variant="outline" onClick={handleTestSend} disabled={sendingTest}>
                {sendingTest ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                {t("admin.dailyTasksReminder.testSend")}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Logs */}
        <Card>
          <CardHeader>
            <CardTitle>{t("admin.dailyTasksReminder.logsTitle")}</CardTitle>
            <CardDescription>{t("admin.dailyTasksReminder.logsDescription")}</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("admin.dailyTasksReminder.logRunDate")}</TableHead>
                  <TableHead>{t("admin.dailyTasksReminder.logEligible")}</TableHead>
                  <TableHead>{t("admin.dailyTasksReminder.logSent")}</TableHead>
                  <TableHead>{t("admin.dailyTasksReminder.logFailed")}</TableHead>
                  <TableHead>{t("admin.dailyTasksReminder.logRunAt")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      {t("admin.dailyTasksReminder.noLogs")}
                    </TableCell>
                  </TableRow>
                ) : (
                  logs.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>{row.run_date}</TableCell>
                      <TableCell>{row.total_eligible}</TableCell>
                      <TableCell>{row.sent_count}</TableCell>
                      <TableCell>{row.failed_count}</TableCell>
                      <TableCell>{row.run_at ? format(new Date(row.run_at), "PPp") : "—"}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
