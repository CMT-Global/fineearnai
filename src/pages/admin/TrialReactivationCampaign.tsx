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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Mail, Send, Loader2, Clock, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { PageLoading } from "@/components/shared/PageLoading";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { format } from "date-fns";

const TEMPLATE_TYPES = ["trial_reactivation_1", "trial_reactivation_2", "trial_reactivation_3", "trial_reactivation_4", "trial_reactivation_5", "trial_reactivation_6", "trial_reactivation_7"] as const;
const SCHEDULE_DAYS = [0, 1, 3, 5, 7, 10, 14];
const LOGS_PAGE_SIZE = 15;

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
  send_time_utc: string;
  require_email_verified?: boolean;
}

interface EmailTemplateRow {
  id: string;
  template_type: string;
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

export default function TrialReactivationCampaign() {
  const { t } = useTranslation();
  useLanguageSync();
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdmin();
  const navigate = useNavigate();

  const [config, setConfig] = useState<CampaignConfig>({ enabled: false, send_time_utc: DEFAULT_SEND_TIME, require_email_verified: true });
  const [templates, setTemplates] = useState<Record<string, EmailTemplateRow>>({});
  const [edits, setEdits] = useState<Record<string, { subject: string; body: string }>>({});
  const [activeTab, setActiveTab] = useState("1");
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [logsPage, setLogsPage] = useState(1);
  const [totalLogsCount, setTotalLogsCount] = useState<number | null>(null);
  const [logsLoading, setLogsLoading] = useState(false);
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
        const [configRes, templatesRes] = await Promise.all([
          supabase.from("platform_config").select("value").eq("key", "trial_reactivation_campaign").maybeSingle(),
          supabase.from("email_templates").select("id, template_type, subject, body").in("template_type", [...TEMPLATE_TYPES]),
        ]);

        const cfg = (configRes.data?.value as CampaignConfig) || { enabled: false, send_time_utc: DEFAULT_SEND_TIME, require_email_verified: true };
        setConfig({
          enabled: !!cfg.enabled,
          send_time_utc: normalizeSendTimeUtc(cfg.send_time_utc || DEFAULT_SEND_TIME),
          require_email_verified: cfg.require_email_verified !== false,
        });

        const byType: Record<string, EmailTemplateRow> = {};
        for (const row of templatesRes.data || []) {
          const r = row as EmailTemplateRow;
          byType[r.template_type] = r;
          setEdits((prev) => ({ ...prev, [r.template_type]: { subject: r.subject, body: r.body } }));
        }
        setTemplates(byType);
      } catch (e) {
        console.error(e);
        toast.error(t("admin.trialReactivation.loadFailed"));
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
      const { count, error: countError } = await supabase
        .from("trial_reactivation_logs")
        .select("id", { count: "exact", head: true });
      if (countError) throw countError;
      setTotalLogsCount(count ?? 0);
      const { data, error } = await supabase
        .from("trial_reactivation_logs")
        .select("id, run_date, total_eligible, sent_count, failed_count, run_at")
        .order("run_date", { ascending: false })
        .range(from, to);
      if (error) throw error;
      setLogs((data as LogRow[]) || []);
    } catch (e) {
      console.error(e);
      toast.error(t("admin.trialReactivation.loadFailed"));
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
      const normalizedConfig = {
        ...config,
        send_time_utc: normalizeSendTimeUtc(config.send_time_utc),
      };
      const { error } = await supabase.from("platform_config").upsert(
        { key: "trial_reactivation_campaign", value: normalizedConfig, description: "Trial Expiry Reactivation (7-step)", updated_at: new Date().toISOString() },
        { onConflict: "key" }
      );
      if (error) throw error;
      toast.success(t("admin.trialReactivation.configSaved"));
    } catch (e: unknown) {
      toast.error((e as Error)?.message || t("admin.trialReactivation.saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  const handleSaveTemplate = async (templateType: string) => {
    const e = edits[templateType];
    const tpl = templates[templateType];
    if (!e || !tpl?.id) {
      toast.error(t("admin.trialReactivation.templateNotFound"));
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from("email_templates").update({ subject: e.subject, body: e.body, updated_at: new Date().toISOString() }).eq("id", tpl.id);
      if (error) throw error;
      setTemplates((prev) => ({ ...prev, [templateType]: { ...tpl, subject: e.subject, body: e.body } }));
      toast.success(t("admin.trialReactivation.templateSaved"));
    } catch (err: unknown) {
      toast.error((err as Error)?.message || t("admin.trialReactivation.saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  const handleTestSend = async () => {
    const step = parseInt(activeTab, 10) || 1;
    setSendingTest(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-trial-reactivation-test", { body: { step } });
      if (error) throw error;
      if (data?.success === false) throw new Error(data.error);
      toast.success(t("admin.trialReactivation.testSent"));
    } catch (e: unknown) {
      toast.error((e as Error)?.message || t("admin.trialReactivation.testSendFailed"));
    } finally {
      setSendingTest(false);
    }
  };

  const handleRunNow = async () => {
    setRunningNow(true);
    try {
      const { data, error } = await supabase.functions.invoke("process-trial-reactivation", { body: { force_run: true } });
      if (error) throw error;
      if (data?.run !== true) {
        throw new Error(data?.error || data?.reason || "unknown");
      }
      const count = data?.sent_count ?? 0;
      toast.success(t("admin.trialReactivation.runNowSuccess", { count }));
      setLogsPage(1);
      loadLogs(1);
    } catch (e: unknown) {
      toast.error((e as Error)?.message || t("admin.trialReactivation.runNowFailed"));
    } finally {
      setRunningNow(false);
    }
  };

  if (authLoading || adminLoading || loading) {
    return <PageLoading text={t("admin.trialReactivation.loading")} />;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <Button variant="ghost" onClick={() => navigate("/admin")} className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t("admin.trialReactivation.backToAdmin")}
        </Button>
        <h1 className="text-3xl font-bold">{t("admin.trialReactivation.title")}</h1>
        <p className="text-muted-foreground mt-1">{t("admin.trialReactivation.subtitle")}</p>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              {t("admin.trialReactivation.campaignSettings")}
            </CardTitle>
            <CardDescription>{t("admin.trialReactivation.campaignDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div>
                <Label className="text-base">{t("admin.trialReactivation.enableCampaign")}</Label>
                <p className="text-sm text-muted-foreground">{t("admin.trialReactivation.enableCampaignHelp")}</p>
              </div>
              <Switch checked={config.enabled} onCheckedChange={(v) => setConfig((c) => ({ ...c, enabled: v }))} />
            </div>
            <div className="space-y-2">
              <Label>{t("admin.trialReactivation.sendTimeUtc")}</Label>
              <Input
                type="time"
                value={config.send_time_utc}
                onChange={(e) => setConfig((c) => ({ ...c, send_time_utc: normalizeSendTimeUtc(e.target.value || DEFAULT_SEND_TIME) }))}
                step={60}
              />
              <p className="text-sm text-muted-foreground">{t("admin.trialReactivation.sendTimeHelp")}</p>
            </div>
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div>
                <Label className="text-base">{t("admin.trialReactivation.requireEmailVerified")}</Label>
                <p className="text-sm text-muted-foreground">{t("admin.trialReactivation.requireEmailVerifiedHelp")}</p>
              </div>
              <Switch
                checked={config.require_email_verified !== false}
                onCheckedChange={(v) => setConfig((c) => ({ ...c, require_email_verified: v }))}
              />
            </div>
            {config.enabled && (
              <Alert className="flex items-start gap-2">
                <Clock className="h-4 w-4 mt-0.5 shrink-0" />
                <AlertDescription>
                  {t("admin.trialReactivation.nextRun")} <strong>{formatUtc(getNextRunUtc(config.send_time_utc))}</strong>. {t("admin.trialReactivation.nextRunHelp")}
                </AlertDescription>
              </Alert>
            )}
            <div className="flex flex-wrap gap-2">
              <Button onClick={handleSaveConfig} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                {t("admin.trialReactivation.saveConfig")}
              </Button>
              {config.enabled && (
                <Button variant="outline" onClick={handleRunNow} disabled={runningNow} title={t("admin.trialReactivation.runNowHelp")}>
                  {runningNow ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                  {t("admin.trialReactivation.runNow")}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("admin.trialReactivation.emailTemplatesTitle")}</CardTitle>
            <CardDescription>{t("admin.trialReactivation.emailTemplatesDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <AlertDescription>{t("admin.trialReactivation.variablesHelp")}</AlertDescription>
            </Alert>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="flex flex-wrap h-auto gap-1">
                {TEMPLATE_TYPES.map((_, i) => (
                  <TabsTrigger key={i} value={String(i + 1)}>
                    {t("admin.trialReactivation.emailStep", { step: i + 1, day: SCHEDULE_DAYS[i] })}
                  </TabsTrigger>
                ))}
              </TabsList>
              {TEMPLATE_TYPES.map((templateType, i) => {
                const step = i + 1;
                const tpl = templates[templateType];
                const e = edits[templateType] ?? { subject: "", body: "" };
                return (
                  <TabsContent key={templateType} value={String(step)} className="space-y-4 pt-4">
                    <div className="space-y-2">
                      <Label>{t("admin.trialReactivation.subject")}</Label>
                      <Input
                        value={e.subject}
                        onChange={(ev) => setEdits((prev) => ({ ...prev, [templateType]: { ...(prev[templateType] ?? e), subject: ev.target.value } }))}
                        placeholder={t("admin.trialReactivation.subjectPlaceholder")}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>{t("admin.trialReactivation.body")}</Label>
                      <Textarea
                        value={e.body}
                        onChange={(ev) => setEdits((prev) => ({ ...prev, [templateType]: { ...(prev[templateType] ?? e), body: ev.target.value } }))}
                        rows={14}
                        className="font-mono text-sm resize-none min-h-[320px] h-[320px] overflow-y-auto"
                        placeholder={t("admin.trialReactivation.bodyPlaceholder")}
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={() => handleSaveTemplate(templateType)} disabled={saving || !tpl}>
                        {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                        {t("admin.trialReactivation.saveTemplate")}
                      </Button>
                      <Button variant="outline" onClick={handleTestSend} disabled={sendingTest}>
                        {sendingTest ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                        {t("admin.trialReactivation.testSend")}
                      </Button>
                    </div>
                  </TabsContent>
                );
              })}
            </Tabs>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("admin.trialReactivation.logsTitle")}</CardTitle>
            <CardDescription>{t("admin.trialReactivation.logsDescription")}</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("admin.trialReactivation.logRunDate")}</TableHead>
                  <TableHead>{t("admin.trialReactivation.logEligible")}</TableHead>
                  <TableHead>{t("admin.trialReactivation.logSent")}</TableHead>
                  <TableHead>{t("admin.trialReactivation.logFailed")}</TableHead>
                  <TableHead>{t("admin.trialReactivation.logRunAt")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logsLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      {t("admin.trialReactivation.loading")}
                    </TableCell>
                  </TableRow>
                ) : logs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      {t("admin.trialReactivation.noLogs")}
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
            {totalLogsCount !== null && totalLogsCount > 0 && (
              <div className="flex items-center justify-between mt-4">
                <p className="text-sm text-muted-foreground">
                  {t("admin.trialReactivation.logsPageOf", {
                    page: logsPage,
                    total: Math.ceil(totalLogsCount / LOGS_PAGE_SIZE),
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
                    {t("admin.trialReactivation.previous")}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setLogsPage((p) => p + 1)}
                    disabled={logsPage >= Math.ceil(totalLogsCount / LOGS_PAGE_SIZE) || logsLoading}
                  >
                    {t("admin.trialReactivation.next")}
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
