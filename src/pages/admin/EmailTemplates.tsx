import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";
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
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdmin();
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewMode, setPreviewMode] = useState<'desktop' | 'mobile'>('desktop');
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null);
  const [previewTemplate, setPreviewTemplate] = useState<EmailTemplate | null>(null);
  const [testEmailDialog, setTestEmailDialog] = useState(false);
  const [testEmailAddress, setTestEmailAddress] = useState("");
  const [testingTemplateId, setTestingTemplateId] = useState<string | null>(null);
  const [testingTemplate, setTestingTemplate] = useState<EmailTemplate | null>(null);
  const [sendingTest, setSendingTest] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    subject: "",
    body: "",
    template_type: "",
    variables: "",
    is_active: true,
    use_wrapper_in_editor: false, // Phase 3: Track wrapper toggle state
  });
  
  // Ref to hold the insertVariable function from RichTextEditor
  const insertVariableRef = useRef<((variableName: string) => void) | null>(null);
  
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
      platform_url: "https://fineearn.com",
      
      // Auth variables
      reset_link: "https://fineearn.com/reset-password?token=sample",
      confirmation_link: "https://fineearn.com/confirm-email?token=sample",
      magic_link: "https://fineearn.com/magic-link?token=sample",
      token_hash: "abc123def456",
      redirect_to: "https://fineearn.com/dashboard",
      old_email: "old.email@example.com",
      new_email: "new.email@example.com"
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
  
  const selectedTemplateInfo = getTemplateInfo(formData.template_type);

  // Copy variable to clipboard
  const copyVariableToClipboard = (variableName: string) => {
    const formattedVariable = `{{${variableName}}}`;
    navigator.clipboard.writeText(formattedVariable);
    toast.success(`Copied ${formattedVariable} to clipboard!`);
  };

  // Insert variable directly into editor
  const insertVariableIntoEditor = useCallback((variableName: string) => {
    if (insertVariableRef.current) {
      insertVariableRef.current(variableName);
      toast.success(`{{${variableName}}} added to editor`);
    }
  }, [toast]);

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
      toast.error("Access denied. Admin privileges required.");
      navigate("/dashboard");
    }
  }, [isAdmin, adminLoading, navigate]);

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
      toast.error("Failed to load email templates");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      if (!formData.name || !formData.subject || !formData.body || !formData.template_type) {
        toast.error("Please fill in all required fields");
        return;
      }

      let variables;
      try {
        variables = JSON.parse(formData.variables);
      } catch {
        toast.error("Invalid JSON format for variables. Use format: [\"var1\", \"var2\"]");
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
        toast.success("Template updated successfully");
      } else {
        const { error } = await supabase
          .from("email_templates")
          .insert([templateData]);

        if (error) throw error;
        toast.success("Template created successfully");
      }

      setDialogOpen(false);
      setEditingTemplate(null);
      resetForm();
      loadTemplates();
    } catch (error: any) {
      console.error("Error saving template:", error);
      toast.error(error.message || "Failed to save template");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this template?")) {
      return;
    }

    try {
      const { error } = await supabase
        .from("email_templates")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast.success("Template deleted");
      loadTemplates();
    } catch (error: any) {
      console.error("Error deleting template:", error);
      toast.error("Failed to delete template");
    }
  };

  const handleToggleActive = async (template: EmailTemplate) => {
    try {
      const { error } = await supabase
        .from("email_templates")
        .update({ is_active: !template.is_active })
        .eq("id", template.id);

      if (error) throw error;

      toast.success(`Template ${!template.is_active ? "activated" : "deactivated"}`);
      loadTemplates();
    } catch (error: any) {
      console.error("Error toggling template:", error);
      toast.error("Failed to update template");
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
      toast.error("Please enter a valid email address");
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

      toast.success(`Test email sent to ${testEmailAddress}!`, {
        description: "Check your inbox to verify the email.",
      });
      
      setTestEmailDialog(false);
      setTestEmailAddress("");
      setTestingTemplateId(null);
      setTestingTemplate(null);
    } catch (error: any) {
      console.error("Error sending test email:", error);
      toast.error("Failed to send test email", {
        description: error.message || "An unexpected error occurred",
      });
    } finally {
      setSendingTest(false);
    }
  };

  if (authLoading || adminLoading || loading) {
    return (
      <div className="min-h-screen bg-[hsl(0,0%,98%)] flex items-center justify-center">
        <LoadingSpinner size="lg" text="Loading templates..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[hsl(0,0%,98%)]">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <Button variant="ghost" onClick={() => navigate("/admin")} className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Admin
          </Button>

          <h1 className="text-3xl font-bold mb-2">Email Template Management</h1>
          <p className="text-muted-foreground">
            Create and manage reusable email templates
          </p>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Email Templates</CardTitle>
                <CardDescription>
                  {templates.length} template{templates.length !== 1 ? "s" : ""} available
                </CardDescription>
              </div>
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button onClick={openAddDialog}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Template
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-[95vw] w-full max-h-[92vh] p-0 flex flex-col">
                  <div className="flex flex-1 min-h-0">
                    {/* Left Side: Editor */}
                    <div className="flex-1 flex flex-col overflow-hidden border-r">
                      <DialogHeader>
                        <DialogTitle>
                          {editingTemplate ? "Edit" : "Create"} Email Template
                        </DialogTitle>
                        <DialogDescription>
                          Configure template details and content
                        </DialogDescription>
                      </DialogHeader>

                      <div className="flex-1 overflow-y-auto px-6 pb-6">
                        <div className="space-y-4 mt-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor="name">Template Name *</Label>
                            <Input
                              id="name"
                              value={formData.name}
                              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                              placeholder="e.g., password_reset_notification"
                            />
                          </div>

                          <div>
                            <Label htmlFor="type">Template Type *</Label>
                            <Select value={formData.template_type} onValueChange={handleTemplateTypeChange}>
                              <SelectTrigger>
                                <SelectValue placeholder="Select template type" />
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
                          <Label htmlFor="subject">Email Subject *</Label>
                          <Input
                            id="subject"
                            value={formData.subject}
                            onChange={(e) =>
                              setFormData({ ...formData, subject: e.target.value })
                            }
                            placeholder="e.g., Reset Your Password"
                          />
                          <p className="text-xs text-muted-foreground mt-1">
                            You can use variables like {`{{username}}`} in the subject
                          </p>
                        </div>

                        <div>
                          <Label htmlFor="body">Email Body *</Label>
                          <RichTextEditor
                            value={formData.body}
                            onChange={(html) => setFormData({ ...formData, body: html })}
                            placeholder="Compose your email content here. Use {{variable}} for placeholders."
                            maxLength={10000}
                            enableProfessionalTemplate={true}
                            templateTitle="FineEarn"
                            initialWrapperState={formData.use_wrapper_in_editor} // Phase 3: Pass wrapper state
                            onWrapperStateChange={(state) => setFormData({ ...formData, use_wrapper_in_editor: state })} // Phase 3: Handle wrapper changes
                            onEditorReady={handleEditorReady}
                          />
                          <Alert className="mt-3">
                            <Sparkles className="h-4 w-4" />
                            <AlertDescription>
                              <strong>Pro Tips:</strong>
                              <ul className="list-disc list-inside text-xs mt-2 space-y-1">
                                <li>Toggle "Professional Template" above for beautiful email styling</li>
                                <li>Use the ✨ button in toolbar to insert styled buttons</li>
                                <li>Click variables to copy, or use + button to insert directly</li>
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
                          <Label htmlFor="is_active">Active Template</Label>
                        </div>
                        </div>
                      </div>

                      <DialogFooter className="flex-shrink-0 border-t px-6 py-4 bg-background">
                        <Button variant="outline" onClick={() => setDialogOpen(false)}>
                          Cancel
                        </Button>
                        <Button onClick={handleSave}>
                          {editingTemplate ? "Update" : "Create"} Template
                        </Button>
                      </DialogFooter>
                    </div>
                    
                    {/* Right Side: Variable Sidebar */}
                    <div className="w-80 bg-muted/30 flex flex-col overflow-hidden">
                      <div className="flex-shrink-0 bg-muted/30 p-4 pb-3 border-b">
                        <h3 className="font-semibold text-sm flex items-center gap-2">
                          <Sparkles className="h-4 w-4" />
                          Available Variables
                        </h3>
                        <p className="text-xs text-muted-foreground mt-1">
                          Click to copy or use + to insert directly
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
                                        title="Click to copy"
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
                                        title="Insert into editor"
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
                    <TableHead>Name</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Variables</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {templates.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground">
                        No templates found
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
                              {template.is_active ? "Active" : "Inactive"}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openPreview(template)}
                        title="Preview Template"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openTestEmailDialog(template)}
                        title="Send Test Email"
                      >
                        <Mail className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditDialog(template)}
                        title="Edit Template"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(template.id)}
                              title="Delete Template"
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
                    Template Preview
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
                <TabsTrigger value="preview">Visual Preview</TabsTrigger>
                <TabsTrigger value="code">HTML Code</TabsTrigger>
              </TabsList>
              
              <TabsContent value="preview" className="space-y-4">
                {/* Subject Preview */}
                <div>
                  <Label className="text-sm font-semibold">Email Subject</Label>
                  <div className="mt-2 p-3 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 border rounded-lg">
                    <p className="font-medium text-sm">
                      {previewTemplate ? populateSampleData(previewTemplate.subject) : ''}
                    </p>
                  </div>
                </div>

                {/* Email Body Preview */}
                <div>
                  <Label className="text-sm font-semibold mb-2 block">Email Body</Label>
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
                        className="bg-white p-4 overflow-auto"
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
                      <span>Preview shows sample data for all variables</span>
                    </div>
                  </div>
                </div>

                {/* Variables Used */}
                {previewTemplate?.variables && previewTemplate.variables.length > 0 && (
                  <div>
                    <Label className="text-sm font-semibold">Variables Used</Label>
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
                  <Label className="text-sm font-semibold mb-2 block">Raw HTML Code</Label>
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
                      toast.success('HTML code copied to clipboard!');
                    }}
                  >
                    Copy HTML Code
                  </Button>
                </div>
              </TabsContent>
            </Tabs>

            <DialogFooter>
              <Button variant="outline" onClick={() => setPreviewOpen(false)}>Close</Button>
              <Button onClick={() => {
                setPreviewOpen(false);
                if (previewTemplate) openEditDialog(previewTemplate);
              }}>
                <Edit className="h-4 w-4 mr-2" />
                Edit Template
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Test Email Dialog */}
        <Dialog open={testEmailDialog} onOpenChange={setTestEmailDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Send Test Email - {testingTemplate?.name}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {testingTemplate && (
                <>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{testingTemplate.template_type}</Badge>
                    {testingTemplate.is_active ? (
                      <Badge variant="default">Active</Badge>
                    ) : (
                      <Badge variant="secondary">Inactive</Badge>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Subject Preview</Label>
                    <p className="text-sm text-muted-foreground border rounded-md p-3 bg-muted/50">
                      {testingTemplate.subject}
                    </p>
                  </div>

                  {testingTemplate.variables && testingTemplate.variables.length > 0 && (
                    <Alert>
                      <Info className="h-4 w-4" />
                      <div className="ml-2">
                        <p className="text-sm font-medium">Available Variables:</p>
                        <div className="flex flex-wrap gap-2 mt-2">
                          {testingTemplate.variables.map((variable) => (
                            <Badge key={variable} variant="secondary">
                              {`{{${variable}}}`}
                            </Badge>
                          ))}
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">
                          These variables will be replaced with sample data in the test email.
                        </p>
                      </div>
                    </Alert>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="test-email">Test Email Address *</Label>
                    <Input
                      id="test-email"
                      type="email"
                      placeholder="your.email@example.com"
                      value={testEmailAddress}
                      onChange={(e) => setTestEmailAddress(e.target.value)}
                      disabled={sendingTest}
                    />
                    <p className="text-xs text-muted-foreground">
                      Enter the email address where you want to receive the test email.
                    </p>
                  </div>

                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <div className="ml-2">
                      <p className="text-sm font-medium">Sample Data</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        The test email will use predefined sample data for all variables:
                      </p>
                      <ul className="text-xs text-muted-foreground mt-2 space-y-1 list-disc list-inside">
                        <li>Username: TestUser</li>
                        <li>Email: {testEmailAddress || "your email"}</li>
                        <li>Full Name: Test User</li>
                        <li>Links: Sample URLs with test tokens</li>
                        <li>Plan details: Premium Plan, $500.00 earnings</li>
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
                  Cancel
                </Button>
                <Button
                  onClick={handleSendTest}
                  disabled={!testEmailAddress || sendingTest}
                >
                  {sendingTest ? (
                    <>
                      <span className="animate-spin mr-2">⏳</span>
                      Sending...
                    </>
                  ) : (
                    <>
                      <Mail className="h-4 w-4 mr-2" />
                      Send Test Email
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
