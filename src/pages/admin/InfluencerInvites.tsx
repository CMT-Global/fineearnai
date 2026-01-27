import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";
import { useLanguageSync } from "@/hooks/useLanguageSync";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowLeft, Send, Eye, Info, Mail, History } from "lucide-react";
import { toast } from "sonner";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { RichTextEditor } from "@/components/admin/RichTextEditor";
import { EmailHistoryTab } from "@/components/admin/EmailHistoryTab";
import { EmailBestPractices } from "@/components/admin/EmailBestPractices";

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  template_type: string;
  variables: string[];
}

const InfluencerInvites = () => {
  const { t, ready } = useTranslation();
  useLanguageSync(); // Sync language and force re-render when language changes
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdmin();
  const navigate = useNavigate();
  
  const [template, setTemplate] = useState<EmailTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  
  const [formData, setFormData] = useState({
    email: "",
    influencerName: "",
    commissionRate: "15",
    customMessage: "",
  });

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/login");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!adminLoading && !isAdmin) {
      toast.error(t("admin.accessDenied"));
      navigate("/dashboard");
    }
  }, [isAdmin, adminLoading, navigate, t]);

  useEffect(() => {
    if (isAdmin) {
      loadTemplate();
    }
  }, [isAdmin]);

  const loadTemplate = async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from("email_templates")
        .select("*")
        .eq("template_type", "influencer_invite")
        .eq("is_active", true)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setTemplate({
          ...data,
          variables: data.variables as string[]
        });
      } else {
        toast.error(t("admin.influencerInvites.templateNotFound"));
      }
    } catch (error: any) {
      console.error("Error loading template:", error);
      toast.error(t("admin.influencerInvites.failedToLoadTemplate"));
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async () => {
    try {
      if (!formData.email || !formData.influencerName) {
        toast.error(t("admin.influencerInvites.fillEmailAndName"));
        return;
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email)) {
        toast.error(t("admin.influencerInvites.invalidEmail"));
        return;
      }

      setSending(true);

      const { data, error } = await supabase.functions.invoke("send-influencer-invite", {
        body: {
          email: formData.email,
          influencerName: formData.influencerName,
          commissionRate: formData.commissionRate,
          customMessage: formData.customMessage || undefined,
        },
      });

      if (error) throw error;

      toast.success(t("admin.influencerInvites.inviteSentSuccess", { email: formData.email }));
      
      // Reset form
      setFormData({
        email: "",
        influencerName: "",
        commissionRate: "15",
        customMessage: "",
      });
    } catch (error: any) {
      console.error("Error sending invite:", error);
      toast.error(t("admin.influencerInvites.failedToSend", { message: error?.message ?? "" }));
    } finally {
      setSending(false);
    }
  };

  const getPreviewContent = () => {
    if (!template) return "";
    
    let content = template.body;
    
    // Replace variables for preview
    const variables = {
      influencer_name: formData.influencerName || '[Influencer Name]',
      commission_rate: formData.commissionRate || '15',
      referral_link: 'https://fineearn.com/signup?ref=influencer',
      support_email: 'support@profitchips.com',
    };

    Object.entries(variables).forEach(([key, value]) => {
      const regex = new RegExp(`{{${key}}}`, 'g');
      content = content.replace(regex, `<strong>${value}</strong>`);
    });

    // Add custom message if provided
    if (formData.customMessage) {
      content = `<div style="background-color: #fff3cd; padding: 15px; border-radius: 8px; margin-bottom: 25px; border-left: 4px solid #ffc107;">
        <p style="margin: 0; font-size: 15px; line-height: 1.6; color: #856404;">
          <strong>${t("admin.influencerInvites.personalMessageLabel")}:</strong><br/>${formData.customMessage}
        </p>
      </div>` + content;
    }
    
    return content;
  };

  if (authLoading || adminLoading || loading || !ready) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <LoadingSpinner size="lg" text={t("common.loading")} />
      </div>
    );
  }

  if (!template) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          <Button variant="ghost" onClick={() => navigate("/admin")} className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t("admin.influencerInvites.backToAdmin")}
          </Button>
          <Alert variant="destructive">
            <AlertDescription>
              {t("admin.influencerInvites.templateNotFoundContact")}
            </AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <Button variant="ghost" onClick={() => navigate("/admin")} className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t("admin.influencerInvites.backToAdmin")}
          </Button>

          <h1 className="text-3xl font-bold mb-2">{t("admin.influencerInvites.title")}</h1>
          <p className="text-muted-foreground">
            {t("admin.influencerInvites.subtitle")}
          </p>
        </div>

        {/* Main Tabs */}
        <Tabs defaultValue="compose" className="space-y-6">
          <TabsList className="grid w-full max-w-md grid-cols-3">
            <TabsTrigger value="compose">
              <Send className="h-4 w-4 mr-2" />
              {t("admin.influencerInvites.tabs.compose")}
            </TabsTrigger>
            <TabsTrigger value="history">
              <History className="h-4 w-4 mr-2" />
              {t("admin.influencerInvites.tabs.history")}
            </TabsTrigger>
            <TabsTrigger value="best-practices">
              <Info className="h-4 w-4 mr-2" />
              {t("admin.influencerInvites.tabs.bestPractices")}
            </TabsTrigger>
          </TabsList>

          {/* Compose Tab */}
          <TabsContent value="compose">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Compose Form */}
              <div className="lg:col-span-2">
                <Card>
                  <CardHeader>
                    <CardTitle>{t("admin.influencerInvites.sendInvite")}</CardTitle>
                    <CardDescription>
                      {t("admin.influencerInvites.sendInviteDescription")}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Email */}
                    <div>
                      <Label htmlFor="email">{t("admin.influencerInvites.influencerEmail")}</Label>
                      <Input
                        id="email"
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        placeholder={t("admin.influencerInvites.emailPlaceholder")}
                      />
                    </div>

                    {/* Name */}
                    <div>
                      <Label htmlFor="name">{t("admin.influencerInvites.influencerName")}</Label>
                      <Input
                        id="name"
                        value={formData.influencerName}
                        onChange={(e) => setFormData({ ...formData, influencerName: e.target.value })}
                        placeholder={t("admin.influencerInvites.namePlaceholder")}
                      />
                    </div>

                    {/* Commission Rate */}
                    <div>
                      <Label htmlFor="commission">{t("admin.influencerInvites.commissionRate")}</Label>
                      <Input
                        id="commission"
                        type="number"
                        min="0"
                        max="100"
                        value={formData.commissionRate}
                        onChange={(e) => setFormData({ ...formData, commissionRate: e.target.value })}
                        placeholder="15"
                      />
                      <p className="text-sm text-muted-foreground mt-1">
                        {t("admin.influencerInvites.commissionRateHint")}
                      </p>
                    </div>

                    {/* Template Info */}
                    <Alert>
                      <Mail className="h-4 w-4" />
                      <AlertDescription>
                        <strong>{t("admin.influencerInvites.template")}:</strong> {template.name}
                        <br />
                        <strong>{t("admin.influencerInvites.subject")}:</strong> {template.subject}
                      </AlertDescription>
                    </Alert>

                    {/* Custom Message */}
                    <div>
                      <Label htmlFor="message">{t("admin.influencerInvites.personalMessage")}</Label>
                      <Textarea
                        id="message"
                        value={formData.customMessage}
                        onChange={(e) => setFormData({ ...formData, customMessage: e.target.value })}
                        placeholder={t("admin.influencerInvites.personalMessagePlaceholder")}
                        rows={4}
                      />
                      <p className="text-sm text-muted-foreground mt-1">
                        {t("admin.influencerInvites.personalMessageHint")}
                      </p>
                    </div>

                    {/* Available Variables */}
                    <Alert>
                      <Info className="h-4 w-4" />
                      <AlertDescription>
                        <strong>{t("admin.influencerInvites.templateVariables")}:</strong> {t("admin.influencerInvites.templateVariablesDescription")}
                      </AlertDescription>
                    </Alert>

                    {/* Preview Button */}
                    <Button
                      variant="outline"
                      onClick={() => setPreviewDialogOpen(true)}
                      className="w-full"
                      disabled={!formData.email || !formData.influencerName}
                    >
                      <Eye className="mr-2 h-4 w-4" />
                      {t("admin.influencerInvites.previewEmail")}
                    </Button>

                    {/* Send Button */}
                    <Button
                      onClick={handleSend}
                      disabled={sending || !formData.email || !formData.influencerName}
                      className="w-full"
                      size="lg"
                    >
                      {sending ? (
                        <>
                          <LoadingSpinner size="sm" className="mr-2" />
                          {t("admin.influencerInvites.sending")}
                        </>
                      ) : (
                        <>
                          <Send className="mr-2 h-5 w-5" />
                          {t("admin.influencerInvites.sendInviteButton")}
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              </div>

              {/* Sidebar */}
              <div className="space-y-6">
                {/* Quick Stats */}
                <Card>
                  <CardHeader>
                    <CardTitle>{t("admin.influencerInvites.templateInfo")}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3 text-sm">
                      <div>
                        <p className="text-muted-foreground">{t("admin.influencerInvites.templateName")}</p>
                        <p className="font-medium">{template.name}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">{t("admin.influencerInvites.subjectLine")}</p>
                        <p className="font-medium">{template.subject}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">{t("admin.influencerInvites.variables")}</p>
                        <p className="font-medium">{t("admin.influencerInvites.variablesCount", { count: template.variables.length })}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Tips */}
                <Card>
                  <CardHeader>
                    <CardTitle>{t("admin.influencerInvites.bestPractices")}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="text-sm space-y-2 text-muted-foreground">
                      <li>• {t("admin.influencerInvites.bestPractice1")}</li>
                      <li>• {t("admin.influencerInvites.bestPractice2")}</li>
                      <li>• {t("admin.influencerInvites.bestPractice3")}</li>
                      <li>• {t("admin.influencerInvites.bestPractice4")}</li>
                      <li>• {t("admin.influencerInvites.bestPractice5")}</li>
                    </ul>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Preview Dialog */}
            <Dialog open={previewDialogOpen} onOpenChange={setPreviewDialogOpen}>
              <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{t("admin.influencerInvites.emailPreview")}</DialogTitle>
                  <DialogDescription>
                    {t("admin.influencerInvites.emailPreviewDescription")}
                  </DialogDescription>
                </DialogHeader>
                
                <div className="space-y-4">
                  {/* Subject Preview */}
                  <div>
                    <Label className="text-sm font-medium">{t("admin.influencerInvites.subject")}</Label>
                    <div className="mt-1 p-3 bg-muted rounded-lg">
                      <p className="font-medium">{template.subject}</p>
                    </div>
                  </div>
                  
                  {/* Recipient Info */}
                  <Alert>
                    <Info className="h-4 w-4" />
                    <AlertDescription>
                      <strong>{t("admin.influencerInvites.to")}:</strong> {formData.email} ({formData.influencerName})
                      <br />
                      <strong>{t("admin.influencerInvites.commissionRate")}:</strong> {formData.commissionRate}%
                    </AlertDescription>
                  </Alert>
                  
                  {/* Body Preview */}
                  <div>
                    <Label className="text-sm font-medium">{t("admin.influencerInvites.emailBody")}</Label>
                    <div className="mt-1 border rounded-lg bg-card p-6">
                      <div
                        className="prose prose-sm max-w-none"
                        dangerouslySetInnerHTML={{ __html: getPreviewContent() }}
                      />
                    </div>
                  </div>
                </div>
                
                <DialogFooter>
                  <Button variant="outline" onClick={() => setPreviewDialogOpen(false)}>
                    {t("admin.influencerInvites.closePreview")}
                  </Button>
                  <Button 
                    onClick={() => {
                      setPreviewDialogOpen(false);
                      handleSend();
                    }} 
                    disabled={sending}
                  >
                    <Send className="mr-2 h-4 w-4" />
                    {t("admin.influencerInvites.sendInviteButton")}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </TabsContent>

          {/* History Tab */}
          <TabsContent value="history">
            <EmailHistoryTab emailType="influencer_invite" />
          </TabsContent>

          {/* Best Practices Tab */}
          <TabsContent value="best-practices">
            <EmailBestPractices />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default InfluencerInvites;