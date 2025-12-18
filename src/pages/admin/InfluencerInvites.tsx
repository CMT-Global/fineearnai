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
      toast.error("Access denied. Admin privileges required.");
      navigate("/dashboard");
    }
  }, [isAdmin, adminLoading, navigate]);

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
        toast.error("Influencer invite template not found");
      }
    } catch (error: any) {
      console.error("Error loading template:", error);
      toast.error("Failed to load email template");
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async () => {
    try {
      if (!formData.email || !formData.influencerName) {
        toast.error("Please fill in email and influencer name");
        return;
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email)) {
        toast.error("Please enter a valid email address");
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

      toast.success(`Influencer invite sent successfully to ${formData.email}!`);
      
      // Reset form
      setFormData({
        email: "",
        influencerName: "",
        commissionRate: "15",
        customMessage: "",
      });
    } catch (error: any) {
      console.error("Error sending invite:", error);
      toast.error(error.message || "Failed to send invite");
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
          <strong>Personal Message:</strong><br/>${formData.customMessage}
        </p>
      </div>` + content;
    }
    
    return content;
  };

  if (authLoading || adminLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <LoadingSpinner size="lg" text="Loading..." />
      </div>
    );
  }

  if (!template) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          <Button variant="ghost" onClick={() => navigate("/admin")} className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Admin
          </Button>
          <Alert variant="destructive">
            <AlertDescription>
              Influencer invite template not found. Please contact support.
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
            Back to Admin
          </Button>

          <h1 className="text-3xl font-bold mb-2">Influencer Invites</h1>
          <p className="text-muted-foreground">
            Send personalized invitations to potential influencer partners
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
                    <CardTitle>Send Influencer Invite</CardTitle>
                    <CardDescription>
                      Invite potential partners to join your influencer program
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Email */}
                    <div>
                      <Label htmlFor="email">Influencer Email *</Label>
                      <Input
                        id="email"
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        placeholder="influencer@example.com"
                      />
                    </div>

                    {/* Name */}
                    <div>
                      <Label htmlFor="name">Influencer Name *</Label>
                      <Input
                        id="name"
                        value={formData.influencerName}
                        onChange={(e) => setFormData({ ...formData, influencerName: e.target.value })}
                        placeholder="John Doe"
                      />
                    </div>

                    {/* Commission Rate */}
                    <div>
                      <Label htmlFor="commission">Commission Rate (%)</Label>
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
                        Default: 15% - Adjust based on partnership tier
                      </p>
                    </div>

                    {/* Template Info */}
                    <Alert>
                      <Mail className="h-4 w-4" />
                      <AlertDescription>
                        <strong>Template:</strong> {template.name}
                        <br />
                        <strong>Subject:</strong> {template.subject}
                      </AlertDescription>
                    </Alert>

                    {/* Custom Message */}
                    <div>
                      <Label htmlFor="message">Personal Message (Optional)</Label>
                      <Textarea
                        id="message"
                        value={formData.customMessage}
                        onChange={(e) => setFormData({ ...formData, customMessage: e.target.value })}
                        placeholder="Add a personal note to the invitation..."
                        rows={4}
                      />
                      <p className="text-sm text-muted-foreground mt-1">
                        This will appear at the top of the email as a highlighted message
                      </p>
                    </div>

                    {/* Available Variables */}
                    <Alert>
                      <Info className="h-4 w-4" />
                      <AlertDescription>
                        <strong>Template Variables:</strong> The template automatically includes:
                        influencer name, commission rate, referral link, and support contact
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
                      Preview Email
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
                          Sending...
                        </>
                      ) : (
                        <>
                          <Send className="mr-2 h-5 w-5" />
                          Send Invite
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
                    <CardTitle>Template Info</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3 text-sm">
                      <div>
                        <p className="text-muted-foreground">Template Name</p>
                        <p className="font-medium">{template.name}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Subject Line</p>
                        <p className="font-medium">{template.subject}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Variables</p>
                        <p className="font-medium">{template.variables.length} variables</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Tips */}
                <Card>
                  <CardHeader>
                    <CardTitle>Best Practices</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="text-sm space-y-2 text-muted-foreground">
                      <li>• Personalize with influencer's name</li>
                      <li>• Adjust commission rate based on tier</li>
                      <li>• Add a personal touch with custom message</li>
                      <li>• Preview before sending</li>
                      <li>• Follow up within 48 hours</li>
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
                    Review how the influencer invite will appear
                  </DialogDescription>
                </DialogHeader>
                
                <div className="space-y-4">
                  {/* Subject Preview */}
                  <div>
                    <Label className="text-sm font-medium">Subject</Label>
                    <div className="mt-1 p-3 bg-muted rounded-lg">
                      <p className="font-medium">{template.subject}</p>
                    </div>
                  </div>
                  
                  {/* Recipient Info */}
                  <Alert>
                    <Info className="h-4 w-4" />
                    <AlertDescription>
                      <strong>To:</strong> {formData.email} ({formData.influencerName})
                      <br />
                      <strong>Commission Rate:</strong> {formData.commissionRate}%
                    </AlertDescription>
                  </Alert>
                  
                  {/* Body Preview */}
                  <div>
                    <Label className="text-sm font-medium">Email Body</Label>
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
                    Close Preview
                  </Button>
                  <Button 
                    onClick={() => {
                      setPreviewDialogOpen(false);
                      handleSend();
                    }} 
                    disabled={sending}
                  >
                    <Send className="mr-2 h-4 w-4" />
                    Send Invite
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