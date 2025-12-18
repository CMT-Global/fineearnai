import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

import { AdminBreadcrumb } from "@/components/admin/AdminBreadcrumb";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Loader2, MessageSquare, Save, RotateCcw, AlertCircle, Info } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface ReamazeConfig {
  isEnabled: boolean;
  embedCode: string;
}

const DEFAULT_CONFIG: ReamazeConfig = {
  isEnabled: false,
  embedCode: "",
};

export default function ReamazeSettings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [config, setConfig] = useState<ReamazeConfig>(DEFAULT_CONFIG);
  const [hasChanges, setHasChanges] = useState(false);

  // Fetch Reamaze settings
  const { data: configData, isLoading } = useQuery({
    queryKey: ['reamaze-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('platform_config')
        .select('value')
        .eq('key', 'reamaze_config')
        .maybeSingle();

      if (error) throw error;
      return (data?.value as unknown as ReamazeConfig) || DEFAULT_CONFIG;
    },
  });

  // Update state when data loads
  useEffect(() => {
    if (configData) {
      setConfig(configData);
    }
  }, [configData]);

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async (newConfig: ReamazeConfig) => {
      const { error } = await supabase
        .from('platform_config')
        .upsert({
          key: 'reamaze_config',
          value: newConfig as any,
          description: 'Reamaze Livechat configuration (enable/disable and embed script)',
          updated_at: new Date().toISOString(),
        }, { onConflict: 'key' });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reamaze-settings'] });
      queryClient.invalidateQueries({ queryKey: ['reamaze-config'] });
      setHasChanges(false);
      toast({
        title: "Settings saved",
        description: "Reamaze configuration has been updated successfully.",
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

  const handleToggle = (enabled: boolean) => {
    setConfig(prev => ({ ...prev, isEnabled: enabled }));
    setHasChanges(true);
  };

  const handleCodeChange = (code: string) => {
    setConfig(prev => ({ ...prev, embedCode: code }));
    setHasChanges(true);
  };

  const handleSave = () => {
    saveMutation.mutate(config);
  };

  const handleReset = () => {
    if (configData) {
      setConfig(configData);
    } else {
      setConfig(DEFAULT_CONFIG);
    }
    setHasChanges(false);
    toast({
      title: "Changes discarded",
      description: "Settings have been reverted to the last saved state.",
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
          { label: "Communications" },
          { label: "Live Chat Settings" },
        ]}
      />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Live Chat Settings</h1>
          <p className="text-muted-foreground mt-1">
            Configure Reamaze Live Chat integration and visibility
          </p>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleReset}
            disabled={!hasChanges || saveMutation.isPending}
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Discard Changes
          </Button>

          <Button
            onClick={handleSave}
            disabled={!hasChanges || saveMutation.isPending}
          >
            {saveMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Save Settings
          </Button>
        </div>
      </div>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>Important</AlertTitle>
        <AlertDescription>
          The live chat will only appear on the public platform and user dashboard. It is automatically hidden on all admin panel pages to avoid interference with admin tools.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Enable Live Chat</CardTitle>
              <CardDescription>
                Turn Reamaze Live Chat on or off for all users.
              </CardDescription>
            </div>
            <Switch
              checked={config.isEnabled}
              onCheckedChange={handleToggle}
            />
          </div>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Reamaze Embed Code</CardTitle>
          <CardDescription>
            Paste your Reamaze installation script here. You can find this in your Reamaze account settings under Settings &gt; Installation.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="embed_code">JavaScript Embed Code</Label>
            <Textarea
              id="embed_code"
              value={config.embedCode}
              onChange={(e) => handleCodeChange(e.target.value)}
              placeholder="<!-- Reamaze Live Chat Widget -->\n<script ...>...</script>"
              rows={15}
              className="font-mono text-sm"
            />
          </div>

          <div className="bg-muted p-4 rounded-lg flex gap-3">
            <AlertCircle className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
            <div className="text-sm text-muted-foreground space-y-2">
              <p className="font-medium text-foreground">How to get your code:</p>
              <ol className="list-decimal ml-4 space-y-1">
                <li>Log in to your <strong>Reamaze.com</strong> account.</li>
                <li>Go to <strong>Settings</strong> &gt; <strong>Installation</strong>.</li>
                <li>Choose <strong>Shoutbox</strong> or <strong>Web Chat</strong>.</li>
                <li>Copy the entire script block and paste it above.</li>
                <li>Ensure the code includes both the <code>reamaze-loader.js</code> script and the <code>_support</code> configuration block.</li>
              </ol>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
