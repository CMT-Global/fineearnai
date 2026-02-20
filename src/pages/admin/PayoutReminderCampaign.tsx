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
import { ArrowLeft, Mail, Send, Loader2, Clock, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { PageLoading } from "@/components/shared/PageLoading";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { format } from "date-fns";

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

interface CampaignConfig {
  enabled: boolean;
  reminder_hours: number[];
  send_time_utc: string;
}

interface EmailTemplateRow {
  id: string;
  subject: string;
  body: string;
  template_type: string;
}

interface LogRow {
  id: string;
  payout_date: string;
  hours_before: number;
  total_eligible: number;
  sent_count: number;
  failed_count: number;
  run_at: string;
}

const DEFAULT_SEND_TIME = "06:00";
const LOGS_PAGE_SIZE = 15;

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

export default function PayoutReminderCampaign() {
  const { t } = useTranslation();
  useLanguageSync();
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdmin();
  const navigate = useNavigate();

  const [config, setConfig] = useState<CampaignConfig>({
    enabled: false,
    reminder_hours: [48, 24],
    send_time_utc: DEFAULT_SEND_TIME,
  });
  const [hoursFirst, setHoursFirst] = useState("48");
  const [hoursSecond, setHoursSecond] = useState("24");
  const [template48, setTemplate48] = useState<EmailTemplateRow | null>(null);
  const [template24, setTemplate24] = useState<EmailTemplateRow | null>(null);
  const [subject48, setSubject48] = useState("");
  const [body48, setBody48] = useState("");
  const [subject24, setSubject24] = useState("");
  const [body24, setBody24] = useState("");
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [logsPage, setLogsPage] = useState(1);
  const [totalLogsCount, setTotalLogsCount] = useState<number | null>(null);
  const [logsLoading, setLogsLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sendingTest, setSendingTest] = useState<string | null>(null);
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
        const [configRes, t48Res, t24Res] = await Promise.all([
          supabase.from("platform_config").select("value").eq("key", "payout_reminder_campaign").maybeSingle(),
          supabase.from("email_templates").select("id, subject, body, template_type").eq("template_type", "payout_reminder_48h").maybeSingle(),
          supabase.from("email_templates").select("id, subject, body, template_type").eq("template_type", "payout_reminder_24h").maybeSingle(),
        ]);

        const cfg = (configRes.data?.value as unknown as CampaignConfig) || {
          enabled: false,
          reminder_hours: [48, 24],
          send_time_utc: DEFAULT_SEND_TIME,
        };
        const hours = Array.isArray(cfg.reminder_hours) ? cfg.reminder_hours : [48, 24];
        setConfig({
          enabled: !!cfg.enabled,
          reminder_hours: hours,
          send_time_utc: normalizeSendTimeUtc(cfg.send_time_utc || DEFAULT_SEND_TIME),
        });
        setHoursFirst(String(hours[0] ?? 48));
        setHoursSecond(String(hours[1] ?? 24));

        if (t48Res.data) {
          setTemplate48(t48Res.data as EmailTemplateRow);
          setSubject48(t48Res.data.subject);
          setBody48(t48Res.data.body);
        }
        if (t24Res.data) {
          setTemplate24(t24Res.data as EmailTemplateRow);
          setSubject24(t24Res.data.subject);
          setBody24(t24Res.data.body);
        }
      } catch (e) {
        console.error(e);
        toast.error(t("admin.payoutReminder.loadFailed"));
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [isAdmin, t]);

  const loadLogs = async (page: number) => {
    if (!isAdmin) return;
    setLogsLoading(true);
    try {
      const from = (page - 1) * LOGS_PAGE_SIZE;
      const to = from + LOGS_PAGE_SIZE - 1;
      const { count, error: countError } = await (supabase as any)
        .from("payout_reminder_logs")
        .select("id", { count: "exact", head: true });
      if (countError) throw countError;
      setTotalLogsCount(count ?? 0);
      const { data, error } = await (supabase as any)
        .from("payout_reminder_logs")
        .select("id, payout_date, hours_before, total_eligible, sent_count, failed_count, run_at")
        .order("payout_date", { ascending: false })
        .order("hours_before", { ascending: false })
        .range(from, to);
      if (error) throw error;
      setLogs((data as LogRow[]) || []);
    } catch (e) {
      console.error(e);
      toast.error(t("admin.payoutReminder.loadFailed"));
    } finally {
      setLogsLoading(false);
    }
  };

  useEffect(() => {
    if (!isAdmin) return;
    loadLogs(logsPage);
  }, [isAdmin, logsPage]);

  const handleSaveConfig = async () => {
    setSaving(true);
    try {
      const h1 = Math.min(168, Math.max(1, parseInt(hoursFirst, 10) || 48));
      const h2 = Math.min(168, Math.max(1, parseInt(hoursSecond, 10) || 24));
      const reminder_hours = [h1, h2];
      const normalizedConfig = {
        ...config,
        reminder_hours,
        send_time_utc: normalizeSendTimeUtc(config.send_time_utc),
      };
      const { error } = await supabase.from("platform_config").upsert(
        { key: "payout_reminder_campaign", value: normalizedConfig, description: "Payout day reminder campaign", updated_at: new Date().toISOString() },
        { onConflict: "key" }
      );
      if (error) throw error;
      setConfig((c) => ({ ...c, reminder_hours }));
      setHoursFirst(String(h1));
      setHoursSecond(String(h2));
      toast.success(t("admin.payoutReminder.configSaved"));
    } catch (e: unknown) {
      toast.error((e as Error)?.message || t("admin.payoutReminder.saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  const handleSaveTemplate48 = async () => {
    if (!template48?.id) {
      toast.error(t("admin.payoutReminder.templateNotFound"));
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from("email_templates").update({ subject: subject48, body: body48, updated_at: new Date().toISOString() }).eq("id", template48.id);
      if (error) throw error;
      toast.success(t("admin.payoutReminder.templateSaved"));
    } catch (e: unknown) {
      toast.error((e as Error)?.message || t("admin.payoutReminder.saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  const handleSaveTemplate24 = async () => {
    if (!template24?.id) {
      toast.error(t("admin.payoutReminder.templateNotFound"));
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from("email_templates").update({ subject: subject24, body: body24, updated_at: new Date().toISOString() }).eq("id", template24.id);
      if (error) throw error;
      toast.success(t("admin.payoutReminder.templateSaved"));
    } catch (e: unknown) {
      toast.error((e as Error)?.message || t("admin.payoutReminder.saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  const handleTestSend = async (template: "48h" | "24h") => {
    setSendingTest(template);
    try {
      const { data, error } = await supabase.functions.invoke("send-payout-reminder-test", { body: { template } });
      if (error) throw error;
      if (data?.success === false) throw new Error(data.error);
      toast.success(t("admin.payoutReminder.testSent"));
    } catch (e: unknown) {
      toast.error((e as Error)?.message || t("admin.payoutReminder.testSendFailed"));
    } finally {
      setSendingTest(null);
    }
  };

  const handleRunNow = async () => {
    setRunningNow(true);
    try {
      const { data, error } = await supabase.functions.invoke("process-payout-reminder", { body: { force_run: true } });
      if (error) throw error;
      if (data?.run !== true) {
        throw new Error(data?.error || data?.reason || "unknown");
      }
      const count = data?.sent_count ?? 0;
      toast.success(t("admin.payoutReminder.runNowSuccess", { count }));
      setLogsPage(1);
      loadLogs(1);
    } catch (e: unknown) {
      toast.error((e as Error)?.message || t("admin.payoutReminder.runNowFailed"));
    } finally {
      setRunningNow(false);
    }
  };

  if (authLoading || adminLoading || loading) {
    return <PageLoading text={t("admin.payoutReminder.loading")} />;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <Button variant="ghost" onClick={() => navigate("/admin")} className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t("admin.payoutReminder.backToAdmin")}
        </Button>
        <h1 className="text-3xl font-bold">{t("admin.payoutReminder.title")}</h1>
        <p className="text-muted-foreground mt-1">{t("admin.payoutReminder.subtitle")}</p>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              {t("admin.payoutReminder.campaignSettings")}
            </CardTitle>
            <CardDescription>{t("admin.payoutReminder.campaignDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div>
                <Label className="text-base">{t("admin.payoutReminder.enableCampaign")}</Label>
                <p className="text-sm text-muted-foreground">{t("admin.payoutReminder.enableCampaignHelp")}</p>
              </div>
              <Switch checked={config.enabled} onCheckedChange={(v) => setConfig((c) => ({ ...c, enabled: v }))} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t("admin.payoutReminder.firstReminderHours")}</Label>
                <Input
                  type="number"
                  min={1}
                  max={168}
                  value={hoursFirst}
                  onChange={(e) => setHoursFirst(e.target.value)}
                />
                <p className="text-sm text-muted-foreground">{t("admin.payoutReminder.hoursHelp")}</p>
              </div>
              <div className="space-y-2">
                <Label>{t("admin.payoutReminder.secondReminderHours")}</Label>
                <Input
                  type="number"
                  min={1}
                  max={168}
                  value={hoursSecond}
                  onChange={(e) => setHoursSecond(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t("admin.payoutReminder.sendTimeUtc")}</Label>
              <Input
                type="time"
                value={config.send_time_utc}
                onChange={(e) => setConfig((c) => ({ ...c, send_time_utc: normalizeSendTimeUtc(e.target.value || DEFAULT_SEND_TIME) }))}
                step={60}
              />
              <p className="text-sm text-muted-foreground">{t("admin.payoutReminder.sendTimeHelp")}</p>
            </div>
            {config.enabled && (
              <Alert className="flex items-start gap-2">
                <Clock className="h-4 w-4 mt-0.5 shrink-0" />
                <AlertDescription>
                  {t("admin.payoutReminder.nextRun")}{" "}
                  <strong>{formatUtc(getNextRunUtc(config.send_time_utc))}</strong>.{" "}
                  {t("admin.payoutReminder.nextRunHelp")}
                </AlertDescription>
              </Alert>
            )}
            <div className="flex flex-wrap gap-2">
              <Button onClick={handleSaveConfig} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                {t("admin.payoutReminder.saveConfig")}
              </Button>
              {config.enabled && (
                <Button variant="outline" onClick={handleRunNow} disabled={runningNow} title={t("admin.payoutReminder.runNowHelp")}>
                  {runningNow ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                  {t("admin.payoutReminder.runNow")}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("admin.payoutReminder.template48h")}</CardTitle>
            <CardDescription>{t("admin.payoutReminder.template48hDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <AlertDescription>{t("admin.payoutReminder.variablesHelp")}</AlertDescription>
            </Alert>
            <div className="space-y-2">
              <Label>{t("admin.payoutReminder.subject")}</Label>
              <Input value={subject48} onChange={(e) => setSubject48(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>{t("admin.payoutReminder.body")}</Label>
              <Textarea value={body48} onChange={(e) => setBody48(e.target.value)} rows={10} className="font-mono text-sm resize-none min-h-[320px] h-[320px] overflow-y-auto" />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSaveTemplate48} disabled={saving || !template48}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                {t("admin.payoutReminder.saveTemplate")}
              </Button>
              <Button variant="outline" onClick={() => handleTestSend("48h")} disabled={!!sendingTest}>
                {sendingTest === "48h" ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                {t("admin.payoutReminder.testSend")} (48h)
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("admin.payoutReminder.template24h")}</CardTitle>
            <CardDescription>{t("admin.payoutReminder.template24hDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>{t("admin.payoutReminder.subject")}</Label>
              <Input value={subject24} onChange={(e) => setSubject24(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>{t("admin.payoutReminder.body")}</Label>
              <Textarea value={body24} onChange={(e) => setBody24(e.target.value)} rows={10} className="font-mono text-sm resize-none min-h-[320px] h-[320px] overflow-y-auto" />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSaveTemplate24} disabled={saving || !template24}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                {t("admin.payoutReminder.saveTemplate")}
              </Button>
              <Button variant="outline" onClick={() => handleTestSend("24h")} disabled={!!sendingTest}>
                {sendingTest === "24h" ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                {t("admin.payoutReminder.testSend")} (24h)
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("admin.payoutReminder.logsTitle")}</CardTitle>
            <CardDescription>{t("admin.payoutReminder.logsDescription")}</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("admin.payoutReminder.logPayoutDate")}</TableHead>
                  <TableHead>{t("admin.payoutReminder.logHoursBefore")}</TableHead>
                  <TableHead>{t("admin.payoutReminder.logEligible")}</TableHead>
                  <TableHead>{t("admin.payoutReminder.logSent")}</TableHead>
                  <TableHead>{t("admin.payoutReminder.logFailed")}</TableHead>
                  <TableHead>{t("admin.payoutReminder.logRunAt")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logsLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      {t("admin.payoutReminder.loading")}
                    </TableCell>
                  </TableRow>
                ) : logs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      {t("admin.payoutReminder.noLogs")}
                    </TableCell>
                  </TableRow>
                ) : (
                  logs.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>{row.payout_date}</TableCell>
                      <TableCell>{row.hours_before}h</TableCell>
                      <TableCell>{row.total_eligible}</TableCell>
                      <TableCell>{row.sent_count}</TableCell>
                      <TableCell>{row.failed_count}</TableCell>
                      <TableCell>{row.run_at ? format(new Date(row.run_at), "PPp") : "—"}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            {totalLogsCount !== null && totalLogsCount > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-4 mt-4">
                <p className="text-sm text-muted-foreground">
                  {t("admin.payoutReminder.logsPageOf", {
                    page: logsPage,
                    total: Math.max(1, Math.ceil(totalLogsCount / LOGS_PAGE_SIZE)),
                    count: totalLogsCount,
                  })}
                  {" · "}
                  {t("admin.payoutReminder.logsShowing", {
                    from: (logsPage - 1) * LOGS_PAGE_SIZE + 1,
                    to: Math.min(logsPage * LOGS_PAGE_SIZE, totalLogsCount),
                    count: totalLogsCount,
                  })}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setLogsPage((p) => Math.max(1, p - 1))}
                    disabled={logsPage <= 1 || logsLoading}
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    {t("admin.payoutReminder.previous")}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setLogsPage((p) => p + 1)}
                    disabled={logsPage >= Math.ceil(totalLogsCount / LOGS_PAGE_SIZE) || logsLoading}
                  >
                    {t("admin.payoutReminder.next")}
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
