import { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useLanguageSync } from "@/hooks/useLanguageSync";
import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { ArrowLeft, Mail, Send, Loader2, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { PageLoading } from "@/components/shared/PageLoading";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface CampaignConfig {
  enabled: boolean;
}

interface EmailTemplateRow {
  id: string;
  subject: string;
  body: string;
  template_type: string;
}

const CONFIG_KEY = "upgrade_success_email_campaign";
const TEMPLATE_TYPE = "account_upgrade_success";

export default function UpgradeSuccessEmailCampaign() {
  const { t } = useTranslation();
  useLanguageSync();
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdmin();
  const navigate = useNavigate();

  const [config, setConfig] = useState<CampaignConfig>({ enabled: false });
  const [template, setTemplate] = useState<EmailTemplateRow | null>(null);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const bodyTextareaRef = useRef<HTMLTextAreaElement>(null);

  const adjustBodyHeight = useCallback(() => {
    const el = bodyTextareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.max(120, el.scrollHeight)}px`;
  }, []);

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
        const [configRes, templateRes] = await Promise.all([
          supabase.from("platform_config").select("value").eq("key", CONFIG_KEY).maybeSingle(),
          supabase.from("email_templates").select("id, subject, body, template_type").eq("template_type", TEMPLATE_TYPE).maybeSingle(),
        ]);

        const cfg = (configRes.data?.value as unknown as CampaignConfig) || { enabled: false };
        setConfig({ enabled: !!cfg.enabled });

        if (templateRes.data) {
          setTemplate(templateRes.data as EmailTemplateRow);
          setSubject(templateRes.data.subject ?? "");
          setBody(templateRes.data.body ?? "");
        }
      } catch (e) {
        console.error(e);
        toast.error("Failed to load campaign settings");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [isAdmin]);

  useEffect(() => {
    adjustBodyHeight();
  }, [body, adjustBodyHeight]);

  const handleSaveConfig = async () => {
    setSaving(true);
    try {
      const { error } = await supabase.from("platform_config").upsert(
        { key: CONFIG_KEY, value: config as unknown as Json, description: "Account upgrade success email", updated_at: new Date().toISOString() },
        { onConflict: "key" }
      );
      if (error) throw error;
      toast.success("Settings saved");
    } catch (e: unknown) {
      toast.error((e as Error)?.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveTemplate = async () => {
    if (!template?.id) {
      toast.error("Template not found");
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from("email_templates")
        .update({ subject, body, updated_at: new Date().toISOString() })
        .eq("id", template.id);
      if (error) throw error;
      toast.success("Template saved");
    } catch (e: unknown) {
      toast.error((e as Error)?.message || "Failed to save template");
    } finally {
      setSaving(false);
    }
  };

  const handleTestSend = async () => {
    setSendingTest(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-upgrade-success-test", { body: {} });
      if (error) throw error;
      if (data?.success === false) throw new Error(data.error);
      toast.success(data?.message || "Test email sent");
    } catch (e: unknown) {
      toast.error((e as Error)?.message || "Failed to send test email");
    } finally {
      setSendingTest(false);
    }
  };

  if (authLoading || adminLoading || loading) {
    return <PageLoading text={t("common.loading") || "Loading…"} />;
  }

  const variablesHelp = "Variables: {{first_name}}, {{login_url}}, {{new_plan_name}}, {{team_invite_link}}, {{membership_url}}, {{support_email}}, {{platform_name}}, {{task_commissions_earned}}";

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <Button variant="ghost" onClick={() => navigate("/admin")} className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Admin
        </Button>
        <h1 className="text-3xl font-bold">Upgrade Success Email</h1>
        <p className="text-muted-foreground mt-1">
          Email sent to users after a successful plan upgrade. Enable or disable here; all content is editable and uses dynamic data (plan name, login link, team invite link, task commissions from referrals).
        </p>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Campaign settings
            </CardTitle>
            <CardDescription>
              When enabled, users receive this email automatically after upgrading their plan.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div>
                <Label className="text-base">Enable upgrade success email</Label>
                <p className="text-sm text-muted-foreground">Send the email after each successful plan upgrade when turned on.</p>
              </div>
              <Switch checked={config.enabled} onCheckedChange={(v) => setConfig((c) => ({ ...c, enabled: v }))} />
            </div>
            <Button onClick={handleSaveConfig} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Save settings
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Email template</CardTitle>
            <CardDescription>
              Subject and body for the upgrade success email. You can also edit this template from Communications → Templates.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <AlertDescription>{variablesHelp}</AlertDescription>
            </Alert>
            <div className="space-y-2">
              <Label>Subject</Label>
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Your plan has been upgraded" />
            </div>
            <div className="space-y-2">
              <Label>Body (HTML)</Label>
              <div className="rounded-md border overflow-hidden">
                <Textarea
                  ref={bodyTextareaRef}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={4}
                  className="font-mono text-sm resize-none min-h-[120px] w-full border-0 focus-visible:ring-0 focus-visible:ring-offset-0 rounded-none block overflow-y-hidden"
                  placeholder="<p>Hi {{first_name}}, ...</p>"
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={handleSaveTemplate} disabled={saving || !template}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Save template
              </Button>
              <Button variant="outline" onClick={handleTestSend} disabled={sendingTest}>
                {sendingTest ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                Send test email
              </Button>
              <Button variant="outline" onClick={() => navigate("/admin/communications/templates")} className="gap-2">
                <ExternalLink className="h-4 w-4" />
                Edit in Templates
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
