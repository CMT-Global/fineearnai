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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowLeft, Send, Clock, Eye, Info, AlertTriangle, History } from "lucide-react";
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

const BulkEmail = () => {
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdmin();
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  
  const [formData, setFormData] = useState({
    subject: "",
    body: "",
    recipientType: "all",
    plan: "",
    country: "",
    usernames: "",
    templateId: "",
    scheduleType: "immediate",
    scheduledDate: "",
    scheduledTime: "",
  });
  
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | null>(null);
  const [recipientCount, setRecipientCount] = useState(0);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);

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

  useEffect(() => {
    if (isAdmin) {
      calculateRecipientCount();
    }
  }, [formData.recipientType, formData.plan, formData.country, formData.usernames, isAdmin]);

  const loadTemplates = async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from("email_templates")
        .select("*")
        .eq("is_active", true)
        .order("name");

      if (error) throw error;

      setTemplates((data || []).map(t => ({ ...t, variables: t.variables as string[] })));
    } catch (error: any) {
      console.error("Error loading templates:", error);
      toast.error("Failed to load email templates");
    } finally {
      setLoading(false);
    }
  };

  const calculateRecipientCount = async () => {
    try {
      let query = supabase.from("profiles").select("*", { count: "exact", head: true });

      if (formData.recipientType === "plan" && formData.plan) {
        query = query.eq("membership_plan", formData.plan);
      } else if (formData.recipientType === "country" && formData.country) {
        query = query.eq("country", formData.country);
      } else if (formData.recipientType === "usernames" && formData.usernames) {
        const usernames = formData.usernames.split(",").map((u) => u.trim());
        query = query.in("username", usernames);
      }

      const { count } = await query;
      setRecipientCount(count || 0);
    } catch (error: any) {
      console.error("Error calculating recipients:", error);
    }
  };

  const handleTemplateSelect = (templateId: string) => {
    if (!templateId || templateId === "none") {
      setSelectedTemplate(null);
      setFormData({
        ...formData,
        templateId: "",
      });
      return;
    }
    
    const template = templates.find((t) => t.id === templateId);
    if (template) {
      setSelectedTemplate(template);
      setFormData({
        ...formData,
        templateId,
        subject: template.subject,
        body: template.body,
      });
    }
  };
  
  const getPreviewContent = () => {
    let content = formData.body;
    
    // Replace common variables for preview
    content = content.replace(/{{username}}/g, '<strong>[Username]</strong>');
    content = content.replace(/{{email}}/g, '<strong>[user@example.com]</strong>');
    content = content.replace(/{{full_name}}/g, '<strong>[Full Name]</strong>');
    
    return content;
  };

  const handleSend = async () => {
    try {
      if (!formData.subject || !formData.body) {
        toast.error("Please fill in subject and body");
        return;
      }

      if (formData.recipientType === "plan" && !formData.plan) {
        toast.error("Please select a membership plan");
        return;
      }

      if (formData.recipientType === "country" && !formData.country) {
        toast.error("Please enter a country");
        return;
      }

      if (formData.recipientType === "usernames" && !formData.usernames) {
        toast.error("Please enter usernames");
        return;
      }

      if (recipientCount === 0) {
        toast.error("No recipients found matching criteria");
        return;
      }

      if (formData.scheduleType === "scheduled") {
        if (!formData.scheduledDate || !formData.scheduledTime) {
          toast.error("Please select schedule date and time");
          return;
        }
      }

      setSending(true);

      if (formData.scheduleType === "scheduled") {
        // Schedule email
        const scheduledFor = new Date(
          `${formData.scheduledDate}T${formData.scheduledTime}`
        ).toISOString();

        const { error } = await supabase.from("scheduled_emails").insert([
          {
            subject: formData.subject,
            body: formData.body,
            recipient_filter: {
              type: formData.recipientType,
              plan: formData.plan,
              country: formData.country,
              usernames: formData.usernames,
            },
            template_id: formData.templateId || null,
            scheduled_for: scheduledFor,
            created_by: user?.id,
          },
        ]);

        if (error) throw error;

        toast.success(
          `Email scheduled for ${new Date(scheduledFor).toLocaleString()}`
        );
      } else {
        // Send immediately
        const { error } = await supabase.functions.invoke("send-bulk-email", {
          body: {
            subject: formData.subject,
            body: formData.body,
            recipientType: formData.recipientType,
            plan: formData.plan,
            country: formData.country,
            usernames: formData.usernames,
          },
        });

        if (error) throw error;

        toast.success(`Bulk email sent to ${recipientCount} recipients!`);
      }

      // Reset form
      setFormData({
        subject: "",
        body: "",
        recipientType: "all",
        plan: "",
        country: "",
        usernames: "",
        templateId: "",
        scheduleType: "immediate",
        scheduledDate: "",
        scheduledTime: "",
      });
    } catch (error: any) {
      console.error("Error sending email:", error);
      toast.error(error.message || "Failed to send email");
    } finally {
      setSending(false);
    }
  };

  const getPreviewHtml = () => {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; padding: 20px; }
            h1 { color: #333; }
          </style>
        </head>
        <body>
          ${formData.body}
        </body>
      </html>
    `;
  };

  if (authLoading || adminLoading || loading) {
    return (
      <div className="min-h-screen bg-[hsl(0,0%,98%)] flex items-center justify-center">
        <LoadingSpinner size="lg" text="Loading..." />
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

          <h1 className="text-3xl font-bold mb-2">Bulk Email System</h1>
          <p className="text-muted-foreground">
            Send emails to users based on various criteria
          </p>
        </div>

        {/* Main Tabs */}
        <Tabs defaultValue="compose" className="space-y-6">
          <TabsList className="grid w-full max-w-md grid-cols-3">
            <TabsTrigger value="compose">
              <Send className="h-4 w-4 mr-2" />
              Compose
            </TabsTrigger>
            <TabsTrigger value="history">
              <History className="h-4 w-4 mr-2" />
              History
            </TabsTrigger>
            <TabsTrigger value="best-practices">
              <Info className="h-4 w-4 mr-2" />
              Best Practices
            </TabsTrigger>
          </TabsList>

          {/* Compose Tab */}
          <TabsContent value="compose">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Compose Form */}
              <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Compose Email</CardTitle>
                <CardDescription>
                  Create and send bulk emails to your users
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Template Selection */}
                <div>
                  <Label htmlFor="template">Use Template (Optional)</Label>
                  <Select
                    value={formData.templateId}
                    onValueChange={handleTemplateSelect}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a template" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No Template</SelectItem>
                      {templates.map((template) => (
                        <SelectItem key={template.id} value={template.id}>
                          {template.name} - {template.subject}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Subject */}
                <div>
                  <Label htmlFor="subject">Subject *</Label>
                  <Input
                    id="subject"
                    value={formData.subject}
                    onChange={(e) =>
                      setFormData({ ...formData, subject: e.target.value })
                    }
                    placeholder="Email subject"
                  />
                </div>

                {/* Template Variables Info */}
                {selectedTemplate && selectedTemplate.variables.length > 0 && (
                  <Alert>
                    <Info className="h-4 w-4" />
                    <AlertDescription>
                      <strong>Available Variables:</strong> These will be automatically replaced for each recipient.
                      <div className="flex flex-wrap gap-1 mt-2">
                        {selectedTemplate.variables.map((variable) => (
                          <Badge key={variable} variant="secondary" className="text-xs">
                            {`{{${variable}}}`}
                          </Badge>
                        ))}
                      </div>
                    </AlertDescription>
                  </Alert>
                )}

                {/* Body */}
                <div>
                  <Label htmlFor="body">Email Body *</Label>
                  <RichTextEditor
                    value={formData.body}
                    onChange={(html) => setFormData({ ...formData, body: html })}
                    placeholder="Compose your email content. Use {{variable}} for personalization."
                    maxLength={20000}
                  />
                  <p className="text-sm text-muted-foreground mt-2">
                    💡 Use variables like {`{{username}}`}, {`{{email}}`}, {`{{full_name}}`} for personalization
                  </p>
                </div>

                {/* Preview Button */}
                <Button
                  variant="outline"
                  onClick={() => setPreviewDialogOpen(true)}
                  className="w-full"
                  disabled={!formData.subject || !formData.body}
                >
                  <Eye className="mr-2 h-4 w-4" />
                  Preview Email
                </Button>

                {/* Recipient Selection */}
                <div>
                  <Label>Recipients *</Label>
                  <Tabs
                    value={formData.recipientType}
                    onValueChange={(value) =>
                      setFormData({ ...formData, recipientType: value })
                    }
                  >
                    <TabsList className="grid w-full grid-cols-4">
                      <TabsTrigger value="all">All Users</TabsTrigger>
                      <TabsTrigger value="plan">By Plan</TabsTrigger>
                      <TabsTrigger value="country">By Country</TabsTrigger>
                      <TabsTrigger value="usernames">By Username</TabsTrigger>
                    </TabsList>

                    <TabsContent value="all" className="mt-4">
                      <p className="text-sm text-muted-foreground">
                        Email will be sent to all registered users
                      </p>
                    </TabsContent>

                    <TabsContent value="plan" className="mt-4">
                      <Select
                        value={formData.plan}
                        onValueChange={(value) =>
                          setFormData({ ...formData, plan: value })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select membership plan" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="free">Free</SelectItem>
                          <SelectItem value="basic">Basic</SelectItem>
                          <SelectItem value="premium">Premium</SelectItem>
                          <SelectItem value="vip">VIP</SelectItem>
                        </SelectContent>
                      </Select>
                    </TabsContent>

                    <TabsContent value="country" className="mt-4">
                      <Input
                        value={formData.country}
                        onChange={(e) =>
                          setFormData({ ...formData, country: e.target.value })
                        }
                        placeholder="Enter country name"
                      />
                    </TabsContent>

                    <TabsContent value="usernames" className="mt-4">
                      <Textarea
                        value={formData.usernames}
                        onChange={(e) =>
                          setFormData({ ...formData, usernames: e.target.value })
                        }
                        placeholder="Enter usernames separated by commas"
                        rows={3}
                      />
                      <p className="text-sm text-muted-foreground mt-2">
                        Example: user1, user2, user3
                      </p>
                    </TabsContent>
                  </Tabs>
                </div>

                {/* Schedule Options */}
                <div>
                  <Label>Send Options</Label>
                  <Tabs
                    value={formData.scheduleType}
                    onValueChange={(value) =>
                      setFormData({ ...formData, scheduleType: value })
                    }
                  >
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="immediate">Send Now</TabsTrigger>
                      <TabsTrigger value="scheduled">Schedule</TabsTrigger>
                    </TabsList>

                    <TabsContent value="immediate" className="mt-4">
                      <p className="text-sm text-muted-foreground">
                        Email will be sent immediately
                      </p>
                    </TabsContent>

                    <TabsContent value="scheduled" className="mt-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="date">Date</Label>
                          <Input
                            id="date"
                            type="date"
                            value={formData.scheduledDate}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                scheduledDate: e.target.value,
                              })
                            }
                          />
                        </div>
                        <div>
                          <Label htmlFor="time">Time</Label>
                          <Input
                            id="time"
                            type="time"
                            value={formData.scheduledTime}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                scheduledTime: e.target.value,
                              })
                            }
                          />
                        </div>
                      </div>
                    </TabsContent>
                  </Tabs>
                </div>

                {/* Send Button */}
                <Button
                  onClick={handleSend}
                  disabled={sending || recipientCount === 0}
                  className="w-full"
                  size="lg"
                >
                  {sending ? (
                    <>Loading...</>
                  ) : formData.scheduleType === "scheduled" ? (
                    <>
                      <Clock className="mr-2 h-5 w-5" />
                      Schedule Email
                    </>
                  ) : (
                    <>
                      <Send className="mr-2 h-5 w-5" />
                      Send Email
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Recipient Count */}
            <Card>
              <CardHeader>
                <CardTitle>Recipients</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center">
                  <div className="text-4xl font-bold text-primary mb-2">
                    {recipientCount}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    users will receive this email
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Template Variables */}
            {formData.templateId && (
              <Card>
                <CardHeader>
                  <CardTitle>Template Variables</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {templates
                      .find((t) => t.id === formData.templateId)
                      ?.variables?.map((variable) => (
                        <Badge key={variable} variant="outline">
                          {`{{${variable}}}`}
                        </Badge>
                      ))}
                  </div>
                  <p className="text-sm text-muted-foreground mt-4">
                    These will be automatically replaced with user data
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Tips */}
            <Card>
              <CardHeader>
                <CardTitle>Tips</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="text-sm space-y-2 text-muted-foreground">
                  <li>• Use templates for consistency</li>
                  <li>• Test with a small group first</li>
                  <li>• Schedule emails for optimal times</li>
                  <li>• Keep content clear and concise</li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
        
        {/* Preview Dialog */}
        <Dialog open={previewDialogOpen} onOpenChange={setPreviewDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Email Preview</DialogTitle>
              <DialogDescription>
                This is how your email will appear to recipients. Variables are shown with sample data.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              {/* Subject Preview */}
              <div>
                <Label className="text-sm font-medium">Subject</Label>
                <div className="mt-1 p-3 bg-muted rounded-lg">
                  <p className="font-medium">{formData.subject}</p>
                </div>
              </div>
              
              {/* Recipient Info */}
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  <strong>Note:</strong> Variables like {`{{username}}`} and {`{{email}}`} will be replaced with actual recipient data when sent.
                </AlertDescription>
              </Alert>
              
              {/* Body Preview */}
              <div>
                <Label className="text-sm font-medium">Email Body</Label>
                <div className="mt-1 border rounded-lg bg-white p-6">
                  <div
                    className="prose prose-sm max-w-none"
                    dangerouslySetInnerHTML={{ __html: getPreviewContent() }}
                  />
                </div>
              </div>
              
              {/* Template Variables Used */}
              {selectedTemplate && selectedTemplate.variables.length > 0 && (
                <div>
                  <Label className="text-sm font-medium">Variables in Use</Label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {selectedTemplate.variables.map((variable) => (
                      <Badge key={variable} variant="secondary">
                        {`{{${variable}}}`}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Send Info */}
              <Alert variant="default">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  This email will be sent to <strong>{recipientCount}</strong> recipient{recipientCount !== 1 ? 's' : ''}.
                  {formData.scheduleType === 'scheduled' && formData.scheduledDate && formData.scheduledTime && (
                    <> Scheduled for: <strong>{new Date(`${formData.scheduledDate}T${formData.scheduledTime}`).toLocaleString()}</strong></>
                  )}
                </AlertDescription>
              </Alert>
            </div>
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setPreviewDialogOpen(false)}>
                Close Preview
              </Button>
              <Button onClick={() => {
                setPreviewDialogOpen(false);
                handleSend();
              }} disabled={sending || recipientCount === 0}>
                {formData.scheduleType === 'scheduled' ? (
                  <>
                    <Clock className="mr-2 h-4 w-4" />
                    Schedule Now
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    Send Now
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
          </TabsContent>

          {/* History Tab */}
          <TabsContent value="history">
            <EmailHistoryTab emailType="bulk" />
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

export default BulkEmail;
