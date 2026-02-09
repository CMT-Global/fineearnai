import { useEffect, useState, useCallback, useRef, useMemo } from "react";
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
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Plus, Edit, Trash2, Eye, Info, Mail, AlertTriangle, Monitor, Smartphone, Sparkles, Copy } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { PageLoading } from "@/components/shared/PageLoading";
import { RichTextEditor } from "@/components/admin/RichTextEditor";

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  template_type: string;
  variables: string[];
  is_active: boolean;
  use_wrapper_in_editor?: boolean; // Phase 2: Track if template has wrapper baked in
}

// Complete platform template types with descriptions and available variables
const TEMPLATE_TYPES = [
  // Transaction Emails
  {
    value: "transaction",
    label: "Transaction (Deposit/Withdrawal)",
    description: "For deposit confirmations, withdrawal processed, withdrawal rejected",
    variables: ["username", "amount", "transaction_id", "new_balance", "payment_method", "gateway", "rejection_reason"]
  },
  
  // Referral Emails
  {
    value: "referral",
    label: "Referral (New Signup/Milestone)",
    description: "For new referral signups and milestone achievements",
    variables: ["username", "referred_username", "referral_code", "total_referrals", "milestone_count", "total_commission", "reward_message", "next_milestone", "referrals_to_next"]
  },
  
  // Membership Emails
  {
    value: "membership",
    label: "Membership (Upgrade/Expiry/Renewal)",
    description: "For plan upgrades, expiry reminders, and renewal notifications",
    variables: ["username", "plan_name", "expiry_date", "days_until_expiry", "plan_price", "new_plan", "old_plan"]
  },
  
  // User Onboarding
  {
    value: "user_onboarding",
    label: "User Onboarding (Welcome)",
    description: "Welcome email sent to new users",
    variables: ["username", "email", "referral_code", "platform_url"]
  },
  
  // Auth Emails (handled by auth hook)
  {
    value: "auth_password_reset",
    label: "Password Reset",
    description: "Sent when user requests a password reset",
    variables: ["username", "email", "reset_link", "token_hash", "redirect_to"]
  },
  {
    value: "auth_email_confirmation",
    label: "Email Confirmation",
    description: "Sent to verify user's email address",
    variables: ["username", "email", "confirmation_link", "token_hash", "redirect_to"]
  },
  {
    value: "auth_magic_link",
    label: "Magic Link Login",
    description: "Sent for passwordless authentication",
    variables: ["username", "email", "magic_link", "token_hash", "redirect_to"]
  },
  {
    value: "auth_email_change",
    label: "Email Change Confirmation",
    description: "Sent when user changes their email address",
    variables: ["username", "old_email", "new_email", "confirmation_link", "token_hash"]
  },
  
  // Email Verification
  {
    value: "email_verification_otp",
    label: "Email Verification OTP",
    description: "OTP code sent for email verification",
    variables: ["username", "otp_code", "expiry_minutes"]
  },
  
  // Account Deletion
  {
    value: "account_deletion_otp",
    label: "Account Deletion OTP",
    description: "OTP code sent when user requests to delete their account",
    variables: ["username", "otp_code", "expiry_minutes"]
  },
  
  // Custom
  {
    value: "custom",
    label: "Custom Template",
    description: "Create a custom email template",
    variables: []
  }
] as const;

// Import shared email variables
import { ALL_AVAILABLE_VARIABLES, getCategoryIcon } from "@/lib/email-variables";

const EmailTemplates = () => {
  const { t } = useTranslation();
  useLanguageSync(); // Sync language and force re-render when language changes
  
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdmin();
  const navigate = useNavigate();
  
  // Force re-render when language changes
  
  // Ref to hold the insertVariable function from RichTextEditor
  const insertVariableRef = useRef<((variableName: string) => void) | null>(null);
  
  // State declarations
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    subject: "",
    body: "",
    template_type: "",
    variables: "[]",
    is_active: true,
    use_wrapper_in_editor: false,
  });
  const [previewTemplate, setPreviewTemplate] = useState<EmailTemplate | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewMode, setPreviewMode] = useState<'desktop' | 'mobile'>('desktop');
  const [testingTemplateId, setTestingTemplateId] = useState<string | null>(null);
  const [testingTemplate, setTestingTemplate] = useState<EmailTemplate | null>(null);
  const [testEmailDialog, setTestEmailDialog] = useState(false);
  const [testEmailAddress, setTestEmailAddress] = useState("");
  const [sendingTest, setSendingTest] = useState(false);
  
  // Helper function to populate sample data in preview
  const populateSampleData = (content: string): string => {
    const sampleData: Record<string, string> = {
      // User variables
      username: "JohnDoe",
      email: "john.doe@example.com",
      full_name: "John Doe",
      
      // Transaction variables
      amount: "$250.00",
      transaction_id: "TXN-2025-001234",
      new_balance: "$1,250.00",
      payment_method: "USDT TRC20",
      gateway: "CPAY",
      rejection_reason: "Invalid wallet address provided",
      
      // Referral variables
      referred_username: "JaneSmith",
      referral_code: "JOHNDOE2025",
      total_referrals: "47",
      milestone_count: "50",
      total_commission: "$125.00",
      reward_message: "Congratulations! You've unlocked the 50 Referrals Badge!",
      next_milestone: "100",
      referrals_to_next: "3",
      
      // Membership variables
      plan_name: "Premium Plan",
      expiry_date: "March 15, 2025",
      days_until_expiry: "3",
      plan_price: "$49.99",
      new_plan: "Pro Plan",
      old_plan: "Basic Plan",
      
      // Platform variables
      platform_url: "https://profitchips.com",
      
      // Auth variables
      reset_link: "https://profitchips.com/reset-password?token=sample",
      confirmation_link: "https://profitchips.com/confirm-email?token=sample",
      magic_link: "https://profitchips.com/magic-link?token=sample",
      token_hash: "abc123def456",
      redirect_to: "https://profitchips.com/dashboard",
      old_email: "old.email@example.com",
      new_email: "new.email@example.com",
      
      // OTP variables
      otp_code: "123456",
      expiry_minutes: "15"
    };

    let populatedContent = content;
    Object.entries(sampleData).forEach(([key, value]) => {
      const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
      populatedContent = populatedContent.replace(regex, value);
    });
    return populatedContent;
  };
  
  // Get template info based on selected type
  const getTemplateInfo = (type: string) => {
    return TEMPLATE_TYPES.find(t => t.value === type);
  };
  
  const selectedTemplateInfo = useMemo(() => {
    return getTemplateInfo(formData.template_type);
  }, [formData.template_type]);

  // Copy variable to clipboard
  const copyVariableToClipboard = (variableName: string) => {
    const formattedVariable = `{{${variableName}}}`;
    navigator.clipboard.writeText(formattedVariable);
    toast.success(t("admin.emailTemplates.toasts.copiedToClipboard", { variable: formattedVariable }));
  };

  // Insert variable directly into editor
  const insertVariableIntoEditor = useCallback((variableName: string) => {
    if (insertVariableRef.current) {
      insertVariableRef.current(variableName);
      const formattedVariable = `{{${variableName}}}`;
      toast.success(t("admin.emailTemplates.toasts.addedToEditor", { variable: formattedVariable }));
    }
  }, [t]);

  // Handle editor ready callback
  const handleEditorReady = useCallback((insertFn: (variableName: string) => void) => {
    insertVariableRef.current = insertFn;
  }, []);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/login");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!adminLoading && !isAdmin) {
      toast.error(t("toasts.admin.accessDenied"));
      navigate("/dashboard");
    }
  }, [isAdmin, adminLoading, navigate, t]);

  useEffect(() => {
    if (isAdmin) {
      loadTemplates();
    }
  }, [isAdmin]);

  const loadTemplates = async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from("email_templates")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      setTemplates((data || []).map(t => ({ ...t, variables: t.variables as string[] })));
    } catch (error: any) {
      console.error("Error loading templates:", error);
      toast.error(t("admin.emailTemplates.errors.failedToLoad"));
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      if (!formData.name || !formData.subject || !formData.body || !formData.template_type) {
        toast.error(t("admin.emailTemplates.validation.fillAllFields"));
        return;
      }

      let variables;
      try {
        variables = JSON.parse(formData.variables);
      } catch {
        toast.error(t("admin.emailTemplates.validation.invalidJsonFormat"));
        return;
      }

      const templateData = {
        name: formData.name,
        subject: formData.subject,
        body: formData.body,
        template_type: formData.template_type,
        variables,
        is_active: formData.is_active,
        use_wrapper_in_editor: formData.use_wrapper_in_editor, // Phase 3: Save wrapper state
        created_by: user?.id,
      };

      if (editingTemplate) {
        const { error } = await supabase
          .from("email_templates")
          .update(templateData)
          .eq("id", editingTemplate.id);

        if (error) throw error;
        toast.success(t("admin.emailTemplates.success.templateUpdated"));
      } else {
        const { error } = await supabase
          .from("email_templates")
          .insert([templateData]);

        if (error) throw error;
        toast.success(t("admin.emailTemplates.success.templateCreated"));
      }

      setDialogOpen(false);
      setEditingTemplate(null);
      resetForm();
      loadTemplates();
    } catch (error: any) {
      console.error("Error saving template:", error);
      toast.error(error.message || t("admin.emailTemplates.errors.failedToSave"));
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t("admin.emailTemplates.confirm.delete"))) {
      return;
    }

    try {
      const { error } = await supabase
        .from("email_templates")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast.success(t("admin.emailTemplates.success.templateDeleted"));
      loadTemplates();
    } catch (error: any) {
      console.error("Error deleting template:", error);
      toast.error(t("admin.emailTemplates.errors.failedToDelete"));
    }
  };

  const handleToggleActive = async (template: EmailTemplate) => {
    try {
      const { error } = await supabase
        .from("email_templates")
        .update({ is_active: !template.is_active })
        .eq("id", template.id);

      if (error) throw error;

      toast.success(t(`admin.emailTemplates.success.template${!template.is_active ? "Activated" : "Deactivated"}`));
      loadTemplates();
    } catch (error: any) {
      console.error("Error toggling template:", error);
      toast.error(t("admin.emailTemplates.errors.failedToUpdate"));
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      subject: "",
      body: "",
      template_type: "",
      variables: "[]",
      is_active: true,
      use_wrapper_in_editor: false, // Phase 3: Reset wrapper state
    });
  };
  
  const handleTemplateTypeChange = (value: string) => {
    setFormData({ ...formData, template_type: value });
    
    // Auto-populate variables for auth templates
    const templateInfo = getTemplateInfo(value);
    if (templateInfo && templateInfo.variables.length > 0) {
      setFormData(prev => ({
        ...prev,
        template_type: value,
        variables: JSON.stringify(templateInfo.variables, null, 2)
      }));
    } else {
      setFormData(prev => ({ ...prev, template_type: value }));
    }
  };

  const openEditDialog = (template: EmailTemplate) => {
    setEditingTemplate(template);
    setFormData({
      name: template.name,
      subject: template.subject,
      body: template.body,
      template_type: template.template_type,
      variables: JSON.stringify(template.variables || [], null, 2),
      is_active: template.is_active,
      use_wrapper_in_editor: template.use_wrapper_in_editor || false, // Phase 3: Restore wrapper state
    });
    setDialogOpen(true);
  };

  const openAddDialog = () => {
    setEditingTemplate(null);
    resetForm();
    setDialogOpen(true);
  };

  const openPreview = (template: EmailTemplate) => {
    setPreviewTemplate(template);
    setPreviewOpen(true);
  };

  const openTestEmailDialog = (template: EmailTemplate) => {
    setTestingTemplateId(template.id);
    setTestingTemplate(template);
    setTestEmailDialog(true);
  };

  const handleSendTest = async () => {
    if (!testingTemplateId || !testEmailAddress) return;

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(testEmailAddress)) {
      toast.error(t("admin.emailTemplates.testEmail.invalidEmail"));
      return;
    }

    setSendingTest(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-test-email', {
        body: {
          template_id: testingTemplateId,
          test_email: testEmailAddress,
        },
      });

      if (error) throw error;

      if (data?.error) {
        toast.error(data.error, {
          description: data.details || "Failed to send test email",
        });
        return;
      }

      toast.success(t("admin.emailTemplates.testEmail.success", { email: testEmailAddress }), {
        description: t("admin.emailTemplates.testEmail.successDescription"),
      });
      
      setTestEmailDialog(false);
      setTestEmailAddress("");
      setTestingTemplateId(null);
      setTestingTemplate(null);
    } catch (error: any) {
      console.error("Error sending test email:", error);
      toast.error(t("admin.emailTemplates.testEmail.failed"), {
        description: error.message || t("admin.emailTemplates.testEmail.unexpectedError"),
      });
    } finally {
      setSendingTest(false);
    }
  };

  if (authLoading || adminLoading || loading) {
  return <PageLoading text={t("admin.emailTemplates.loading")} />;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <Button variant="ghost" onClick={() => navigate("/admin")} className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t("admin.emailTemplates.backToAdmin")}
          </Button>

          <h1 className="text-3xl font-bold mb-2">{t("admin.emailTemplates.title")}</h1>
          <p className="text-muted-foreground">
            {t("admin.emailTemplates.subtitle")}
          </p>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>{t("admin.emailTemplates.cardTitle")}</CardTitle>
                <CardDescription>
                  {t("admin.emailTemplates.templatesAvailable", { count: templates.length })}
                </CardDescription>
              </div>
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button onClick={openAddDialog}>
                    <Plus className="mr-2 h-4 w-4" />
                    {t("admin.emailTemplates.addTemplate")}
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-[95vw] w-full max-h-[92vh] p-0 flex flex-col">
                  <div className="flex flex-1 min-h-0">
                    {/* Left Side: Editor */}
                    <div className="flex-1 flex flex-col overflow-hidden border-r">
                      <DialogHeader>
                        <DialogTitle>
                          {editingTemplate ? t("admin.emailTemplates.edit") : t("admin.emailTemplates.create")} {t("admin.emailTemplates.emailTemplate")}
                        </DialogTitle>
                        <DialogDescription>
                          {t("admin.emailTemplates.configureTemplate")}
                        </DialogDescription>
                      </DialogHeader>

                      <div className="flex-1 overflow-y-auto px-6 pb-6">
                        <div className="space-y-4 mt-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor="name">{t("admin.emailTemplates.form.templateName")}</Label>
                            <Input
                              id="name"
                              value={formData.name}
                              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                              placeholder={t("admin.emailTemplates.form.templateNamePlaceholder")}
                            />
                          </div>

                          <div>
                            <Label htmlFor="type">{t("admin.emailTemplates.form.templateType")}</Label>
                            <Select value={formData.template_type} onValueChange={handleTemplateTypeChange}>
                              <SelectTrigger>
                                <SelectValue placeholder={t("admin.emailTemplates.form.selectTemplateType")} />
                              </SelectTrigger>
                              <SelectContent>
                                {TEMPLATE_TYPES.map((type) => (
                                  <SelectItem key={type.value} value={type.value}>
                                    {type.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        
                        {/* Template Type Info */}
                        {selectedTemplateInfo && (
                          <Alert>
                            <Info className="h-4 w-4" />
                            <AlertDescription>
                              <strong>{selectedTemplateInfo.label}:</strong> {selectedTemplateInfo.description}
                            </AlertDescription>
                          </Alert>
                        )}

                        <div>
                          <Label htmlFor="subject">{t("admin.emailTemplates.form.emailSubject")}</Label>
                          <Input
                            id="subject"
                            value={formData.subject}
                            onChange={(e) =>
                              setFormData({ ...formData, subject: e.target.value })
                            }
                            placeholder={t("admin.emailTemplates.form.emailSubjectPlaceholder")}
                          />
                          <p className="text-xs text-muted-foreground mt-1">
                            {t("admin.emailTemplates.form.subjectVariablesHint")}
                          </p>
                        </div>

                        <div>
                          <Label htmlFor="body">{t("admin.emailTemplates.form.emailBody")}</Label>
                          <RichTextEditor
                            value={formData.body}
                            onChange={(html) => setFormData({ ...formData, body: html })}
                            placeholder={t("admin.emailTemplates.form.emailBodyPlaceholder")}
                            maxLength={10000}
                            enableProfessionalTemplate={true}
                            templateTitle={undefined}
                            initialWrapperState={formData.use_wrapper_in_editor} // Phase 3: Pass wrapper state
                            onWrapperStateChange={(state) => setFormData({ ...formData, use_wrapper_in_editor: state })} // Phase 3: Handle wrapper changes
                            onEditorReady={handleEditorReady}
                          />
                          <Alert className="mt-3">
                            <Sparkles className="h-4 w-4" />
                            <AlertDescription>
                              <strong>{t("admin.emailTemplates.form.proTips")}:</strong>
                              <ul className="list-disc list-inside text-xs mt-2 space-y-1">
                                <li>{t("admin.emailTemplates.form.proTip1")}</li>
                                <li>{t("admin.emailTemplates.form.proTip2")}</li>
                                <li>{t("admin.emailTemplates.form.proTip3")}</li>
                              </ul>
                            </AlertDescription>
                          </Alert>
                        </div>

                        <div className="flex items-center space-x-2">
                          <Switch
                            id="is_active"
                            checked={formData.is_active}
                            onCheckedChange={(checked) =>
                              setFormData({ ...formData, is_active: checked })
                            }
                          />
                          <Label htmlFor="is_active">{t("admin.emailTemplates.form.activeTemplate")}</Label>
                        </div>
                        </div>
                      </div>

                      <DialogFooter className="flex-shrink-0 border-t px-6 py-4 bg-background">
                        <Button variant="outline" onClick={() => setDialogOpen(false)}>
                          {t("common.cancel")}
                        </Button>
                        <Button onClick={handleSave}>
                          {editingTemplate ? t("admin.emailTemplates.update") : t("admin.emailTemplates.create")} {t("admin.emailTemplates.template")}
                        </Button>
                      </DialogFooter>
                    </div>
                    
                    {/* Right Side: Variable Sidebar */}
                    <div className="w-80 bg-muted/30 flex flex-col overflow-hidden">
                      <div className="flex-shrink-0 bg-muted/30 p-4 pb-3 border-b">
                        <h3 className="font-semibold text-sm flex items-center gap-2">
                          <Sparkles className="h-4 w-4" />
                          {t("admin.emailTemplates.availableVariables")}
                        </h3>
                        <p className="text-xs text-muted-foreground mt-1">
                          {t("admin.emailTemplates.variablesHint")}
                        </p>
                      </div>
                      
                      <ScrollArea className="flex-1 px-4">
                        <Accordion type="multiple" className="space-y-2">
                          {Object.entries(ALL_AVAILABLE_VARIABLES).map(([category, variables]) => (
                            <AccordionItem key={category} value={category}>
                              <AccordionTrigger className="text-sm font-medium hover:no-underline">
                                {category} ({variables.length})
                              </AccordionTrigger>
                              <AccordionContent>
                                <div className="space-y-1.5">
                                  {variables.map((variable) => (
                                    <div key={variable.name} className="flex items-center gap-1">
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="flex-1 justify-start text-left h-auto py-2 px-3 hover:bg-accent"
                                        onClick={() => copyVariableToClipboard(variable.name)}
                                        title={t("admin.emailTemplates.clickToCopy")}
                                      >
                                        <div className="flex-1">
                                          <div className="flex items-center gap-2">
                                            <code className="text-xs font-mono bg-primary/10 px-1.5 py-0.5 rounded">
                                              {`{{${variable.name}}}`}
                                            </code>
                                            <Copy className="h-3 w-3 text-muted-foreground" />
                                          </div>
                                          <p className="text-xs text-muted-foreground mt-0.5">
                                            {variable.description}
                                          </p>
                                        </div>
                                      </Button>
                                      <Button
                                        variant="outline"
                                        size="icon"
                                        className="h-8 w-8 flex-shrink-0"
                                        onClick={() => insertVariableIntoEditor(variable.name)}
                                        title={t("admin.emailTemplates.insertIntoEditor")}
                                      >
                                        <Plus className="h-3.5 w-3.5" />
                                      </Button>
                                    </div>
                                  ))}
                                </div>
                              </AccordionContent>
                            </AccordionItem>
                          ))}
                        </Accordion>
                      </ScrollArea>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("admin.emailTemplates.tableHeaders.name")}</TableHead>
                    <TableHead>{t("admin.emailTemplates.tableHeaders.subject")}</TableHead>
                    <TableHead>{t("admin.emailTemplates.tableHeaders.type")}</TableHead>
                    <TableHead>{t("admin.emailTemplates.tableHeaders.variables")}</TableHead>
                    <TableHead>{t("admin.emailTemplates.tableHeaders.status")}</TableHead>
                    <TableHead className="text-right">{t("admin.emailTemplates.tableHeaders.actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {templates.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground">
                        {t("admin.emailTemplates.noTemplatesFound")}
                      </TableCell>
                    </TableRow>
                  ) : (
                    templates.map((template) => (
                      <TableRow key={template.id}>
                        <TableCell className="font-medium">{template.name}</TableCell>
                        <TableCell className="max-w-[200px] truncate">
                          {template.subject}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{template.template_type}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1 flex-wrap">
                            {template.variables?.slice(0, 3).map((variable) => (
                              <Badge key={variable} variant="secondary" className="text-xs">
                                {variable}
                              </Badge>
                            ))}
                            {template.variables?.length > 3 && (
                              <Badge variant="secondary" className="text-xs">
                                +{template.variables.length - 3}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={template.is_active}
                              onCheckedChange={() => handleToggleActive(template)}
                            />
                            <Badge variant={template.is_active ? "default" : "secondary"}>
                              {template.is_active ? t("admin.emailTemplates.active") : t("admin.emailTemplates.inactive")}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openPreview(template)}
                        title={t("admin.emailTemplates.previewTemplate")}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openTestEmailDialog(template)}
                        title={t("admin.emailTemplates.sendTestEmail")}
                      >
                        <Mail className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditDialog(template)}
                        title={t("admin.emailTemplates.editTemplateTooltip")}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(template.id)}
                              title={t("admin.emailTemplates.deleteTemplateTooltip")}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Enhanced Preview Dialog with Desktop/Mobile Toggle */}
        <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
          <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <div className="flex items-center justify-between">
                <div>
                  <DialogTitle className="flex items-center gap-2">
                    <Eye className="h-5 w-5" />
                    {t("admin.emailTemplates.preview.title")}
                  </DialogTitle>
                  <DialogDescription>
                    {previewTemplate?.name} - {previewTemplate?.subject}
                  </DialogDescription>
                </div>
                {/* Desktop/Mobile Toggle */}
                <div className="flex items-center gap-2 bg-muted p-1 rounded-lg">
                  <Button
                    variant={previewMode === 'desktop' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setPreviewMode('desktop')}
                    className="h-8 gap-2"
                  >
                    <Monitor className="h-4 w-4" />
                    <span className="hidden sm:inline">Desktop</span>
                  </Button>
                  <Button
                    variant={previewMode === 'mobile' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setPreviewMode('mobile')}
                    className="h-8 gap-2"
                  >
                    <Smartphone className="h-4 w-4" />
                    <span className="hidden sm:inline">Mobile</span>
                  </Button>
                </div>
              </div>
            </DialogHeader>

            <Tabs defaultValue="preview" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="preview">{t("admin.emailTemplates.preview.visualPreview")}</TabsTrigger>
                <TabsTrigger value="code">{t("admin.emailTemplates.preview.htmlCode")}</TabsTrigger>
              </TabsList>
              
              <TabsContent value="preview" className="space-y-4">
                {/* Subject Preview */}
                <div>
                  <Label className="text-sm font-semibold">{t("admin.emailTemplates.preview.emailSubject")}</Label>
                  <div className="mt-2 p-3 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 border rounded-lg">
                    <p className="font-medium text-sm">
                      {previewTemplate ? populateSampleData(previewTemplate.subject) : ''}
                    </p>
                  </div>
                </div>

                {/* Email Body Preview */}
                <div>
                  <Label className="text-sm font-semibold mb-2 block">{t("admin.emailTemplates.preview.emailBody")}</Label>
                  <div className="relative">
                    {/* Preview Container with Device Frame */}
                    <div 
                      className={`
                        mx-auto transition-all duration-300 border rounded-lg overflow-hidden
                        ${previewMode === 'mobile' ? 'max-w-[375px]' : 'max-w-full'}
                      `}
                      style={{
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
                      }}
                    >
                      {/* Device Header (for mobile view) */}
                      {previewMode === 'mobile' && (
                        <div className="bg-gray-800 px-4 py-2 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-green-500"></div>
                            <span className="text-white text-xs font-medium">Gmail</span>
                          </div>
                          <div className="text-white text-xs">9:41 AM</div>
                        </div>
                      )}
                      
                      {/* Email Content */}
                      <div 
                        className="bg-card p-4 overflow-auto"
                        style={{ 
                          maxHeight: previewMode === 'mobile' ? '600px' : '700px',
                          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif'
                        }}
                        dangerouslySetInnerHTML={{ 
                          __html: previewTemplate ? populateSampleData(previewTemplate.body) : "" 
                        }}
                      />
                    </div>
                    
                    {/* Preview Info Badge */}
                    <div className="mt-3 flex items-center justify-center gap-2 text-xs text-muted-foreground">
                      <Info className="h-3 w-3" />
                      <span>{t("admin.emailTemplates.preview.sampleDataNote")}</span>
                    </div>
                  </div>
                </div>

                {/* Variables Used */}
                {previewTemplate?.variables && previewTemplate.variables.length > 0 && (
                  <div>
                    <Label className="text-sm font-semibold">{t("admin.emailTemplates.preview.variablesUsed")}</Label>
                    <div className="mt-2 flex gap-2 flex-wrap p-3 bg-muted/50 rounded-lg border">
                      {previewTemplate.variables.map((variable) => (
                        <Badge key={variable} variant="secondary" className="font-mono text-xs">
                          {`{{${variable}}}`}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </TabsContent>
              
              <TabsContent value="code" className="space-y-4">
                <div>
                  <Label className="text-sm font-semibold mb-2 block">{t("admin.emailTemplates.preview.rawHtmlCode")}</Label>
                  <Textarea
                    value={previewTemplate?.body || ''}
                    readOnly
                    className="font-mono text-xs h-[500px] bg-slate-950 text-green-400 border-slate-800"
                  />
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="mt-2"
                    onClick={() => {
                      navigator.clipboard.writeText(previewTemplate?.body || '');
                      toast.success(t("admin.emailTemplates.preview.htmlCopied"));
                    }}
                  >
                    {t("admin.emailTemplates.preview.copyHtmlCode")}
                  </Button>
                </div>
              </TabsContent>
            </Tabs>

            <DialogFooter>
              <Button variant="outline" onClick={() => setPreviewOpen(false)}>{t("common.close")}</Button>
              <Button onClick={() => {
                setPreviewOpen(false);
                if (previewTemplate) openEditDialog(previewTemplate);
              }}>
                <Edit className="h-4 w-4 mr-2" />
                {t("admin.emailTemplates.editTemplate")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Test Email Dialog */}
        <Dialog open={testEmailDialog} onOpenChange={setTestEmailDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{t("admin.emailTemplates.testEmail.title")} - {testingTemplate?.name}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {testingTemplate && (
                <>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{testingTemplate.template_type}</Badge>
                    {testingTemplate.is_active ? (
                      <Badge variant="default">{t("admin.emailTemplates.active")}</Badge>
                    ) : (
                      <Badge variant="secondary">{t("admin.emailTemplates.inactive")}</Badge>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium">{t("admin.emailTemplates.testEmail.subjectPreview")}</Label>
                    <p className="text-sm text-muted-foreground border rounded-md p-3 bg-muted/50">
                      {testingTemplate.subject}
                    </p>
                  </div>

                  {testingTemplate.variables && testingTemplate.variables.length > 0 && (
                    <Alert>
                      <Info className="h-4 w-4" />
                      <div className="ml-2">
                        <p className="text-sm font-medium">{t("admin.emailTemplates.testEmail.availableVariables")}:</p>
                        <div className="flex flex-wrap gap-2 mt-2">
                          {testingTemplate.variables.map((variable) => (
                            <Badge key={variable} variant="secondary">
                              {`{{${variable}}}`}
                            </Badge>
                          ))}
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">
                          {t("admin.emailTemplates.testEmail.variablesNote")}
                        </p>
                      </div>
                    </Alert>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="test-email">{t("admin.emailTemplates.testEmail.testEmailAddress")}</Label>
                    <Input
                      id="test-email"
                      type="email"
                      placeholder={t("admin.emailTemplates.testEmail.emailPlaceholder")}
                      value={testEmailAddress}
                      onChange={(e) => setTestEmailAddress(e.target.value)}
                      disabled={sendingTest}
                    />
                    <p className="text-xs text-muted-foreground">
                      {t("admin.emailTemplates.testEmail.emailHint")}
                    </p>
                  </div>

                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <div className="ml-2">
                      <p className="text-sm font-medium">{t("admin.emailTemplates.testEmail.sampleData")}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {t("admin.emailTemplates.testEmail.sampleDataDescription")}
                      </p>
                      <ul className="text-xs text-muted-foreground mt-2 space-y-1 list-disc list-inside">
                        <li>{t("admin.emailTemplates.testEmail.sampleUsername")}</li>
                        <li>{t("admin.emailTemplates.testEmail.sampleEmail", { email: testEmailAddress || t("admin.emailTemplates.testEmail.yourEmail") })}</li>
                        <li>{t("admin.emailTemplates.testEmail.sampleFullName")}</li>
                        <li>{t("admin.emailTemplates.testEmail.sampleLinks")}</li>
                        <li>{t("admin.emailTemplates.testEmail.samplePlanDetails")}</li>
                      </ul>
                    </div>
                  </Alert>
                </>
              )}

              <div className="flex justify-end gap-2 pt-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    setTestEmailDialog(false);
                    setTestEmailAddress("");
                    setTestingTemplateId(null);
                    setTestingTemplate(null);
                  }}
                  disabled={sendingTest}
                >
                  {t("common.cancel")}
                </Button>
                <Button
                  onClick={handleSendTest}
                  disabled={!testEmailAddress || sendingTest}
                >
                  {sendingTest ? (
                    <>
                      <span className="animate-spin mr-2">⏳</span>
                      {t("admin.emailTemplates.testEmail.sending")}
                    </>
                  ) : (
                    <>
                      <Mail className="h-4 w-4 mr-2" />
                      {t("admin.emailTemplates.testEmail.sendTestEmail")}
                    </>
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default EmailTemplates;
