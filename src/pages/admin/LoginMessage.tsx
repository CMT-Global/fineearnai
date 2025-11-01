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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  MessageSquare,
  Eye,
  EyeOff,
  Save,
  RotateCcw,
  AlertCircle,
  Sparkles,
  Info,
} from "lucide-react";
import { toast } from "sonner";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

interface LoginMessageConfig {
  enabled: boolean;
  title: string;
  body: string;
  show_once_per_session: boolean;
  dismissible: boolean;
  priority: "low" | "medium" | "high";
}

const DEFAULT_CONFIG: LoginMessageConfig = {
  enabled: true,
  title: "Welcome to FineEarn!",
  body: "<p>We're excited to have you here. Start earning today by completing AI training tasks!</p>",
  show_once_per_session: false,
  dismissible: true,
  priority: "medium",
};

const LoginMessage = () => {
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdmin();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [config, setConfig] = useState<LoginMessageConfig>(DEFAULT_CONFIG);
  const [showPreview, setShowPreview] = useState(false);
  const [characterCount, setCharacterCount] = useState(0);

  // Fetch current login message config
  const { data: currentConfig, isLoading } = useQuery({
    queryKey: ["login-message-admin-config"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("platform_config")
        .select("value")
        .eq("key", "login_message")
        .maybeSingle();

      if (error) throw error;
      return data?.value as unknown as LoginMessageConfig | null;
    },
    staleTime: 0, // Always fetch fresh data in admin
  });

  // Update local state when config loads
  useEffect(() => {
    if (currentConfig) {
      setConfig(currentConfig);
      setCharacterCount(currentConfig.title.length);
    }
  }, [currentConfig]);

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

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async (newConfig: LoginMessageConfig) => {
      const { error } = await supabase
        .from("platform_config")
        .update({
          value: newConfig as any,
          updated_at: new Date().toISOString(),
        })
        .eq("key", "login_message");

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["login-message-admin-config"] });
      queryClient.invalidateQueries({ queryKey: ["login-message-config"] });
      toast.success("Login message updated successfully!");
    },
    onError: (error: any) => {
      console.error("Error saving login message:", error);
      toast.error(`Failed to save: ${error.message}`);
    },
  });

  const handleSave = () => {
    // Validation
    if (!config.title.trim()) {
      toast.error("Title is required");
      return;
    }

    if (config.title.length > 100) {
      toast.error("Title must be 100 characters or less");
      return;
    }

    if (!config.body.trim()) {
      toast.error("Message body is required");
      return;
    }

    if (config.body.length > 5000) {
      toast.error("Message body must be 5000 characters or less");
      return;
    }

    saveMutation.mutate(config);
  };

  const handleReset = () => {
    if (confirm("Are you sure you want to reset to default settings? This cannot be undone.")) {
      setConfig(DEFAULT_CONFIG);
      setCharacterCount(DEFAULT_CONFIG.title.length);
      toast.info("Reset to default configuration");
    }
  };

  const handleTitleChange = (value: string) => {
    if (value.length <= 100) {
      setConfig({ ...config, title: value });
      setCharacterCount(value.length);
    }
  };

  if (authLoading || adminLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" text="Loading configuration..." />
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <MessageSquare className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold">Login Message Configuration</h1>
        </div>
        <p className="text-muted-foreground">
          Customize the welcome message displayed to users after they log in
        </p>
      </div>

      {/* Info Alert */}
      <Alert className="mb-6">
        <Info className="h-4 w-4" />
        <AlertDescription className="text-sm">
          <strong>How it works:</strong> This message appears as a pop-up dialog immediately after users log in.
          You can enable/disable it, control whether users can dismiss it, and decide if it should only show once per session.
          Use HTML tags for formatting: <code className="text-xs bg-muted px-1 py-0.5 rounded">&lt;p&gt;</code>, <code className="text-xs bg-muted px-1 py-0.5 rounded">&lt;strong&gt;</code>, <code className="text-xs bg-muted px-1 py-0.5 rounded">&lt;ul&gt;</code>, <code className="text-xs bg-muted px-1 py-0.5 rounded">&lt;li&gt;</code>, etc.
        </AlertDescription>
      </Alert>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Editor Panel */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Message Configuration
              </CardTitle>
              <CardDescription>
                Configure the login message content and behavior
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Enable/Disable Toggle */}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="enabled" className="text-base font-medium">
                    Enable Login Message
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Show message to users after they log in
                  </p>
                </div>
                <Switch
                  id="enabled"
                  checked={config.enabled}
                  onCheckedChange={(checked) =>
                    setConfig({ ...config, enabled: checked })
                  }
                />
              </div>

              <Separator />

              {/* Title Input */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="title">
                    Title <span className="text-destructive">*</span>
                  </Label>
                  <span className="text-xs text-muted-foreground">
                    {characterCount}/100
                  </span>
                </div>
                <Input
                  id="title"
                  placeholder="Welcome to FineEarn!"
                  value={config.title}
                  onChange={(e) => handleTitleChange(e.target.value)}
                  maxLength={100}
                  className={characterCount > 90 ? "border-amber-500" : ""}
                />
                <p className="text-xs text-muted-foreground">
                  A short, catchy title for the message (max 100 characters)
                </p>
              </div>

              {/* Body Textarea */}
              <div className="space-y-2">
                <Label htmlFor="body">
                  Message Body <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  id="body"
                  placeholder="<p>We're excited to have you here. Start earning today!</p>"
                  value={config.body}
                  onChange={(e) => setConfig({ ...config, body: e.target.value })}
                  rows={10}
                  maxLength={5000}
                  className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  HTML content (max 5000 chars). Supported tags: &lt;p&gt;, &lt;h1-h3&gt;, &lt;strong&gt;, &lt;em&gt;, &lt;ul&gt;, &lt;ol&gt;, &lt;li&gt;, &lt;a&gt;, &lt;br&gt;
                </p>
              </div>

              <Separator />

              {/* Behavior Options */}
              <div className="space-y-4">
                <h3 className="font-medium">Behavior Options</h3>

                {/* Dismissible */}
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="dismissible" className="text-sm font-medium">
                      Allow Dismissal
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Let users close the message dialog
                    </p>
                  </div>
                  <Switch
                    id="dismissible"
                    checked={config.dismissible}
                    onCheckedChange={(checked) =>
                      setConfig({ ...config, dismissible: checked })
                    }
                  />
                </div>

                {/* Show Once Per Session */}
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="show_once" className="text-sm font-medium">
                      Show Once Per Session
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Only display once per 24-hour period
                    </p>
                  </div>
                  <Switch
                    id="show_once"
                    checked={config.show_once_per_session}
                    onCheckedChange={(checked) =>
                      setConfig({ ...config, show_once_per_session: checked })
                    }
                  />
                </div>

                {/* Priority */}
                <div className="space-y-2">
                  <Label htmlFor="priority">Display Priority</Label>
                  <Select
                    value={config.priority}
                    onValueChange={(value: "low" | "medium" | "high") =>
                      setConfig({ ...config, priority: value })
                    }
                  >
                    <SelectTrigger id="priority">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Priority level (for future use with multiple messages)
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <Button
              onClick={handleSave}
              disabled={saveMutation.isPending}
              className="flex-1"
              size="lg"
            >
              {saveMutation.isPending ? (
                <>
                  <LoadingSpinner size="sm" className="mr-2" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
            <Button
              onClick={handleReset}
              variant="outline"
              size="lg"
              disabled={saveMutation.isPending}
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Reset
            </Button>
          </div>
        </div>

        {/* Preview Panel */}
        <div className="space-y-6">
          <Card className="sticky top-8">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  {showPreview ? (
                    <Eye className="h-5 w-5" />
                  ) : (
                    <EyeOff className="h-5 w-5" />
                  )}
                  Live Preview
                </CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowPreview(!showPreview)}
                >
                  {showPreview ? "Hide" : "Show"} Preview
                </Button>
              </div>
              <CardDescription>
                See how the message will appear to users
              </CardDescription>
            </CardHeader>
            {showPreview && (
              <CardContent>
                {config.enabled ? (
                  <div className="border-2 border-dashed border-muted rounded-lg p-4 bg-muted/10">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Sparkles className="h-5 w-5 text-primary" />
                          <h3 className="text-lg font-bold">{config.title}</h3>
                        </div>
                        {config.dismissible && (
                          <Badge variant="secondary" className="text-xs">
                            Dismissible
                          </Badge>
                        )}
                      </div>
                      <Separator />
                      <div
                        className="prose prose-sm dark:prose-invert max-w-none text-sm"
                        dangerouslySetInnerHTML={{ __html: config.body }}
                      />
                      {config.show_once_per_session && (
                        <p className="text-xs text-muted-foreground italic">
                          ℹ️ Will only show once per 24-hour period
                        </p>
                      )}
                      <Badge
                        variant="outline"
                        className="capitalize text-xs"
                      >
                        Priority: {config.priority}
                      </Badge>
                    </div>
                  </div>
                ) : (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      Login message is currently <strong>disabled</strong>.
                      Enable it to show a preview.
                    </AlertDescription>
                  </Alert>
                )}

                {config.enabled && (
                  <div className="mt-4">
                    <Button
                      variant="secondary"
                      size="sm"
                      className="w-full"
                      onClick={() => {
                        // Open full preview dialog
                        const dialog = document.createElement("div");
                        dialog.innerHTML = "Full preview would appear here";
                      }}
                    >
                      View Full-Size Preview
                    </Button>
                  </div>
                )}
              </CardContent>
            )}
          </Card>

          {/* Tips Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">💡 Best Practices</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <ul className="space-y-2 list-disc list-inside">
                <li>Keep the title short and welcoming (under 50 chars is ideal)</li>
                <li>Use simple HTML for better readability</li>
                <li>Include emojis to make it more engaging</li>
                <li>Test with "Show Preview" before saving</li>
                <li>Enable "Show Once Per Session" to avoid annoying users</li>
                <li>Make it dismissible unless it's critical information</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default LoginMessage;
