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
import { MessageSquare, Save, RotateCcw, AlertCircle, Info, Loader2 } from "lucide-react";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useTranslation } from "react-i18next";
import { useLanguageSync } from "@/hooks/useLanguageSync";

interface ReamazeConfig {
  isEnabled: boolean;
  embedCode: string;
}

const DEFAULT_CONFIG: ReamazeConfig = {
  isEnabled: false,
  embedCode: "",
};

export default function ReamazeSettings() {
  const { t } = useTranslation();
  useLanguageSync(); // Sync language and force re-render when language changes
  
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [config, setConfig] = useState<ReamazeConfig>(DEFAULT_CONFIG);
  const [hasChanges, setHasChanges] = useState(false);

  // Fetch reamaze settings
  const { data: configData, isLoading } = useQuery({
    queryKey: ['reamaze-config'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('platform_config')
        .select('value')
        .eq('key', 'reamaze_config')
        .maybeSingle();

      if (error) throw error;
      return data?.value as unknown as ReamazeConfig | null;
    },
  });

  // Update state when data loads
  useEffect(() => {
    if (configData && typeof configData === 'object') {
      setConfig({ ...DEFAULT_CONFIG, ...configData });
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
        title: t("admin.contentManagement.reamazeSettings.settingsSaved"),
        description: t("admin.contentManagement.reamazeSettings.settingsSavedDescription"),
      });
    },
    onError: (error) => {
      toast({
        title: t("admin.contentManagement.reamazeSettings.errorSaving"),
        description: error.message || t("admin.contentManagement.reamazeSettings.errorSavingDescription"),
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
      title: t("admin.contentManagement.reamazeSettings.changesDiscarded"),
      description: t("admin.contentManagement.reamazeSettings.changesDiscardedDescription"),
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <LoadingSpinner size="lg" text={t("common.loading")} />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 space-y-6 max-w-7xl">
      <AdminBreadcrumb
        items={[
          { label: t("admin.contentManagement.reamazeSettings.breadcrumb.communications") },
          { label: t("admin.contentManagement.reamazeSettings.breadcrumb.liveChatSettings") },
        ]}
      />

      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="max-w-2xl">
          <h1 className="text-2xl sm:text-3xl font-bold break-words">{t("admin.contentManagement.reamazeSettings.title")}</h1>
          <p className="text-muted-foreground mt-1 break-words">
            {t("admin.contentManagement.reamazeSettings.subtitle")}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 lg:justify-end">
          <Button
            variant="outline"
            onClick={handleReset}
            disabled={!hasChanges || saveMutation.isPending}
            className="flex-1 sm:flex-none"
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            <span className="truncate">{t("admin.contentManagement.reamazeSettings.discardChanges")}</span>
          </Button>

          <Button
            onClick={handleSave}
            disabled={!hasChanges || saveMutation.isPending}
            className="flex-1 sm:flex-none"
          >
            {saveMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            <span className="truncate">{t("admin.contentManagement.reamazeSettings.saveSettings")}</span>
          </Button>
        </div>
      </div>

      <Alert className="overflow-hidden">
        <Info className="h-4 w-4" />
        <AlertTitle>{t("admin.contentManagement.reamazeSettings.important")}</AlertTitle>
        <AlertDescription className="break-words">
          {t("admin.contentManagement.reamazeSettings.importantDescription")}
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <div className="flex flex-row items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <CardTitle className="break-words">{t("admin.contentManagement.reamazeSettings.enableLiveChat.title")}</CardTitle>
              <CardDescription className="break-words">
                {t("admin.contentManagement.reamazeSettings.enableLiveChat.description")}
              </CardDescription>
            </div>
            <Switch
              checked={config.isEnabled}
              onCheckedChange={handleToggle}
              className="mt-1"
            />
          </div>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("admin.contentManagement.reamazeSettings.embedCode.title")}</CardTitle>
          <CardDescription>
            {t("admin.contentManagement.reamazeSettings.embedCode.description")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="embed_code">{t("admin.contentManagement.reamazeSettings.embedCode.label")}</Label>
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
              <p className="font-medium text-foreground">{t("admin.contentManagement.reamazeSettings.embedCode.howToGetCode")}</p>
              <ol className="list-decimal ml-4 space-y-1">
                <li>{t("admin.contentManagement.reamazeSettings.embedCode.step1")}</li>
                <li>{t("admin.contentManagement.reamazeSettings.embedCode.step2")}</li>
                <li>{t("admin.contentManagement.reamazeSettings.embedCode.step3")}</li>
                <li>{t("admin.contentManagement.reamazeSettings.embedCode.step4")}</li>
                <li>{t("admin.contentManagement.reamazeSettings.embedCode.step5")}</li>
              </ol>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
