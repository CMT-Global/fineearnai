import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Mail, RotateCcw, AlertCircle, CheckCircle2, Eye, Code } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";

interface EmailTemplateGlobalConfig {
  template: string;
  variables: {
    platform_name: string;
    platform_url: string;
    support_url: string;
    privacy_url: string;
    current_year: string;
    logo_html: string;
    preheader: string;
    content: string;
  };
  spamPrevention: {
    useInlineStyles: boolean;
    avoidSpamWords: boolean;
    properTextRatio: boolean;
    validHTMLStructure: boolean;
  };
}

const DEFAULT_TEMPLATE = `<!DOCTYPE html>
<html lang="en" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="x-apple-disable-message-reformatting">
  <meta name="format-detection" content="telephone=no,address=no,email=no,date=no,url=no">
  <title>{{platform_name}}</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
  <style>
    /* Reset styles for email clients */
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; display: block; }
    
    /* Prevent spam triggers */
    .ExternalClass { width: 100%; }
    .ExternalClass, .ExternalClass p, .ExternalClass span, .ExternalClass font, .ExternalClass td, .ExternalClass div { line-height: 100%; }
    
    /* Responsive styles */
    @media only screen and (max-width: 600px) {
      .email-container { width: 100% !important; max-width: 100% !important; }
      .mobile-padding { padding: 20px 15px !important; }
      .header-padding { padding: 30px 15px !important; }
      h1 { font-size: 24px !important; line-height: 1.3 !important; }
      h2 { font-size: 20px !important; line-height: 1.3 !important; }
      .button { padding: 12px 25px !important; font-size: 14px !important; }
      .logo-img { max-width: 150px !important; height: auto !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f7fa; line-height: 1.6; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale;">
  {{preheader}}
  
  <!-- Main Container -->
  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f5f7fa; padding: 20px 0;">
    <tr>
      <td align="center" style="padding: 0 15px;">
        
        <!-- Email Content Card -->
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="600" class="email-container" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); overflow: hidden;">
          
          <!-- Header with Logo -->
          <tr>
            <td style="background: linear-gradient(135deg, #14532d 0%, #166534 100%); padding: 40px 20px; text-align: center;" class="header-padding">
              {{logo_html}}
              <h1 style="margin: 15px 0 0 0; color: #ffffff; font-size: 28px; font-weight: 700; text-shadow: 0 2px 4px rgba(0,0,0,0.1); letter-spacing: -0.5px;">
                {{platform_name}}
              </h1>
            </td>
          </tr>
          
          <!-- Content Area -->
          <tr>
            <td style="padding: 40px 30px;" class="mobile-padding">
              {{content}}
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f8f9fa; padding: 30px 20px; text-align: center; border-top: 1px solid #e9ecef;">
              <p style="margin: 0 0 10px 0; font-size: 14px; color: #495057; line-height: 1.6; font-weight: 500;">
                <strong style="color: #212529;">{{platform_name}}</strong> - Earn by Training AI
              </p>
              <p style="margin: 0 0 15px 0; font-size: 13px; color: #6c757d; line-height: 1.5;">
                This email was sent from {{platform_name}}. If you have any questions, please contact our support team.
              </p>
              <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #dee2e6;">
                <a href="{{platform_url}}" style="color: #166534; text-decoration: none; font-size: 12px; margin: 0 8px; font-weight: 500;">Website</a>
                <span style="color: #dee2e6; margin: 0 4px;">|</span>
                <a href="{{support_url}}" style="color: #166534; text-decoration: none; font-size: 12px; margin: 0 8px; font-weight: 500;">Support</a>
                <span style="color: #dee2e6; margin: 0 4px;">|</span>
                <a href="{{privacy_url}}" style="color: #166534; text-decoration: none; font-size: 12px; margin: 0 8px; font-weight: 500;">Privacy Policy</a>
              </div>
              <p style="margin: 15px 0 0 0; font-size: 11px; color: #adb5bd; line-height: 1.4;">
                © {{current_year}} {{platform_name}}. All rights reserved.
              </p>
            </td>
          </tr>
          
        </table>
        
      </td>
    </tr>
  </table>
</body>
</html>`;

const DEFAULT_CONFIG: EmailTemplateGlobalConfig = {
  template: DEFAULT_TEMPLATE,
  variables: {
    platform_name: "{{platform_name}}",
    platform_url: "{{platform_url}}",
    support_url: "{{platform_url}}/support",
    privacy_url: "{{platform_url}}/privacy",
    current_year: "{{current_year}}",
    logo_html: "{{logo_html}}",
    preheader: "{{preheader}}",
    content: "{{content}}",
  },
  spamPrevention: {
    useInlineStyles: true,
    avoidSpamWords: true,
    properTextRatio: true,
    validHTMLStructure: true,
  },
};

export default function EmailTemplateGlobalSettings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [templateConfig, setTemplateConfig] = useState<EmailTemplateGlobalConfig>(DEFAULT_CONFIG);
  const [hasChanges, setHasChanges] = useState(false);
  const [previewMode, setPreviewMode] = useState<'template' | 'preview'>('template');

  const { data, isLoading } = useQuery({
    queryKey: ["email-template-global"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("platform_config")
        .select("value")
        .eq("key", "email_template_global")
        .maybeSingle();

      if (error) throw error;
      return (data?.value as EmailTemplateGlobalConfig) || DEFAULT_CONFIG;
    },
  });

  useEffect(() => {
    if (data) {
      setTemplateConfig({
        ...DEFAULT_CONFIG,
        ...data,
        template: data.template || DEFAULT_TEMPLATE,
      });
      setHasChanges(false);
    }
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: async (config: EmailTemplateGlobalConfig) => {
      const { error } = await supabase
        .from("platform_config")
        .upsert({
          key: "email_template_global",
          value: config,
          description: "Global HTML email template used to wrap all platform emails. Editable from admin panel.",
          updated_at: new Date().toISOString(),
        }, { onConflict: "key" });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["email-template-global"] });
      setHasChanges(false);
      toast({
        title: "Template saved",
        description: "Global email template has been updated successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error saving template",
        description: error.message || "Failed to save template. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    saveMutation.mutate(templateConfig);
  };

  const handleReset = () => {
    setTemplateConfig(DEFAULT_CONFIG);
    setHasChanges(true);
  };

  // Generate preview with sample data
  const generatePreview = (): string => {
    // Try to get platform name from cache, fallback to default
    const platformNameQuery = queryClient.getQueryData(["platform-name"]);
    let platformName = "ProfitChips";
    
    if (platformNameQuery) {
      // Handle different possible structures
      if (typeof platformNameQuery === 'string') {
        platformName = platformNameQuery;
      } else if (platformNameQuery && typeof platformNameQuery === 'object' && 'data' in platformNameQuery) {
        platformName = (platformNameQuery as any).data || "ProfitChips";
      } else {
        platformName = String(platformNameQuery) || "ProfitChips";
      }
    }
    
    const currentYear = new Date().getFullYear();
    const platformUrl = "https://profitchips.com";
    const logoUrl = `${platformUrl}/logo_without_bg_text.png`;
    const logoHtml = `<img src="${logoUrl}" alt="${platformName}" width="150" class="logo-img" style="display: block; margin: 0 auto; max-width: 200px; height: auto;">`;

    return templateConfig.template
      .replace(/\{\{platform_name\}\}/g, platformName)
      .replace(/\{\{platform_url\}\}/g, platformUrl)
      .replace(/\{\{support_url\}\}/g, `${platformUrl}/support`)
      .replace(/\{\{privacy_url\}\}/g, `${platformUrl}/privacy`)
      .replace(/\{\{current_year\}\}/g, currentYear.toString())
      .replace(/\{\{logo_html\}\}/g, logoHtml)
      .replace(/\{\{preheader\}\}/g, '<div style="display: none; max-height: 0; overflow: hidden; font-size: 1px; line-height: 1px; color: transparent;">Sample email preview</div>')
      .replace(/\{\{content\}\}/g, '<p style="color: #333; font-size: 16px; line-height: 1.6;">This is a sample email content. Replace {{content}} with your actual email body when sending.</p>');
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Mail className="h-8 w-8 text-primary" />
          Global Email Template
        </h1>
        <p className="text-muted-foreground mt-2">
          Edit the global HTML email template used to wrap all emails sent from the platform. This template includes spam prevention best practices.
        </p>
      </div>

      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          <strong>Available Variables:</strong> Use <code className="bg-muted px-1 py-0.5 rounded text-xs">{'{{variable_name}}'}</code> format. 
          Available: <code className="bg-muted px-1 py-0.5 rounded text-xs">{'{{platform_name}}'}</code>, 
          <code className="bg-muted px-1 py-0.5 rounded text-xs">{'{{platform_url}}'}</code>, 
          <code className="bg-muted px-1 py-0.5 rounded text-xs">{'{{support_url}}'}</code>, 
          <code className="bg-muted px-1 py-0.5 rounded text-xs">{'{{privacy_url}}'}</code>, 
          <code className="bg-muted px-1 py-0.5 rounded text-xs">{'{{current_year}}'}</code>, 
          <code className="bg-muted px-1 py-0.5 rounded text-xs">{'{{logo_html}}'}</code>, 
          <code className="bg-muted px-1 py-0.5 rounded text-xs">{'{{preheader}}'}</code>, 
          <code className="bg-muted px-1 py-0.5 rounded text-xs">{'{{content}}'}</code>
        </AlertDescription>
      </Alert>

      <Tabs value={previewMode} onValueChange={(v) => setPreviewMode(v as 'template' | 'preview')}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="template" className="gap-2">
            <Code className="h-4 w-4" />
            Edit Template
          </TabsTrigger>
          <TabsTrigger value="preview" className="gap-2">
            <Eye className="h-4 w-4" />
            Preview
          </TabsTrigger>
        </TabsList>

        <TabsContent value="template" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Email Template HTML</CardTitle>
              <CardDescription>
                Edit the HTML template. The {'{{content}}'} variable will be replaced with the actual email body.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label htmlFor="template">HTML Template</Label>
                <Textarea
                  id="template"
                  value={templateConfig.template}
                  onChange={(e) => {
                    setTemplateConfig((prev) => ({ ...prev, template: e.target.value }));
                    setHasChanges(true);
                  }}
                  rows={30}
                  className="font-mono text-sm"
                  placeholder="Enter HTML template..."
                />
                <p className="text-xs text-muted-foreground">
                  This template wraps all emails. Make sure to include {'{{content}}'} where the email body should appear.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="preview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Email Preview</CardTitle>
              <CardDescription>
                Preview how the template looks with sample data
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[600px] w-full border rounded-lg p-4 bg-muted/30">
                <div
                  className="bg-white rounded-lg"
                  dangerouslySetInnerHTML={{ __html: generatePreview() }}
                />
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Card>
        <CardContent className="flex items-center justify-between gap-4 py-4">
          <div className="space-y-1 text-sm text-muted-foreground">
            <p>Changes are applied to all emails sent from the platform immediately after saving.</p>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={handleReset} disabled={saveMutation.isPending}>
              <RotateCcw className="h-4 w-4 mr-2" />
              Reset to Defaults
            </Button>
            <Button onClick={handleSave} disabled={!hasChanges || saveMutation.isPending}>
              {saveMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Save Template
                </>
              )}
            </Button>
          </div>
        </CardContent>

        {saveMutation.isSuccess && (
          <CardContent className="pt-0">
            <Alert>
              <CheckCircle2 className="h-4 w-4" />
              <AlertDescription>
                Template saved successfully! All future emails will use this template.
              </AlertDescription>
            </Alert>
          </CardContent>
        )}

        {saveMutation.isError && (
          <CardContent className="pt-0">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>Failed to save template. Please try again.</AlertDescription>
            </Alert>
          </CardContent>
        )}
      </Card>
    </div>
  );
}

