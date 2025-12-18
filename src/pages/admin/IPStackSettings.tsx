import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminBreadcrumb } from "@/components/admin/AdminBreadcrumb";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Globe, CheckCircle2, AlertCircle, Key, TestTube } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { z } from "zod";

// Validation schema
const ipstackSettingsSchema = z.object({
  api_key: z.string().trim().min(1, "API key is required").max(200, "API key too long"),
});

interface IPStackSettings {
  api_key: string;
}

export default function IPStackSettings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [settings, setSettings] = useState<IPStackSettings>({ api_key: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [hasChanges, setHasChanges] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // Fetch IPStack settings
  const { data: configData, isLoading } = useQuery({
    queryKey: ['ipstack-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('platform_config')
        .select('value')
        .eq('key', 'ipstack_api_key')
        .maybeSingle();

      if (error) throw error;
      return data?.value as string | null;
    },
  });

  // Update settings when data loads
  useEffect(() => {
    if (configData) {
      setSettings({ api_key: configData });
      setHasChanges(false);
    }
  }, [configData]);

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async (newSettings: IPStackSettings) => {
      const { error } = await supabase
        .from('platform_config')
        .upsert({
          key: 'ipstack_api_key',
          value: newSettings.api_key,
          description: 'IPStack API access key for geolocation services',
          updated_at: new Date().toISOString(),
        }, { onConflict: 'key' });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ipstack-settings'] });
      setHasChanges(false);
      toast({
        title: "Settings saved",
        description: "IPStack API key has been updated successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error saving settings",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Test API key mutation
  const testMutation = useMutation({
    mutationFn: async (apiKey: string) => {
      // Test with a known IP address (Google's public DNS)
      const testIP = "8.8.8.8";
      const response = await fetch(
        `https://api.ipstack.com/${testIP}?access_key=${apiKey}`
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: { info: 'Unknown error' } }));
        throw new Error(errorData.error?.info || `HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error.info || 'API returned an error');
      }

      return data;
    },
    onSuccess: (data) => {
      setTestResult({
        success: true,
        message: `✅ API key is valid! Test IP (8.8.8.8) resolved to: ${data.country_name} (${data.country_code})`,
      });
      toast({
        title: "Test successful",
        description: "IPStack API key is working correctly.",
      });
    },
    onError: (error: any) => {
      setTestResult({
        success: false,
        message: `❌ Test failed: ${error.message}`,
      });
      toast({
        title: "Test failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleInputChange = (field: keyof IPStackSettings, value: string) => {
    setSettings(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);
    setErrors(prev => ({ ...prev, [field]: "" }));
    setTestResult(null);
  };

  const handleSave = () => {
    // Validate settings
    try {
      ipstackSettingsSchema.parse(settings);
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

  const handleTest = () => {
    if (!settings.api_key.trim()) {
      toast({
        title: "API key required",
        description: "Please enter an API key before testing.",
        variant: "destructive",
      });
      return;
    }

    setIsTesting(true);
    setTestResult(null);
    testMutation.mutate(settings.api_key, {
      onSettled: () => {
        setIsTesting(false);
      },
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      <AdminBreadcrumb
        items={[
          { label: "Settings" },
          { label: "IPStack Configuration" },
        ]}
      />

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            <div>
              <CardTitle>IPStack Geolocation Settings</CardTitle>
              <CardDescription>
                Configure IPStack API key for user IP address and geolocation detection
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              IPStack is used to detect user IP addresses and map them to countries during registration and login.
              Get your API key from{" "}
              <a
                href="https://ipstack.com/dashboard"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline font-medium"
              >
                IPStack Dashboard
              </a>
              .
            </AlertDescription>
          </Alert>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="api_key" className="flex items-center gap-2">
                <Key className="h-4 w-4" />
                API Access Key
              </Label>
              <Input
                id="api_key"
                type="password"
                placeholder="Enter your IPStack API access key"
                value={settings.api_key}
                onChange={(e) => handleInputChange('api_key', e.target.value)}
                className={errors.api_key ? "border-destructive" : ""}
              />
              {errors.api_key && (
                <p className="text-sm text-destructive">{errors.api_key}</p>
              )}
              <p className="text-sm text-muted-foreground">
                Your IPStack API access key. This key is stored securely in the database.
              </p>
            </div>

            {/* Test Result */}
            {testResult && (
              <Alert variant={testResult.success ? "default" : "destructive"}>
                {testResult.success ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <AlertCircle className="h-4 w-4" />
                )}
                <AlertDescription className="whitespace-pre-line">
                  {testResult.message}
                </AlertDescription>
              </Alert>
            )}

            {/* Action Buttons */}
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handleTest}
                disabled={isTesting || !settings.api_key.trim() || saveMutation.isPending}
              >
                {isTesting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Testing...
                  </>
                ) : (
                  <>
                    <TestTube className="h-4 w-4 mr-2" />
                    Test API Key
                  </>
                )}
              </Button>
              <Button
                onClick={handleSave}
                disabled={!hasChanges || saveMutation.isPending || !settings.api_key.trim()}
              >
                {saveMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save Settings"
                )}
              </Button>
            </div>
          </div>

          {/* Information Section */}
          <div className="border-t pt-6 space-y-4">
            <h3 className="text-sm font-semibold">How It Works</h3>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>
                • IPStack detects user IP addresses during registration and login
              </p>
              <p>
                • IP addresses are mapped to countries and stored in user profiles
              </p>
              <p>
                • Location data is displayed in the admin panel for security monitoring
              </p>
              <p>
                • API calls are cached for 1 hour to reduce usage and improve performance
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
