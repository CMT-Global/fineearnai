import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { AdminBreadcrumb } from "@/components/admin/AdminBreadcrumb";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Mail, Send, RotateCcw, Palette, Server, AlertCircle, CheckCircle2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { z } from "zod";

// Validation schema
const emailSettingsSchema = z.object({
  from_address: z.string().email("Invalid email address").max(255, "Email too long"),
  from_name: z.string().trim().min(1, "From name is required").max(100, "Name too long"),
  reply_to_address: z.string().email("Invalid email address").max(255, "Email too long"),
  reply_to_name: z.string().trim().min(1, "Reply-to name is required").max(100, "Name too long"),
  support_email: z.string().email("Invalid email address").max(255, "Email too long"),
  platform_name: z.string().trim().min(1, "Platform name is required").max(100, "Name too long"),
  platform_url: z.string().url("Invalid URL").max(500, "URL too long"),
  admin_notification_email: z.string().email("Invalid email address").max(255, "Email too long"),
  footer_text: z.string().max(1000, "Footer text too long"),
  branding_color_primary: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Invalid hex color"),
  branding_color_secondary: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Invalid hex color"),
});

const DEFAULT_SETTINGS = {
  from_address: "noreply@mail.fineearn.com",
  from_name: "FineEarn",
  reply_to_address: "support@fineearn.com",
  reply_to_name: "FineEarn Support",
  support_email: "support@fineearn.com",
  platform_name: "FineEarn",
  platform_url: "https://fineearn.com",
  admin_notification_email: "admin@fineearn.com",
  smtp_enabled: false,
  smtp_host: "",
  smtp_port: 587,
  smtp_username: "",
  smtp_secure: true,
  footer_text: "This is an automated email from FineEarn. Please do not reply to this email.",
  footer_unsubscribe_link: "",
  branding_logo_url: "",
  branding_color_primary: "#0066ff",
  branding_color_secondary: "#f5f5f5"
};

export default function EmailSettings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [hasChanges, setHasChanges] = useState(false);
  const [testEmailSent, setTestEmailSent] = useState(false);

  // Fetch email settings
  const { data: configData, isLoading } = useQuery({
    queryKey: ['email-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('platform_config')
        .select('value')
        .eq('key', 'email_settings')
        .maybeSingle();

      if (error) throw error;
      return data?.value || DEFAULT_SETTINGS;
    },
  });

  // Update settings when data loads
  useEffect(() => {
    if (configData && typeof configData === 'object') {
      setSettings({ ...DEFAULT_SETTINGS, ...configData as any });
    }
  }, [configData]);

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async (newSettings: typeof settings) => {
      const { error } = await supabase
        .from('platform_config')
        .upsert({
          key: 'email_settings',
          value: newSettings,
          description: 'Email sending configuration for the platform',
          updated_at: new Date().toISOString(),
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-settings'] });
      setHasChanges(false);
      toast({
        title: "Settings saved",
        description: "Email settings have been updated successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error saving settings",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Send test email mutation
  const testEmailMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) throw new Error("No user email found");

      const { error } = await supabase.functions.invoke('send-test-email', {
        body: {
          test_email: user.email,
          subject: `Test Email from ${settings.platform_name}`,
          body: `
            <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: 0 auto;">
              <h1 style="color: ${settings.branding_color_primary};">Test Email</h1>
              <p>This is a test email sent from ${settings.platform_name} email settings.</p>
              <p><strong>From:</strong> ${settings.from_name} &lt;${settings.from_address}&gt;</p>
              <p><strong>Reply-To:</strong> ${settings.reply_to_name} &lt;${settings.reply_to_address}&gt;</p>
              <hr style="border: 1px solid ${settings.branding_color_secondary}; margin: 20px 0;" />
              <p style="color: #666; font-size: 12px;">${settings.footer_text}</p>
            </div>
          `,
        }
      });

      if (error) throw error;
    },
    onSuccess: () => {
      setTestEmailSent(true);
      setTimeout(() => setTestEmailSent(false), 5000);
      toast({
        title: "Test email sent",
        description: "Check your inbox for the test email.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error sending test email",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleInputChange = (field: string, value: any) => {
    setSettings(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);
    setErrors(prev => ({ ...prev, [field]: "" }));
  };

  const handleSave = () => {
    // Validate settings
    try {
      emailSettingsSchema.parse(settings);
      setErrors({});
      saveMutation.mutate(settings);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const newErrors: Record<string, string> = {};
        error.errors.forEach(err => {
          if (err.path[0]) {
            newErrors[err.path[0] as string] = err.message;
          }
        });
        setErrors(newErrors);
        toast({
          title: "Validation error",
          description: "Please fix the errors before saving.",
          variant: "destructive",
        });
      }
    }
  };

  const handleReset = () => {
    setSettings(DEFAULT_SETTINGS);
    setHasChanges(true);
    setErrors({});
    toast({
      title: "Settings reset",
      description: "Email settings have been reset to defaults.",
    });
  };

  const handleSendTest = () => {
    testEmailMutation.mutate();
  };

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-96">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <AdminBreadcrumb
          items={[
            { label: "Communications" },
            { label: "Email Settings" },
          ]}
        />

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Email Settings</h1>
            <p className="text-muted-foreground mt-1">
              Configure email sending settings for the platform
            </p>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleReset}
              disabled={saveMutation.isPending}
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Reset to Defaults
            </Button>
            
            <Button
              variant="outline"
              onClick={handleSendTest}
              disabled={testEmailMutation.isPending || !settings.from_address}
            >
              {testEmailMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              Send Test Email
            </Button>

            <Button
              onClick={handleSave}
              disabled={!hasChanges || saveMutation.isPending}
            >
              {saveMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Mail className="h-4 w-4 mr-2" />
              )}
              Save Settings
            </Button>
          </div>
        </div>

        {testEmailSent && (
          <Alert className="border-green-500 bg-green-50">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800">
              Test email sent successfully! Check your inbox.
            </AlertDescription>
          </Alert>
        )}

        <Tabs defaultValue="general" className="space-y-6">
          <TabsList>
            <TabsTrigger value="general" className="gap-2">
              <Mail className="h-4 w-4" />
              General Settings
            </TabsTrigger>
            <TabsTrigger value="branding" className="gap-2">
              <Palette className="h-4 w-4" />
              Branding
            </TabsTrigger>
            <TabsTrigger value="smtp" className="gap-2">
              <Server className="h-4 w-4" />
              SMTP (Optional)
            </TabsTrigger>
          </TabsList>

          {/* General Settings Tab */}
          <TabsContent value="general" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Sender Information</CardTitle>
                <CardDescription>
                  Configure who emails are sent from. The from_address must be verified in Resend.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="from_address">From Address *</Label>
                    <Input
                      id="from_address"
                      type="email"
                      value={settings.from_address}
                      onChange={(e) => handleInputChange('from_address', e.target.value)}
                      placeholder="noreply@mail.fineearn.com"
                    />
                    {errors.from_address && (
                      <p className="text-sm text-destructive flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        {errors.from_address}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="from_name">From Name *</Label>
                    <Input
                      id="from_name"
                      value={settings.from_name}
                      onChange={(e) => handleInputChange('from_name', e.target.value)}
                      placeholder="FineEarn"
                    />
                    {errors.from_name && (
                      <p className="text-sm text-destructive flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        {errors.from_name}
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Reply-To Information</CardTitle>
                <CardDescription>
                  Where user replies will be sent to.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="reply_to_address">Reply-To Address *</Label>
                    <Input
                      id="reply_to_address"
                      type="email"
                      value={settings.reply_to_address}
                      onChange={(e) => handleInputChange('reply_to_address', e.target.value)}
                      placeholder="support@fineearn.com"
                    />
                    {errors.reply_to_address && (
                      <p className="text-sm text-destructive flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        {errors.reply_to_address}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="reply_to_name">Reply-To Name *</Label>
                    <Input
                      id="reply_to_name"
                      value={settings.reply_to_name}
                      onChange={(e) => handleInputChange('reply_to_name', e.target.value)}
                      placeholder="FineEarn Support"
                    />
                    {errors.reply_to_name && (
                      <p className="text-sm text-destructive flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        {errors.reply_to_name}
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Platform Information</CardTitle>
                <CardDescription>
                  Basic platform details used in emails and templates.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="platform_name">Platform Name *</Label>
                    <Input
                      id="platform_name"
                      value={settings.platform_name}
                      onChange={(e) => handleInputChange('platform_name', e.target.value)}
                      placeholder="FineEarn"
                    />
                    {errors.platform_name && (
                      <p className="text-sm text-destructive flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        {errors.platform_name}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="platform_url">Platform URL *</Label>
                    <Input
                      id="platform_url"
                      type="url"
                      value={settings.platform_url}
                      onChange={(e) => handleInputChange('platform_url', e.target.value)}
                      placeholder="https://fineearn.com"
                    />
                    {errors.platform_url && (
                      <p className="text-sm text-destructive flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        {errors.platform_url}
                      </p>
                    )}
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="support_email">Support Email *</Label>
                    <Input
                      id="support_email"
                      type="email"
                      value={settings.support_email}
                      onChange={(e) => handleInputChange('support_email', e.target.value)}
                      placeholder="support@fineearn.com"
                    />
                    {errors.support_email && (
                      <p className="text-sm text-destructive flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        {errors.support_email}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="admin_notification_email">Admin Notification Email *</Label>
                    <Input
                      id="admin_notification_email"
                      type="email"
                      value={settings.admin_notification_email}
                      onChange={(e) => handleInputChange('admin_notification_email', e.target.value)}
                      placeholder="admin@fineearn.com"
                    />
                    {errors.admin_notification_email && (
                      <p className="text-sm text-destructive flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        {errors.admin_notification_email}
                      </p>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="footer_text">Email Footer Text</Label>
                  <Textarea
                    id="footer_text"
                    value={settings.footer_text}
                    onChange={(e) => handleInputChange('footer_text', e.target.value)}
                    placeholder="This is an automated email from FineEarn..."
                    rows={3}
                  />
                  {errors.footer_text && (
                    <p className="text-sm text-destructive flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      {errors.footer_text}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Branding Tab */}
          <TabsContent value="branding" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Email Branding</CardTitle>
                <CardDescription>
                  Customize the visual appearance of your emails for white-label deployments.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="branding_color_primary">Primary Brand Color</Label>
                    <div className="flex gap-2">
                      <Input
                        id="branding_color_primary"
                        type="color"
                        value={settings.branding_color_primary}
                        onChange={(e) => handleInputChange('branding_color_primary', e.target.value)}
                        className="w-20 h-10"
                      />
                      <Input
                        value={settings.branding_color_primary}
                        onChange={(e) => handleInputChange('branding_color_primary', e.target.value)}
                        placeholder="#0066ff"
                        className="flex-1"
                      />
                    </div>
                    {errors.branding_color_primary && (
                      <p className="text-sm text-destructive flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        {errors.branding_color_primary}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="branding_color_secondary">Secondary Brand Color</Label>
                    <div className="flex gap-2">
                      <Input
                        id="branding_color_secondary"
                        type="color"
                        value={settings.branding_color_secondary}
                        onChange={(e) => handleInputChange('branding_color_secondary', e.target.value)}
                        className="w-20 h-10"
                      />
                      <Input
                        value={settings.branding_color_secondary}
                        onChange={(e) => handleInputChange('branding_color_secondary', e.target.value)}
                        placeholder="#f5f5f5"
                        className="flex-1"
                      />
                    </div>
                    {errors.branding_color_secondary && (
                      <p className="text-sm text-destructive flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        {errors.branding_color_secondary}
                      </p>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="branding_logo_url">Logo URL (Optional)</Label>
                  <Input
                    id="branding_logo_url"
                    type="url"
                    value={settings.branding_logo_url}
                    onChange={(e) => handleInputChange('branding_logo_url', e.target.value)}
                    placeholder="https://example.com/logo.png"
                  />
                  <p className="text-xs text-muted-foreground">
                    URL to your logo image that will appear in email headers
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Email Preview */}
            <Card>
              <CardHeader>
                <CardTitle>Email Preview</CardTitle>
                <CardDescription>
                  Preview how emails will look with your current settings
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div 
                  className="border rounded-lg p-6 bg-white"
                  style={{ 
                    maxWidth: '600px',
                    margin: '0 auto',
                  }}
                >
                  {settings.branding_logo_url && (
                    <img 
                      src={settings.branding_logo_url} 
                      alt="Logo" 
                      className="h-12 mb-4"
                      onError={(e) => (e.currentTarget.style.display = 'none')}
                    />
                  )}
                  <h1 style={{ color: settings.branding_color_primary, marginBottom: '16px' }}>
                    Sample Email Heading
                  </h1>
                  <p className="mb-4">
                    This is how your emails will appear to users. The heading above uses your primary brand color.
                  </p>
                  <p className="mb-4">
                    <strong>From:</strong> {settings.from_name} &lt;{settings.from_address}&gt;<br />
                    <strong>Reply-To:</strong> {settings.reply_to_name} &lt;{settings.reply_to_address}&gt;
                  </p>
                  <hr style={{ 
                    border: 'none',
                    borderTop: `1px solid ${settings.branding_color_secondary}`,
                    margin: '20px 0' 
                  }} />
                  <p style={{ 
                    color: '#666',
                    fontSize: '12px',
                    marginTop: '20px'
                  }}>
                    {settings.footer_text}
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* SMTP Tab */}
          <TabsContent value="smtp" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>SMTP Configuration (Future Feature)</CardTitle>
                <CardDescription>
                  Configure custom SMTP server for email sending. Currently, the platform uses Resend.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    SMTP configuration will be available in a future update. Currently, all emails are sent via Resend.
                  </AlertDescription>
                </Alert>

                <div className="space-y-4 opacity-50 pointer-events-none">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Enable SMTP</Label>
                      <p className="text-sm text-muted-foreground">Use custom SMTP server instead of Resend</p>
                    </div>
                    <Switch disabled checked={settings.smtp_enabled} />
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>SMTP Host</Label>
                      <Input disabled value={settings.smtp_host} placeholder="smtp.example.com" />
                    </div>
                    <div className="space-y-2">
                      <Label>SMTP Port</Label>
                      <Input disabled type="number" value={settings.smtp_port} placeholder="587" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>SMTP Username</Label>
                    <Input disabled value={settings.smtp_username} placeholder="user@example.com" />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Use TLS/SSL</Label>
                      <p className="text-sm text-muted-foreground">Enable secure connection</p>
                    </div>
                    <Switch disabled checked={settings.smtp_secure} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}
