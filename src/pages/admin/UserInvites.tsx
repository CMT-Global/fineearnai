import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { Mail, Send, Eye, Info, History, ArrowLeft } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmailHistoryTab } from "@/components/admin/EmailHistoryTab";
import { EmailBestPractices } from "@/components/admin/EmailBestPractices";
import { useTranslation } from "react-i18next";
import { useLanguage } from "@/contexts/LanguageContext";
import { useLanguageSync } from "@/hooks/useLanguageSync";
import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  template_type: string;
  variables: string[];
}

export default function UserInvites() {
  const { t } = useTranslation();
  const { userLanguage } = useLanguage();
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdmin();
  const navigate = useNavigate();
  useLanguageSync(); // Sync language and force re-render
  
  const [template, setTemplate] = useState<EmailTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  
  const [formData, setFormData] = useState({
    email: "",
    inviteeName: "",
    signupBonus: "Start earning immediately with your first tasks!",
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
        .eq("template_type", "user_invite")
        .eq("is_active", true)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setTemplate({
          ...data,
          variables: data.variables as string[]
        });
      } else {
        toast.error(t("admin.userInvites.errors.failedToLoadTemplate"));
      }
    } catch (error: any) {
      console.error("Error loading template:", error);
      toast.error(t("admin.userInvites.errors.failedToLoadTemplate"));
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async () => {
    try {
      if (!formData.email || !formData.inviteeName) {
        toast.error(t("admin.userInvites.errors.fillRequiredFields"));
        return;
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email)) {
        toast.error(t("admin.userInvites.errors.invalidEmail"));
        return;
      }

      setSending(true);

      const { data, error } = await supabase.functions.invoke("send-user-invite", {
        body: {
          email: formData.email,
          inviteeName: formData.inviteeName,
          signupBonus: formData.signupBonus,
          customMessage: formData.customMessage || undefined,
        },
      });

      if (error) throw error;

      toast.success(t("admin.userInvites.success.invitationSentTo", { email: formData.email }));
      
      // Reset form
      setFormData({
        email: "",
        inviteeName: "",
        signupBonus: "Start earning immediately with your first tasks!",
        customMessage: "",
      });
    } catch (error: any) {
      console.error("Error sending invite:", error);
      toast.error(error.message || t("admin.userInvites.errors.failedToSend"));
    } finally {
      setSending(false);
    }
  };

  const getPreviewContent = () => {
    if (!template) return "";
    
    let content = template.body;
    
    // Replace variables for preview
    const variables = {
      invitee_name: formData.inviteeName || '[Invitee Name]',
      signup_bonus: formData.signupBonus || 'Start earning immediately with your first tasks!',
      referral_link: 'https://profitchips.com/signup?ref=user',
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
          <strong>${t("admin.userInvites.preview.personalMessage")}:</strong><br/>${formData.customMessage}
        </p>
      </div>` + content;
    }
    
    return content;
  };

  if (authLoading || adminLoading || loading) {
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
            {t("admin.backToAdmin")}
          </Button>
          <Alert variant="destructive">
            <AlertDescription>
              {t("admin.userInvites.errors.failedToLoadTemplate")}
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
            {t("admin.backToAdmin")}
          </Button>

          <h1 className="text-3xl font-bold mb-2">{t("admin.userInvites.title")}</h1>
          <p className="text-muted-foreground">
            {t("admin.userInvites.subtitle")}
          </p>
        </div>

        {/* Main Tabs */}
        <Tabs defaultValue="compose" className="space-y-6">
          <TabsList className="grid w-full max-w-md grid-cols-3">
            <TabsTrigger value="compose">
              <Send className="h-4 w-4 mr-2" />
              {t("admin.userInvites.tabs.compose")}
            </TabsTrigger>
            <TabsTrigger value="history">
              <History className="h-4 w-4 mr-2" />
              {t("admin.userInvites.tabs.history")}
            </TabsTrigger>
            <TabsTrigger value="best-practices">
              <Info className="h-4 w-4 mr-2" />
              {t("admin.userInvites.tabs.bestPractices")}
            </TabsTrigger>
          </TabsList>

          {/* Compose Tab */}
          <TabsContent value="compose">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Compose Form */}
              <div className="lg:col-span-2">
                <Card>
                  <CardHeader>
                    <CardTitle>{t("admin.userInvites.actions.sendInvite")}</CardTitle>
                    <CardDescription>
                      {t("admin.userInvites.form.recipientInfoDescription")}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Email */}
                    <div>
                      <Label htmlFor="email">{t("admin.userInvites.form.emailAddress")}</Label>
                      <Input
                        id="email"
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        placeholder={t("admin.userInvites.form.emailPlaceholder")}
                      />
                    </div>

                    {/* Name */}
                    <div>
                      <Label htmlFor="name">{t("admin.userInvites.form.inviteeName")}</Label>
                      <Input
                        id="name"
                        value={formData.inviteeName}
                        onChange={(e) => setFormData({ ...formData, inviteeName: e.target.value })}
                        placeholder={t("admin.userInvites.form.inviteeNamePlaceholder")}
                      />
                    </div>

                    {/* Signup Bonus */}
                    <div>
                      <Label htmlFor="signupBonus">{t("admin.userInvites.form.signupBonus")}</Label>
                      <Input
                        id="signupBonus"
                        value={formData.signupBonus}
                        onChange={(e) => setFormData({ ...formData, signupBonus: e.target.value })}
                        placeholder={t("admin.userInvites.form.signupBonusDefault")}
                      />
                      <p className="text-sm text-muted-foreground mt-1">
                        {t("admin.userInvites.form.signupBonusHint")}
                      </p>
                    </div>

                    {/* Template Info */}
                    <Alert>
                      <Mail className="h-4 w-4" />
                      <AlertDescription>
                        <strong>{t("admin.userInvites.form.emailTemplate")}:</strong> {template.name}
                        <br />
                        <strong>{t("admin.userInvites.form.subject")}:</strong> {template.subject}
                      </AlertDescription>
                    </Alert>

                    {/* Custom Message */}
                    <div>
                      <Label htmlFor="message">{t("admin.userInvites.form.customMessage")}</Label>
                      <Textarea
                        id="message"
                        value={formData.customMessage}
                        onChange={(e) => setFormData({ ...formData, customMessage: e.target.value })}
                        placeholder={t("admin.userInvites.form.customMessagePlaceholder")}
                        rows={4}
                      />
                      <p className="text-sm text-muted-foreground mt-1">
                        {t("admin.userInvites.form.customMessageHint")}
                      </p>
                    </div>

                    {/* Available Variables */}
                    <Alert>
                      <Info className="h-4 w-4" />
                      <AlertDescription>
                        {t("admin.userInvites.info.templateConfiguration")}
                      </AlertDescription>
                    </Alert>

                    {/* Preview Button */}
                    <Button
                      variant="outline"
                      onClick={() => setPreviewDialogOpen(true)}
                      className="w-full"
                      disabled={!formData.email || !formData.inviteeName}
                    >
                      <Eye className="mr-2 h-4 w-4" />
                      {t("admin.userInvites.actions.previewEmail")}
                    </Button>

                    {/* Send Button */}
                    <Button
                      onClick={handleSend}
                      disabled={sending || !formData.email || !formData.inviteeName}
                      className="w-full"
                      size="lg"
                    >
                      {sending ? (
                        <>
                          <LoadingSpinner size="sm" className="mr-2" />
                          {t("admin.userInvites.actions.sending")}
                        </>
                      ) : (
                        <>
                          <Send className="mr-2 h-5 w-5" />
                          {t("admin.userInvites.actions.sendInvite")}
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              </div>

              {/* Sidebar */}
              <div className="space-y-6">
                {/* Template Info */}
                <Card>
                  <CardHeader>
                    <CardTitle>{t("admin.userInvites.form.emailTemplate")}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3 text-sm">
                      <div>
                        <p className="text-muted-foreground">{t("admin.userInvites.form.emailTemplate")}</p>
                        <p className="font-medium">{template.name}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">{t("admin.userInvites.form.subject")}</p>
                        <p className="font-medium">{template.subject}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">{t("admin.userInvites.info.templateDescription")}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Preview Dialog */}
            <Dialog open={previewDialogOpen} onOpenChange={setPreviewDialogOpen}>
              <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{t("admin.userInvites.preview.title")}</DialogTitle>
                  <DialogDescription>
                    {t("admin.userInvites.info.templateDescription")}
                  </DialogDescription>
                </DialogHeader>
                
                <div className="space-y-4">
                  {/* Subject Preview */}
                  <div>
                    <Label className="text-sm font-medium">{t("admin.userInvites.form.subject")}</Label>
                    <div className="mt-1 p-3 bg-muted rounded-lg">
                      <p className="font-medium">{template.subject}</p>
                    </div>
                  </div>
                  
                  {/* Recipient Info */}
                  <Alert>
                    <Info className="h-4 w-4" />
                    <AlertDescription>
                      <strong>{t("admin.userInvites.form.emailAddress")}:</strong> {formData.email}
                      <br />
                      <strong>{t("admin.userInvites.form.inviteeName")}:</strong> {formData.inviteeName}
                    </AlertDescription>
                  </Alert>
                  
                  {/* Body Preview */}
                  <div>
                    <Label className="text-sm font-medium">{t("admin.userInvites.preview.title")}</Label>
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
                    {t("common.close")}
                  </Button>
                  <Button 
                    onClick={() => {
                      setPreviewDialogOpen(false);
                      handleSend();
                    }} 
                    disabled={sending}
                  >
                    <Send className="mr-2 h-4 w-4" />
                    {t("admin.userInvites.actions.sendInvite")}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </TabsContent>

          {/* History Tab */}
          <TabsContent value="history">
            <EmailHistoryTab emailType="user_invite" />
          </TabsContent>

          {/* Best Practices Tab */}
          <TabsContent value="best-practices">
            <EmailBestPractices />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}