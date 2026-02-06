import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { useLanguageSync } from "@/hooks/useLanguageSync";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Mail, RotateCcw, AlertCircle, CheckCircle2, Eye, Code, Loader2 } from "lucide-react";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { PageLoading } from "@/components/shared/PageLoading";
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
  const { t } = useTranslation();
  useLanguageSync(); // Sync language and force re-render when language changes
  
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [templateConfig, setTemplateConfig] = useState<EmailTemplateGlobalConfig>(DEFAULT_CONFIG);
  const [hasChanges, setHasChanges] = useState(false);
  const [previewMode, setPreviewMode] = useState<'template' | 'preview'>('template');
  
  // Fetch email template config
  const { data, isLoading } = useQuery({
    queryKey: ["email-template-global"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("platform_config")
        .select("value")
        .eq("key", "email_template_global")
        .maybeSingle();

      if (error) throw error;
      return data?.value as unknown as EmailTemplateGlobalConfig | null;
    },
  });

  // Update state when data loads
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
          value: config as unknown as Json,
          description: "Global HTML email template used to wrap all platform emails. Editable from admin panel.",
          updated_at: new Date().toISOString(),
        }, { onConflict: "key" });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["email-template-global"] });
      setHasChanges(false);
      toast({
        title: t("admin.emailTemplateGlobalSettings.toasts.templateSaved"),
        description: t("admin.emailTemplateGlobalSettings.toasts.templateSavedDescription"),
      });
    },
    onError: (error: any) => {
      toast({
        title: t("admin.emailTemplateGlobalSettings.toasts.errorSaving"),
        description: error.message || t("admin.emailTemplateGlobalSettings.toasts.errorSavingDescription"),
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
    return <PageLoading text={t("admin.emailTemplateGlobalSettings.loading")} />;
  }

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Mail className="h-8 w-8 text-primary" />
          {t("admin.emailTemplateGlobalSettings.title")}
        </h1>
        <p className="text-muted-foreground mt-2">
          {t("admin.emailTemplateGlobalSettings.subtitle")}
        </p>
      </div>

      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          <strong>{t("admin.emailTemplateGlobalSettings.availableVariables")}:</strong> {t("admin.emailTemplateGlobalSettings.variablesDescription")}
        </AlertDescription>
      </Alert>

      <Tabs value={previewMode} onValueChange={(v) => setPreviewMode(v as 'template' | 'preview')}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="template" className="gap-2">
            <Code className="h-4 w-4" />
            {t("admin.emailTemplateGlobalSettings.tabs.editTemplate")}
          </TabsTrigger>
          <TabsTrigger value="preview" className="gap-2">
            <Eye className="h-4 w-4" />
            {t("admin.emailTemplateGlobalSettings.tabs.preview")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="template" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t("admin.emailTemplateGlobalSettings.template.title")}</CardTitle>
              <CardDescription>
                {t("admin.emailTemplateGlobalSettings.template.description")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label htmlFor="template">{t("admin.emailTemplateGlobalSettings.template.htmlTemplate")}</Label>
                <Textarea
                  id="template"
                  value={templateConfig.template}
                  onChange={(e) => {
                    setTemplateConfig((prev) => ({ ...prev, template: e.target.value }));
                    setHasChanges(true);
                  }}
                  rows={30}
                  className="font-mono text-sm"
                  placeholder={t("admin.emailTemplateGlobalSettings.template.placeholder")}
                />
                <p className="text-xs text-muted-foreground">
                  {t("admin.emailTemplateGlobalSettings.template.hint")}
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="preview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t("admin.emailTemplateGlobalSettings.preview.title")}</CardTitle>
              <CardDescription>
                {t("admin.emailTemplateGlobalSettings.preview.description")}
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
        <CardContent className="flex flex-col sm:flex-row items-center justify-between gap-4 py-4">
          <div className="space-y-1 text-sm text-muted-foreground text-center sm:text-left">
            <p>{t("admin.emailTemplateGlobalSettings.changesNote")}</p>
          </div>
          <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
            <Button variant="outline" onClick={handleReset} disabled={saveMutation.isPending} className="w-full sm:w-auto">
              <RotateCcw className="h-4 w-4 mr-2" />
              {t("admin.emailTemplateGlobalSettings.actions.resetToDefaults")}
            </Button>
            <Button onClick={handleSave} disabled={!hasChanges || saveMutation.isPending} className="w-full sm:w-auto">
              {saveMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {t("common.saving")}
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  {t("admin.emailTemplateGlobalSettings.actions.saveTemplate")}
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
                {t("admin.emailTemplateGlobalSettings.success.templateSaved")}
              </AlertDescription>
            </Alert>
          </CardContent>
        )}

        {saveMutation.isError && (
          <CardContent className="pt-0">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{t("admin.emailTemplateGlobalSettings.errors.failedToSave")}</AlertDescription>
            </Alert>
          </CardContent>
        )}
      </Card>
    </div>
  );
}

