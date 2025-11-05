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
import { Loader2, Mail, Send, Eye, Info } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { EmailHistoryTab } from "@/components/admin/EmailHistoryTab";
import { EmailBestPractices } from "@/components/admin/EmailBestPractices";

export default function UserInvites() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [templateLoading, setTemplateLoading] = useState(true);
  const [template, setTemplate] = useState<any>(null);
  
  // Form state
  const [email, setEmail] = useState("");
  const [inviteeName, setInviteeName] = useState("");
  const [signupBonus, setSignupBonus] = useState("Start earning immediately with your first tasks!");
  const [customMessage, setCustomMessage] = useState("");
  
  // Preview state
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewHtml, setPreviewHtml] = useState("");

  // Load template on mount
  useEffect(() => {
    loadTemplate();
  }, []);

  const loadTemplate = async () => {
    try {
      setTemplateLoading(true);
      const { data, error } = await supabase
        .from("email_templates")
        .select("*")
        .eq("template_type", "user_invite")
        .eq("is_active", true)
        .single();

      if (error) throw error;
      setTemplate(data);
    } catch (error: any) {
      console.error("Error loading template:", error);
      toast.error("Failed to load email template");
    } finally {
      setTemplateLoading(false);
    }
  };

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const generatePreview = () => {
    if (!template) return;

    const platformUrl = window.location.origin;
    
    let preview = template.body
      .replace(/{{invitee_name}}/g, inviteeName || "[Invitee Name]")
      .replace(/{{platform_url}}/g, platformUrl)
      .replace(/{{signup_bonus}}/g, signupBonus || "[Signup Bonus]")
      .replace(/{{support_email}}/g, "support@fineearn.com");

    // Add custom message if provided
    if (customMessage && customMessage.trim()) {
      const customMessageHtml = `
        <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0;">
          <p style="margin: 0; color: #856404;"><strong>Personal Message:</strong></p>
          <p style="margin: 10px 0 0 0; color: #856404;">${customMessage}</p>
        </div>
      `;
      preview = preview.replace('</body>', `${customMessageHtml}</body>`);
    }

    setPreviewHtml(preview);
    setPreviewOpen(true);
  };

  const handleSendInvite = async () => {
    // Validation
    if (!email || !inviteeName) {
      toast.error("Please fill in all required fields");
      return;
    }

    if (!validateEmail(email)) {
      toast.error("Please enter a valid email address");
      return;
    }

    try {
      setLoading(true);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("You must be logged in");
        navigate("/login");
        return;
      }

      const { data, error } = await supabase.functions.invoke("send-user-invite", {
        body: {
          email: email.trim(),
          inviteeName: inviteeName.trim(),
          signupBonus: signupBonus.trim(),
          customMessage: customMessage.trim() || null,
        },
      });

      if (error) throw error;

      if (data?.success) {
        toast.success("User invite sent successfully!", {
          description: `Invitation sent to ${email}`,
        });
        
        // Reset form
        setEmail("");
        setInviteeName("");
        setSignupBonus("Start earning immediately with your first tasks!");
        setCustomMessage("");
      } else {
        throw new Error(data?.error || "Failed to send invite");
      }
    } catch (error: any) {
      console.error("Error sending user invite:", error);
      toast.error("Failed to send user invite", {
        description: error.message || "Please try again later",
      });
    } finally {
      setLoading(false);
    }
  };

  if (templateLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">User Invites</h1>
        <p className="text-muted-foreground mt-2">
          Send personalized invitations to potential users to join the platform
        </p>
      </div>

      <Tabs defaultValue="compose" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="compose">
            <Mail className="h-4 w-4 mr-2" />
            Compose Invite
          </TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
          <TabsTrigger value="best-practices">Best Practices</TabsTrigger>
        </TabsList>

        <TabsContent value="compose" className="space-y-6">
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              This email will be sent using the User Invite template. You can personalize it with recipient details and add a custom message.
            </AlertDescription>
          </Alert>

          <Card>
            <CardHeader>
              <CardTitle>Recipient Information</CardTitle>
              <CardDescription>Enter the details of the user you want to invite</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="email">
                    Email Address <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="user@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="inviteeName">
                    Invitee Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="inviteeName"
                    type="text"
                    placeholder="John Doe"
                    value={inviteeName}
                    onChange={(e) => setInviteeName(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="signupBonus">Signup Bonus Message</Label>
                <Input
                  id="signupBonus"
                  type="text"
                  placeholder="Start earning immediately with your first tasks!"
                  value={signupBonus}
                  onChange={(e) => setSignupBonus(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Optional: Customize the signup bonus message displayed in the email
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="customMessage">Custom Message (Optional)</Label>
                <Textarea
                  id="customMessage"
                  placeholder="Add a personal message to make your invitation more compelling..."
                  value={customMessage}
                  onChange={(e) => setCustomMessage(e.target.value)}
                  rows={4}
                />
                <p className="text-xs text-muted-foreground">
                  This message will be added to the email template
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Email Template</CardTitle>
              <CardDescription>
                Subject: {template?.subject?.replace(/{{invitee_name}}/g, inviteeName || "[Invitee Name]")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Alert className="mb-4">
                <Info className="h-4 w-4" />
                <AlertDescription>
                  The email template is configured in Email Templates. Variables will be automatically replaced when sending.
                </AlertDescription>
              </Alert>

              <div className="flex gap-2">
                <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" onClick={generatePreview} className="flex-1">
                      <Eye className="h-4 w-4 mr-2" />
                      Preview Email
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-3xl max-h-[80vh]">
                    <DialogHeader>
                      <DialogTitle>Email Preview</DialogTitle>
                    </DialogHeader>
                    <ScrollArea className="h-[60vh] w-full rounded-md border p-4">
                      <div dangerouslySetInnerHTML={{ __html: previewHtml }} />
                    </ScrollArea>
                  </DialogContent>
                </Dialog>

                <Button
                  onClick={handleSendInvite}
                  disabled={loading || !email || !inviteeName}
                  className="flex-1"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      Send Invite
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <EmailHistoryTab emailType="user_invite" />
        </TabsContent>

        <TabsContent value="best-practices">
          <EmailBestPractices />
        </TabsContent>
      </Tabs>
    </div>
  );
}
