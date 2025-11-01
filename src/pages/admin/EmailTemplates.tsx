import { useEffect, useState } from "react";
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
import { ArrowLeft, Plus, Edit, Trash2, Eye, Info, Mail, AlertTriangle } from "lucide-react";
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
}

// Predefined auth template types with descriptions and available variables
const AUTH_TEMPLATE_TYPES = [
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
  {
    value: "custom",
    label: "Custom Template",
    description: "Create a custom email template",
    variables: []
  }
] as const;

const EmailTemplates = () => {
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdmin();
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
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
  });
  
  // Get template info based on selected type
  const getTemplateInfo = (type: string) => {
    return AUTH_TEMPLATE_TYPES.find(t => t.value === type);
  };
  
  const selectedTemplateInfo = getTemplateInfo(formData.template_type);

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
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>
                      {editingTemplate ? "Edit" : "Create"} Email Template
                    </DialogTitle>
                    <DialogDescription>
                      Configure template details and content
                    </DialogDescription>
                  </DialogHeader>

                  <div className="space-y-4">
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
                            {AUTH_TEMPLATE_TYPES.map((type) => (
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
                          {selectedTemplateInfo.variables.length > 0 && (
                            <div className="mt-2">
                              <p className="text-sm font-medium">Available variables:</p>
                              <div className="flex flex-wrap gap-1 mt-1">
                                {selectedTemplateInfo.variables.map((variable) => (
                                  <Badge key={variable} variant="secondary" className="text-xs">
                                    {`{{${variable}}}`}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}
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
                      />
                      <p className="text-xs text-muted-foreground mt-2">
                        💡 Tip: Use variables like {`{{username}}`}, {`{{reset_link}}`}, etc. in your content
                      </p>
                    </div>

                    <div>
                      <Label htmlFor="variables">Variables (JSON Array)</Label>
                      <Textarea
                        id="variables"
                        value={formData.variables}
                        onChange={(e) =>
                          setFormData({ ...formData, variables: e.target.value })
                        }
                        placeholder='["username", "email"]'
                        rows={3}
                        className="font-mono text-sm"
                      />
                      <p className="text-sm text-muted-foreground mt-1">
                        Variables are auto-populated for auth templates. Add custom variables if needed.
                      </p>
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

                  <DialogFooter>
                    <Button variant="outline" onClick={() => setDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleSave}>
                      {editingTemplate ? "Update" : "Create"} Template
                    </Button>
                  </DialogFooter>
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

        {/* Preview Dialog */}
        <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Template Preview</DialogTitle>
              <DialogDescription>
                {previewTemplate?.name} - {previewTemplate?.subject}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div>
                <Label>Subject</Label>
                <div className="p-3 bg-muted rounded">{previewTemplate?.subject}</div>
              </div>

              <div>
                <Label>Body</Label>
                <div
                  className="p-4 bg-white border rounded"
                  dangerouslySetInnerHTML={{ __html: previewTemplate?.body || "" }}
                />
              </div>

              <div>
                <Label>Variables</Label>
                <div className="flex gap-2 flex-wrap">
                  {previewTemplate?.variables?.map((variable) => (
                    <Badge key={variable} variant="outline">
                      {`{{${variable}}}`}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button onClick={() => setPreviewOpen(false)}>Close</Button>
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
