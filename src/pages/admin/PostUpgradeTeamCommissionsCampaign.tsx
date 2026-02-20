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
import { ArrowLeft, Mail, Send, Loader2, Clock, ChevronLeft, ChevronRight, Users } from "lucide-react";
import { toast } from "sonner";
import { PageLoading } from "@/components/shared/PageLoading";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { format } from "date-fns";

const CONFIG_KEY = "post_upgrade_team_commissions_campaign";
const TEMPLATE_TYPES = [
  "post_upgrade_team_1",
  "post_upgrade_team_2",
  "post_upgrade_team_3",
  "post_upgrade_team_4",
  "post_upgrade_team_5",
  "post_upgrade_team_6",
] as const;
const DEFAULT_DAY_OFFSETS = [0, 2, 5, 8, 12, 15];
const STEP_NAMES = [
  "Unlock Task Commissions",
  "4 simple rules",
  "Real example (numbers)",
  "Copy & paste invite scripts",
  "Build your team early",
  "Weekly routine + guide",
];
const LOGS_PAGE_SIZE = 15;
const DEFAULT_SEND_TIME = "09:00";

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

/** Today's date in UTC (YYYY-MM-DD) - matches run_date stored by the cron */
function getTodayUtcDateString(): string {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  const d = String(now.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

interface StepConfig {
  step_index: number;
  day_offset: number;
  template_type: string;
  is_active: boolean;
}

interface CampaignConfig {
  enabled: boolean;
  send_time_utc: string;
  require_email_verified?: boolean;
  steps?: StepConfig[];
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

export default function PostUpgradeTeamCommissionsCampaign() {
  const { t } = useTranslation();
  useLanguageSync();
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdmin();
  const navigate = useNavigate();

  const [config, setConfig] = useState<CampaignConfig>({
    enabled: false,
    send_time_utc: DEFAULT_SEND_TIME,
    require_email_verified: true,
    steps: TEMPLATE_TYPES.map((template_type, i) => ({
      step_index: i + 1,
      day_offset: DEFAULT_DAY_OFFSETS[i] ?? 0,
      template_type,
      is_active: true,
    })),
  });
  const [templates, setTemplates] = useState<Record<string, EmailTemplateRow>>({});
  const [edits, setEdits] = useState<Record<string, { subject: string; body: string }>>({});
  const [dayOffsets, setDayOffsets] = useState<Record<number, number>>({});
  const [stepActive, setStepActive] = useState<Record<number, boolean>>({});
  const [activeTab, setActiveTab] = useState("1");
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [logsPage, setLogsPage] = useState(1);
  const [totalLogsCount, setTotalLogsCount] = useState<number | null>(null);
  const [enrolledCount, setEnrolledCount] = useState<number | null>(null);
  const [todaySent, setTodaySent] = useState<number | null>(null);
  const [todayFailed, setTodayFailed] = useState<number | null>(null);
  const [logsLoading, setLogsLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const [runningNow, setRunningNow] = useState(false);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);

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
        const [configRes, templatesRes, enrolledRes, todayLogsRes] = await Promise.all([
          supabase.from("platform_config").select("value").eq("key", CONFIG_KEY).maybeSingle(),
          supabase.from("email_templates").select("id, template_type, subject, body").in("template_type", [...TEMPLATE_TYPES]),
          supabase.from("post_upgrade_team_commissions_enrollment").select("user_id", { count: "exact", head: true }),
          supabase
            .from("post_upgrade_team_commissions_logs")
            .select("sent_count, failed_count")
            .eq("run_date", getTodayUtcDateString())
            .order("run_at", { ascending: false })
            .limit(10),
        ]);

        const cfg = (configRes.data?.value as CampaignConfig) || {};
        const steps = Array.isArray(cfg.steps) && cfg.steps.length > 0
          ? cfg.steps
          : TEMPLATE_TYPES.map((template_type, i) => ({
              step_index: i + 1,
              day_offset: DEFAULT_DAY_OFFSETS[i] ?? 0,
              template_type,
              is_active: true,
            }));
        setConfig({
          enabled: !!cfg.enabled,
          send_time_utc: normalizeSendTimeUtc(cfg.send_time_utc || DEFAULT_SEND_TIME),
          require_email_verified: cfg.require_email_verified !== false,
          steps,
        });
        const offsets: Record<number, number> = {};
        const active: Record<number, boolean> = {};
        steps.forEach((s) => {
          offsets[s.step_index] = s.day_offset ?? 0;
          active[s.step_index] = s.is_active !== false;
        });
        setDayOffsets(offsets);
        setStepActive(active);

        const byType: Record<string, EmailTemplateRow> = {};
        for (const row of templatesRes.data || []) {
          const r = row as EmailTemplateRow;
          byType[r.template_type] = r;
          setEdits((prev) => ({ ...prev, [r.template_type]: { subject: r.subject, body: r.body } }));
        }
        setTemplates(byType);

        setEnrolledCount(enrolledRes.count ?? 0);
        const todayRows = todayLogsRes.data || [];
        let sent = 0;
        let failed = 0;
        todayRows.forEach((r: { sent_count?: number; failed_count?: number }) => {
          sent += r.sent_count ?? 0;
          failed += r.failed_count ?? 0;
        });
        setTodaySent(sent);
        setTodayFailed(failed);
      } catch (e) {
        console.error(e);
        toast.error(t("admin.postUpgradeTeamCommissions.loadFailed"));
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
        .from("post_upgrade_team_commissions_logs")
        .select("id", { count: "exact", head: true });
      if (countError) throw countError;
      setTotalLogsCount(count ?? 0);
      const { data, error } = await supabase
        .from("post_upgrade_team_commissions_logs")
        .select("id, run_date, total_eligible, sent_count, failed_count, run_at")
        .order("run_date", { ascending: false })
        .order("run_at", { ascending: false })
        .range(from, to);
      if (error) throw error;
      setLogs((data as LogRow[]) || []);
    } catch (e) {
      console.error(e);
      toast.error(t("admin.postUpgradeTeamCommissions.loadFailed"));
    } finally {
      setLogsLoading(false);
    }
  };

  useEffect(() => {
    if (!isAdmin) return;
    loadLogs(logsPage);
  }, [isAdmin, logsPage]);

  useEffect(() => {
    setPreviewHtml(null);
  }, [activeTab]);

  const getStepsForSave = (): StepConfig[] =>
    TEMPLATE_TYPES.map((template_type, i) => ({
      step_index: i + 1,
      day_offset: dayOffsets[i + 1] ?? DEFAULT_DAY_OFFSETS[i] ?? 0,
      template_type,
      is_active: stepActive[i + 1] !== false,
    }));

  const handleSaveConfig = async () => {
    setSaving(true);
    try {
      const steps = getStepsForSave();
      const normalizedConfig = {
        enabled: config.enabled,
        send_time_utc: normalizeSendTimeUtc(config.send_time_utc),
        require_email_verified: config.require_email_verified !== false,
        steps,
      };
      const { error } = await supabase.from("platform_config").upsert(
        { key: CONFIG_KEY, value: normalizedConfig, description: "Post-Upgrade Team Commissions (6-step)", updated_at: new Date().toISOString() },
        { onConflict: "key" }
      );
      if (error) throw error;
      setConfig((c) => ({ ...c, steps }));
      toast.success(t("admin.postUpgradeTeamCommissions.configSaved"));
    } catch (e: unknown) {
      toast.error((e as Error)?.message || t("admin.postUpgradeTeamCommissions.saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  const handleSaveTemplate = async (templateType: string) => {
    const e = edits[templateType];
    const tpl = templates[templateType];
    if (!e || !tpl?.id) {
      toast.error(t("admin.postUpgradeTeamCommissions.templateNotFound"));
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from("email_templates")
        .update({ subject: e.subject, body: e.body, updated_at: new Date().toISOString() })
        .eq("id", tpl.id);
      if (error) throw error;
      setTemplates((prev) => ({ ...prev, [templateType]: { ...tpl, subject: e.subject, body: e.body } }));
      toast.success(t("admin.postUpgradeTeamCommissions.templateSaved"));
    } catch (err: unknown) {
      toast.error((err as Error)?.message || t("admin.postUpgradeTeamCommissions.saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  const handleTestSend = async () => {
    const step = parseInt(activeTab, 10) || 1;
    setSendingTest(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-post-upgrade-team-commissions-test", { body: { step } });
      if (error) throw error;
      if (data?.success === false) throw new Error(data.error);
      toast.success(t("admin.postUpgradeTeamCommissions.testSent"));
    } catch (e: unknown) {
      toast.error((e as Error)?.message || t("admin.postUpgradeTeamCommissions.testSendFailed"));
    } finally {
      setSendingTest(false);
    }
  };

  const handleRunNow = async () => {
    setRunningNow(true);
    try {
      const { data, error } = await supabase.functions.invoke("process-post-upgrade-team-commissions", { body: { force_run: true } });
      if (error) throw error;
      if (data?.run !== true) {
        throw new Error(data?.error || data?.reason || "unknown");
      }
      const count = data?.sent_count ?? 0;
      toast.success(t("admin.postUpgradeTeamCommissions.runNowSuccess", { count }));
      setLogsPage(1);
      loadLogs(1);
      const todayUtc = getTodayUtcDateString();
      const { data: todayRows } = await supabase
        .from("post_upgrade_team_commissions_logs")
        .select("sent_count, failed_count")
        .eq("run_date", todayUtc);
      let s = 0, f = 0;
      (todayRows || []).forEach((r: { sent_count?: number; failed_count?: number }) => {
        s += r.sent_count ?? 0;
        f += r.failed_count ?? 0;
      });
      setTodaySent(s);
      setTodayFailed(f);
    } catch (e: unknown) {
      toast.error((e as Error)?.message || t("admin.postUpgradeTeamCommissions.runNowFailed"));
    } finally {
      setRunningNow(false);
    }
  };

  const handlePreview = () => {
    const step = parseInt(activeTab, 10) || 1;
    const templateType = TEMPLATE_TYPES[step - 1];
    const e = edits[templateType] ?? { subject: "", body: "" };
    const sample = {
      first_name: "there",
      team_invite_url: "https://example.com/signup?ref=SAMPLE",
      team_guide_url: "https://example.com/how-it-works",
    };
    let html = e.body;
    Object.entries(sample).forEach(([k, v]) => {
      html = html.replace(new RegExp(`{{\\s*${k}\\s*}}`, "gi"), v);
    });
    setPreviewHtml(html);
  };

  if (authLoading || adminLoading || loading) {
    return <PageLoading text={t("admin.postUpgradeTeamCommissions.loading")} />;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <Button variant="ghost" onClick={() => navigate("/admin")} className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t("admin.postUpgradeTeamCommissions.backToAdmin")}
        </Button>
        <h1 className="text-3xl font-bold">{t("admin.postUpgradeTeamCommissions.title")}</h1>
        <p className="text-muted-foreground mt-1">{t("admin.postUpgradeTeamCommissions.subtitle")}</p>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              {t("admin.postUpgradeTeamCommissions.campaignSettings")}
            </CardTitle>
            <CardDescription>{t("admin.postUpgradeTeamCommissions.campaignDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div>
                <Label className="text-base">{t("admin.postUpgradeTeamCommissions.enableCampaign")}</Label>
                <p className="text-sm text-muted-foreground">{t("admin.postUpgradeTeamCommissions.enableCampaignHelp")}</p>
              </div>
              <Switch checked={config.enabled} onCheckedChange={(v) => setConfig((c) => ({ ...c, enabled: v }))} />
            </div>
            <div className="space-y-2">
              <Label>{t("admin.postUpgradeTeamCommissions.sendTimeUtc")}</Label>
              <Input
                type="time"
                value={config.send_time_utc}
                onChange={(e) => setConfig((c) => ({ ...c, send_time_utc: normalizeSendTimeUtc(e.target.value || DEFAULT_SEND_TIME) }))}
                step={60}
              />
              <p className="text-sm text-muted-foreground">{t("admin.postUpgradeTeamCommissions.sendTimeHelp")}</p>
            </div>
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div>
                <Label className="text-base">{t("admin.postUpgradeTeamCommissions.requireEmailVerified")}</Label>
                <p className="text-sm text-muted-foreground">{t("admin.postUpgradeTeamCommissions.requireEmailVerifiedHelp")}</p>
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
                  {t("admin.postUpgradeTeamCommissions.nextRun")} <strong>{formatUtc(getNextRunUtc(config.send_time_utc))}</strong>.{" "}
                  {t("admin.postUpgradeTeamCommissions.nextRunHelp")}
                </AlertDescription>
              </Alert>
            )}
            <div className="flex flex-wrap gap-2">
              <Button onClick={handleSaveConfig} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                {t("admin.postUpgradeTeamCommissions.saveConfig")}
              </Button>
              {config.enabled && (
                <Button variant="outline" onClick={handleRunNow} disabled={runningNow} title={t("admin.postUpgradeTeamCommissions.runNowHelp")}>
                  {runningNow ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                  {t("admin.postUpgradeTeamCommissions.runNow")}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("admin.postUpgradeTeamCommissions.reportingTitle")}</CardTitle>
            <CardDescription>{t("admin.postUpgradeTeamCommissions.reportingDescription")}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="flex items-center gap-2 rounded-lg border p-4">
                <Users className="h-8 w-8 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">{t("admin.postUpgradeTeamCommissions.totalEnrolled")}</p>
                  <p className="text-2xl font-semibold">{enrolledCount ?? "—"}</p>
                </div>
              </div>
              <div className="rounded-lg border p-4">
                <p className="text-sm text-muted-foreground">{t("admin.postUpgradeTeamCommissions.sentToday")}</p>
                <p className="text-2xl font-semibold">{todaySent ?? "—"}</p>
              </div>
              <div className="rounded-lg border p-4">
                <p className="text-sm text-muted-foreground">{t("admin.postUpgradeTeamCommissions.failuresToday")}</p>
                <p className="text-2xl font-semibold">{todayFailed ?? "—"}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("admin.postUpgradeTeamCommissions.emailTemplatesTitle")}</CardTitle>
            <CardDescription>{t("admin.postUpgradeTeamCommissions.emailTemplatesDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <AlertDescription>{t("admin.postUpgradeTeamCommissions.variablesHelp")}</AlertDescription>
            </Alert>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="flex flex-wrap h-auto gap-1">
                {TEMPLATE_TYPES.map((_, i) => (
                  <TabsTrigger key={i} value={String(i + 1)}>
                    {t("admin.postUpgradeTeamCommissions.emailStep", { step: i + 1, day: dayOffsets[i + 1] ?? DEFAULT_DAY_OFFSETS[i] })}
                  </TabsTrigger>
                ))}
              </TabsList>
              {TEMPLATE_TYPES.map((templateType, i) => {
                const step = i + 1;
                const tpl = templates[templateType];
                const e = edits[templateType] ?? { subject: "", body: "" };
                return (
                  <TabsContent key={templateType} value={String(step)} className="space-y-4 pt-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label>{t("admin.postUpgradeTeamCommissions.stepName")}</Label>
                        <Input value={STEP_NAMES[i]} disabled className="bg-muted" />
                      </div>
                      <div className="space-y-2">
                        <Label>{t("admin.postUpgradeTeamCommissions.dayOffset")}</Label>
                        <Input
                          type="number"
                          min={0}
                          value={dayOffsets[step] ?? DEFAULT_DAY_OFFSETS[i]}
                          onChange={(ev) => setDayOffsets((prev) => ({ ...prev, [step]: Math.max(0, parseInt(ev.target.value, 10) || 0) }))}
                        />
                      </div>
                    </div>
                    <div className="flex items-center justify-between rounded-lg border p-4">
                      <Label className="text-base">{t("admin.postUpgradeTeamCommissions.stepActive")}</Label>
                      <Switch
                        checked={stepActive[step] !== false}
                        onCheckedChange={(v) => setStepActive((prev) => ({ ...prev, [step]: v }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>{t("admin.postUpgradeTeamCommissions.subject")}</Label>
                      <Input
                        value={e.subject}
                        onChange={(ev) => setEdits((prev) => ({ ...prev, [templateType]: { ...(prev[templateType] ?? e), subject: ev.target.value } }))}
                        placeholder={t("admin.postUpgradeTeamCommissions.subjectPlaceholder")}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>{t("admin.postUpgradeTeamCommissions.body")}</Label>
                      <Textarea
                        value={e.body}
                        onChange={(ev) => setEdits((prev) => ({ ...prev, [templateType]: { ...(prev[templateType] ?? e), body: ev.target.value } }))}
                        rows={14}
                        className="font-mono text-sm resize-none min-h-[320px] h-[320px] overflow-y-auto"
                        placeholder={t("admin.postUpgradeTeamCommissions.bodyPlaceholder")}
                      />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button onClick={() => handleSaveTemplate(templateType)} disabled={saving || !tpl}>
                        {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                        {t("admin.postUpgradeTeamCommissions.saveTemplate")}
                      </Button>
                      <Button variant="outline" onClick={handleTestSend} disabled={sendingTest}>
                        {sendingTest ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                        {t("admin.postUpgradeTeamCommissions.testSend")}
                      </Button>
                      <Button variant="outline" onClick={handlePreview}>
                        {t("admin.postUpgradeTeamCommissions.preview")}
                      </Button>
                    </div>
                    {previewHtml !== null && activeTab === String(step) && (
                      <div className="rounded border p-4 bg-muted/30">
                        <Label className="block mb-2">{t("admin.postUpgradeTeamCommissions.previewRendered")}</Label>
                        <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: previewHtml }} />
                      </div>
                    )}
                  </TabsContent>
                );
              })}
            </Tabs>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("admin.postUpgradeTeamCommissions.logsTitle")}</CardTitle>
            <CardDescription>{t("admin.postUpgradeTeamCommissions.logsDescription")}</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("admin.postUpgradeTeamCommissions.logRunDate")}</TableHead>
                  <TableHead>{t("admin.postUpgradeTeamCommissions.logEligible")}</TableHead>
                  <TableHead>{t("admin.postUpgradeTeamCommissions.logSent")}</TableHead>
                  <TableHead>{t("admin.postUpgradeTeamCommissions.logFailed")}</TableHead>
                  <TableHead>{t("admin.postUpgradeTeamCommissions.logRunAt")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logsLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      {t("admin.postUpgradeTeamCommissions.loading")}
                    </TableCell>
                  </TableRow>
                ) : logs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      {t("admin.postUpgradeTeamCommissions.noLogs")}
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
            {totalLogsCount !== null && (
              <div className="flex items-center justify-between mt-4 flex-wrap gap-2">
                <p className="text-sm text-muted-foreground">
                  {t("admin.postUpgradeTeamCommissions.logsPageOf", {
                    page: logsPage,
                    total: Math.max(1, Math.ceil(totalLogsCount / LOGS_PAGE_SIZE)),
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
                    {t("admin.postUpgradeTeamCommissions.previous")}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setLogsPage((p) => p + 1)}
                    disabled={logsPage >= Math.ceil(totalLogsCount / LOGS_PAGE_SIZE) || logsLoading}
                  >
                    {t("admin.postUpgradeTeamCommissions.next")}
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
