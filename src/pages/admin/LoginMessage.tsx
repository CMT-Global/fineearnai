import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";
import { useLanguageSync } from "@/hooks/useLanguageSync";
import DOMPurify from "dompurify";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { RichTextEditor } from "@/components/admin/RichTextEditor";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  MessageSquare,
  Eye,
  EyeOff,
  Save,
  RotateCcw,
  AlertCircle,
  Sparkles,
  Info,
  Code,
} from "lucide-react";
import { toast } from "sonner";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { PageLoading } from "@/components/shared/PageLoading";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useBranding } from "@/contexts/BrandingContext";
import { AdminBreadcrumb } from "@/components/admin/AdminBreadcrumb";

interface LoginMessageConfig {
  enabled: boolean;
  title: string;
  body: string;
  show_once_per_session: boolean;
  dismissible: boolean;
  priority: "low" | "medium" | "high";
}

const DEFAULT_CONFIG: LoginMessageConfig = {
  enabled: false,
  title: "",
  body: "",
  show_once_per_session: true,
  dismissible: true,
  priority: "medium",
};

const LoginMessage = () => {
  const { t } = useTranslation();
  useLanguageSync(); // Sync language and force re-render when language changes
  
  const { platformName } = useBranding();
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdmin();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  // State management
  const [config, setConfig] = useState<LoginMessageConfig>(DEFAULT_CONFIG);
  const [characterCount, setCharacterCount] = useState(0);
  const [showPreview, setShowPreview] = useState(true);
  const [showSourceCode, setShowSourceCode] = useState(false);

  // Fetch login message config
  const { data: currentConfig, isLoading } = useQuery({
    queryKey: ["login-message-admin-config"],
    queryFn: async (): Promise<LoginMessageConfig | null> => {
      const { data, error } = await supabase
        .from("platform_config")
        .select("value")
        .eq("key", "login_message")
        .maybeSingle();

      if (error) throw error;
      if (!data?.value) return null;
      return data.value as unknown as LoginMessageConfig;
    },
  });

  // Update local state when config loads
  useEffect(() => {
    if (currentConfig && typeof currentConfig === 'object') {
      setConfig({ ...DEFAULT_CONFIG, ...currentConfig });
      setCharacterCount(currentConfig.title?.length || 0);
    }
  }, [currentConfig]);

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

  // Save mutation — upsert so the row is created if it doesn't exist (update alone affects 0 rows when no row exists)
  const saveMutation = useMutation({
    mutationFn: async (newConfig: LoginMessageConfig) => {
      const { error } = await supabase
        .from("platform_config")
        .upsert(
          {
            key: "login_message",
            value: newConfig as any,
            description: "Login message shown to users after sign-in",
            updated_at: new Date().toISOString(),
          },
          { onConflict: "key" }
        );

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["login-message-admin-config"] });
      queryClient.invalidateQueries({ queryKey: ["login-message-config"] });
      toast.success(t("adminLoginMessage.success.updated"));
    },
    onError: (error: any) => {
      console.error("Error saving login message:", error);
      toast.error(t("adminLoginMessage.errors.failedToSave", { message: error.message }));
    },
  });

  const handleSave = () => {
    // Validation
    if (!config.title.trim()) {
      toast.error(t("adminLoginMessage.validation.titleRequired"));
      return;
    }

    if (config.title.length > 100) {
      toast.error(t("adminLoginMessage.validation.titleMaxLength"));
      return;
    }

    if (!config.body.trim()) {
      toast.error(t("adminLoginMessage.validation.bodyRequired"));
      return;
    }

    if (config.body.length > 5000) {
      toast.error(t("adminLoginMessage.validation.bodyMaxLength"));
      return;
    }

    // Sanitize HTML body before saving (additional security layer)
    const sanitizedBody = DOMPurify.sanitize(config.body, {
      ALLOWED_TAGS: ['p', 'h1', 'h2', 'h3', 'strong', 'em', 'u', 's', 'ul', 'ol', 'li', 'a', 'br'],
      ALLOWED_ATTR: ['href', 'target', 'rel', 'class', 'style'],
      ALLOW_DATA_ATTR: false,
    });

    // Save with sanitized body
    saveMutation.mutate({ ...config, body: sanitizedBody });
  };

  const handleReset = () => {
    if (confirm(t("adminLoginMessage.confirm.reset"))) {
      setConfig(DEFAULT_CONFIG);
      setCharacterCount(DEFAULT_CONFIG.title.length);
      toast.info(t("adminLoginMessage.success.reset"));
    }
  };

  const handleTitleChange = (value: string) => {
    if (value.length <= 100) {
      setConfig({ ...config, title: value });
      setCharacterCount(value.length);
    }
  };

  if (authLoading || adminLoading || isLoading) {
    return <PageLoading text={t("adminLoginMessage.loading")} />;
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="container mx-auto px-4 py-6 sm:py-8 max-w-7xl">
      <AdminBreadcrumb
        items={[
          { label: t("adminLoginMessage.breadcrumb.communications") },
          { label: t("adminLoginMessage.breadcrumb.loginMessage") },
        ]}
      />

      {/* Header */}
      <div className="mb-6 sm:mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-2">
          <div className="flex items-center gap-3">
            <MessageSquare className="h-6 w-6 sm:h-8 sm:w-8 text-primary" />
            <h1 className="text-2xl sm:text-3xl font-bold break-words">{t("adminLoginMessage.title")}</h1>
          </div>
        </div>
        <p className="text-sm sm:text-base text-muted-foreground break-words">
          {t("adminLoginMessage.subtitle")}
        </p>
      </div>

      {/* Info Alert */}
      <Alert className="mb-6">
        <Info className="h-4 w-4" />
        <AlertDescription className="text-xs sm:text-sm">
          <strong>{t("adminLoginMessage.howItWorks")}:</strong> {t("adminLoginMessage.howItWorksDescription")}
        </AlertDescription>
      </Alert>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Editor Panel */}
        <div className="space-y-6 order-2 lg:order-1">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                <MessageSquare className="h-5 w-5" />
                {t("adminLoginMessage.messageConfiguration.title")}
              </CardTitle>
              <CardDescription className="text-sm">
                {t("adminLoginMessage.messageConfiguration.description")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Enable/Disable Toggle */}
              <div className="flex items-center justify-between gap-4">
                <div className="space-y-0.5 flex-1 min-w-0">
                  <Label htmlFor="enabled" className="text-base font-medium">
                    {t("adminLoginMessage.messageConfiguration.enableLoginMessage")}
                  </Label>
                  <p className="text-xs sm:text-sm text-muted-foreground">
                    {t("adminLoginMessage.messageConfiguration.enableDescription")}
                  </p>
                </div>
                <Switch
                  id="enabled"
                  checked={config.enabled}
                  onCheckedChange={(checked) =>
                    setConfig({ ...config, enabled: checked })
                  }
                  className="flex-shrink-0"
                />
              </div>

              <Separator />

              {/* Title Input */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="title" className="text-sm sm:text-base">
                    {t("adminLoginMessage.messageConfiguration.title")} <span className="text-destructive">*</span>
                  </Label>
                  <span className="text-xs text-muted-foreground">
                    {characterCount}/100
                  </span>
                </div>
                <Input
                  id="title"
                  placeholder={t("adminLoginMessage.messageConfiguration.titlePlaceholder")}
                  value={config.title}
                  onChange={(e) => handleTitleChange(e.target.value)}
                  maxLength={100}
                  className={cn(
                    "text-base",
                    characterCount > 90 && "border-amber-500"
                  )}
                />
                <p className="text-xs text-muted-foreground">
                  {t("adminLoginMessage.messageConfiguration.titleHint")}
                </p>
              </div>

              {/* Body Rich Text Editor */}
              <div className="space-y-2">
                <Label htmlFor="body" className="text-sm sm:text-base">
                  {t("adminLoginMessage.messageConfiguration.messageBody")} <span className="text-destructive">*</span>
                </Label>
                <RichTextEditor
                  value={config.body}
                  onChange={(html) => setConfig({ ...config, body: html })}
                  placeholder={t("adminLoginMessage.messageConfiguration.bodyPlaceholder")}
                  maxLength={5000}
                  className="min-h-[300px]"
                />
              </div>

              <Separator />

              {/* Behavior Options */}
              <div className="space-y-4">
                <h3 className="font-medium text-sm sm:text-base">{t("adminLoginMessage.behaviorOptions.title")}</h3>

                {/* Dismissible */}
                <div className="flex items-center justify-between gap-4">
                  <div className="space-y-0.5 flex-1 min-w-0">
                    <Label htmlFor="dismissible" className="text-sm font-medium">
                      {t("adminLoginMessage.behaviorOptions.allowDismissal")}
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      {t("adminLoginMessage.behaviorOptions.allowDismissalDescription")}
                    </p>
                  </div>
                  <Switch
                    id="dismissible"
                    checked={config.dismissible}
                    onCheckedChange={(checked) =>
                      setConfig({ ...config, dismissible: checked })
                    }
                    className="flex-shrink-0"
                  />
                </div>

                {/* Show Once Per Session */}
                <div className="flex items-center justify-between gap-4">
                  <div className="space-y-0.5 flex-1 min-w-0">
                    <Label htmlFor="show_once" className="text-sm font-medium">
                      {t("adminLoginMessage.behaviorOptions.showOncePerSession")}
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      {t("adminLoginMessage.behaviorOptions.showOncePerSessionDescription")}
                    </p>
                  </div>
                  <Switch
                    id="show_once"
                    checked={config.show_once_per_session}
                    onCheckedChange={(checked) =>
                      setConfig({ ...config, show_once_per_session: checked })
                    }
                    className="flex-shrink-0"
                  />
                </div>

                {/* Priority */}
                <div className="space-y-2">
                  <Label htmlFor="priority" className="text-sm sm:text-base">{t("adminLoginMessage.behaviorOptions.displayPriority")}</Label>
                  <Select
                    value={config.priority}
                    onValueChange={(value: "low" | "medium" | "high") =>
                      setConfig({ ...config, priority: value })
                    }
                  >
                    <SelectTrigger id="priority" className="h-11 touch-manipulation">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">{t("adminLoginMessage.priority.low")}</SelectItem>
                      <SelectItem value="medium">{t("adminLoginMessage.priority.medium")}</SelectItem>
                      <SelectItem value="high">{t("adminLoginMessage.priority.high")}</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {t("adminLoginMessage.behaviorOptions.priorityHint")}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              onClick={handleSave}
              disabled={saveMutation.isPending}
              className="flex-1 h-12 touch-manipulation"
              size="lg"
            >
              {saveMutation.isPending ? (
                <>
                  <LoadingSpinner size="sm" className="mr-2" />
                  {t("common.saving")}
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  {t("adminLoginMessage.actions.saveChanges")}
                </>
              )}
            </Button>
            <Button
              onClick={handleReset}
              variant="outline"
              size="lg"
              disabled={saveMutation.isPending}
              className="h-12 touch-manipulation"
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              {t("common.reset")}
            </Button>
          </div>
        </div>

        {/* Preview Panel */}
        <div className="space-y-6 order-1 lg:order-2">
          <Card className="lg:sticky lg:top-8">
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                  {showPreview ? (
                    <Eye className="h-5 w-5" />
                  ) : (
                    <EyeOff className="h-5 w-5" />
                  )}
                  <span className="break-words">{t("adminLoginMessage.preview.livePreview")}</span>
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowPreview(!showPreview)}
                    className="h-9 touch-manipulation flex-1 sm:flex-none"
                  >
                    {showPreview ? t("adminLoginMessage.preview.hide") : t("adminLoginMessage.preview.show")} {t("adminLoginMessage.preview.preview")}
                  </Button>
                </div>
              </div>
              <CardDescription className="text-sm break-words">
                {t("adminLoginMessage.preview.description")}
              </CardDescription>
            </CardHeader>
            {showPreview && (
              <CardContent>
                {config.enabled ? (
                  <div className="space-y-4">
                    {/* View Toggle Buttons */}
                      <div className="flex items-center gap-2 border-b pb-3">
                        <Button
                          variant={!showSourceCode ? "default" : "outline"}
                          size="sm"
                          onClick={() => setShowSourceCode(false)}
                          className="h-8 text-xs touch-manipulation"
                        >
                          <Eye className="h-3 w-3 mr-1" />
                          {t("adminLoginMessage.preview.visual")}
                        </Button>
                        <Button
                          variant={showSourceCode ? "default" : "outline"}
                          size="sm"
                          onClick={() => setShowSourceCode(true)}
                          className="h-8 text-xs touch-manipulation"
                        >
                          <Code className="h-3 w-3 mr-1" />
                          {t("adminLoginMessage.preview.sourceCode")}
                        </Button>
                      </div>

                    {/* Preview Content */}
                    {!showSourceCode ? (
                      <div className="border-2 border-dashed border-muted rounded-lg p-3 sm:p-4 bg-muted/10">
                        <div className="space-y-3 sm:space-y-4">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <Sparkles className="h-4 w-4 sm:h-5 sm:w-5 text-primary flex-shrink-0" />
                              <h3 className="text-base sm:text-lg font-bold truncate">{config.title}</h3>
                            </div>
                            {config.dismissible && (
                              <Badge variant="secondary" className="text-xs flex-shrink-0">
                                {t("adminLoginMessage.preview.dismissible")}
                              </Badge>
                            )}
                          </div>
                          <Separator />
                          <div
                            className="prose prose-sm dark:prose-invert max-w-none text-xs sm:text-sm"
                            dangerouslySetInnerHTML={{ __html: config.body }}
                          />
                          {config.show_once_per_session && (
                            <p className="text-xs text-muted-foreground italic">
                              ℹ️ {t("adminLoginMessage.preview.showOnceNote")}
                            </p>
                          )}
                          <Badge
                            variant="outline"
                            className="capitalize text-xs"
                          >
                            {t("adminLoginMessage.preview.priority")}: {t(`adminLoginMessage.priority.${config.priority}`)}
                          </Badge>
                        </div>
                      </div>
                    ) : (
                      <div className="border rounded-lg bg-muted/30 p-4 max-h-[400px] overflow-auto">
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <p className="text-xs font-medium text-muted-foreground">{t("adminLoginMessage.preview.htmlSourceCode")}</p>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                navigator.clipboard.writeText(config.body);
                                toast.success(t("adminLoginMessage.preview.htmlCopied"));
                              }}
                              className="h-7 text-xs"
                            >
                              {t("common.copy")}
                            </Button>
                          </div>
                          <pre className="text-xs bg-background p-3 rounded border overflow-x-auto">
                            <code className="font-mono text-xs">{config.body}</code>
                          </pre>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription className="text-sm">
                      {t("adminLoginMessage.preview.disabled")} <strong>{t("adminLoginMessage.preview.disabledText")}</strong>.
                      {t("adminLoginMessage.preview.enableToShow")}
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            )}
          </Card>

          {/* Tips Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base sm:text-lg">💡 {t("adminLoginMessage.bestPractices.title")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs sm:text-sm text-muted-foreground">
              <ul className="space-y-2 list-disc list-inside">
                <li>{t("adminLoginMessage.bestPractices.tip1")}</li>
                <li>{t("adminLoginMessage.bestPractices.tip2")}</li>
                <li>{t("adminLoginMessage.bestPractices.tip3")}</li>
                <li>{t("adminLoginMessage.bestPractices.tip4")}</li>
                <li>{t("adminLoginMessage.bestPractices.tip5")}</li>
                <li>{t("adminLoginMessage.bestPractices.tip6")}</li>
                <li>{t("adminLoginMessage.bestPractices.tip7")}</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default LoginMessage;
