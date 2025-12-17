import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Zap, RotateCcw, AlertCircle, CheckCircle2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface FeeSavingsBannerConfig {
  isVisible: boolean;
  title: string;
  subtitle: string;
  recommendedBadge: string;
  option1: {
    label: string;
    icon: string;
  };
  option2: {
    label: string;
    icon: string;
  };
  highlightText: string;
  benefitsText: string;
  footerText: string;
}

const DEFAULT_CONFIG: FeeSavingsBannerConfig = {
  isVisible: true,
  title: "⚡ Save on Fees!",
  subtitle: "For the best experience, deposit using",
  recommendedBadge: "Recommended",
  option1: {
    label: "⚡ USDC (Solana network)",
    icon: "⚡"
  },
  option2: {
    label: "🚀 USDT - BEP20 (BSC Network)",
    icon: "🚀"
  },
  highlightText: "— especially for GCash/GCrypto users.",
  benefitsText: "You'll enjoy ultra-low fees and faster confirmations.",
  footerText: "WE SUPPORT ALL OTHER COINS, YOU CAN CHOOSE ANY COIN."
};

export default function FeeSavingsBannerSettings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [config, setConfig] = useState<FeeSavingsBannerConfig>(DEFAULT_CONFIG);
  const [hasChanges, setHasChanges] = useState(false);

  // Fetch banner config
  const { data: configData, isLoading } = useQuery({
    queryKey: ['fee-savings-banner-config'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('platform_config')
        .select('value')
        .eq('key', 'fee_savings_banner')
        .maybeSingle();

      if (error) throw error;
      return (data?.value as FeeSavingsBannerConfig) || DEFAULT_CONFIG;
    },
  });

  // Update config when data loads
  useEffect(() => {
    if (configData) {
      setConfig({ ...DEFAULT_CONFIG, ...configData });
      setHasChanges(false);
    }
  }, [configData]);

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async (newConfig: FeeSavingsBannerConfig) => {
      const { error } = await supabase
        .from('platform_config')
        .upsert({
          key: 'fee_savings_banner',
          value: newConfig,
          description: 'Configuration for the fee savings banner shown on wallet page and deposit dialog',
          updated_at: new Date().toISOString(),
        }, { onConflict: 'key' });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fee-savings-banner-config'] });
      setHasChanges(false);
      toast({
        title: "Settings saved",
        description: "Fee savings banner settings have been updated successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error saving settings",
        description: error.message || "Failed to save settings. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    saveMutation.mutate(config);
  };

  const handleReset = () => {
    setConfig(DEFAULT_CONFIG);
    setHasChanges(true);
  };

  const updateConfig = (updates: Partial<FeeSavingsBannerConfig>) => {
    setConfig((prev) => ({ ...prev, ...updates }));
    setHasChanges(true);
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
    <div className="container mx-auto px-4 py-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Zap className="h-8 w-8 text-amber-600" />
            Fee Savings Banner Settings
          </h1>
          <p className="text-muted-foreground mt-2">
            Configure the "Save on Fees" banner that appears on the wallet page and deposit dialog
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Banner Configuration</CardTitle>
            <CardDescription>
              Control visibility and customize the content of the fee savings banner
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Visibility Toggle */}
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="space-y-0.5">
                <Label htmlFor="isVisible" className="text-base font-semibold">
                  Show Banner
                </Label>
                <p className="text-sm text-muted-foreground">
                  Toggle visibility of the fee savings banner on wallet page and deposit dialog
                </p>
              </div>
              <Switch
                id="isVisible"
                checked={config.isVisible}
                onCheckedChange={(checked) => updateConfig({ isVisible: checked })}
              />
            </div>

            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="title">Banner Title</Label>
              <Input
                id="title"
                value={config.title}
                onChange={(e) => updateConfig({ title: e.target.value })}
                placeholder="⚡ Save on Fees!"
              />
            </div>

            {/* Recommended Badge */}
            <div className="space-y-2">
              <Label htmlFor="recommendedBadge">Recommended Badge Text</Label>
              <Input
                id="recommendedBadge"
                value={config.recommendedBadge}
                onChange={(e) => updateConfig({ recommendedBadge: e.target.value })}
                placeholder="Recommended"
              />
            </div>

            {/* Subtitle */}
            <div className="space-y-2">
              <Label htmlFor="subtitle">Subtitle</Label>
              <Input
                id="subtitle"
                value={config.subtitle}
                onChange={(e) => updateConfig({ subtitle: e.target.value })}
                placeholder="For the best experience, deposit using"
              />
            </div>

            {/* Option 1 */}
            <div className="space-y-4 p-4 border rounded-lg">
              <Label className="text-base font-semibold">First Payment Option</Label>
              <div className="space-y-2">
                <Label htmlFor="option1-label">Option Label</Label>
                <Input
                  id="option1-label"
                  value={config.option1.label}
                  onChange={(e) => updateConfig({ 
                    option1: { ...config.option1, label: e.target.value }
                  })}
                  placeholder="⚡ USDC (Solana network)"
                />
              </div>
            </div>

            {/* Option 2 */}
            <div className="space-y-4 p-4 border rounded-lg">
              <Label className="text-base font-semibold">Second Payment Option</Label>
              <div className="space-y-2">
                <Label htmlFor="option2-label">Option Label</Label>
                <Input
                  id="option2-label"
                  value={config.option2.label}
                  onChange={(e) => updateConfig({ 
                    option2: { ...config.option2, label: e.target.value }
                  })}
                  placeholder="🚀 USDT - BEP20 (BSC Network)"
                />
              </div>
            </div>

            {/* Highlight Text */}
            <div className="space-y-2">
              <Label htmlFor="highlightText">Highlight Text</Label>
              <Input
                id="highlightText"
                value={config.highlightText}
                onChange={(e) => updateConfig({ highlightText: e.target.value })}
                placeholder="— especially for GCash/GCrypto users."
              />
            </div>

            {/* Benefits Text */}
            <div className="space-y-2">
              <Label htmlFor="benefitsText">Benefits Text</Label>
              <Textarea
                id="benefitsText"
                value={config.benefitsText}
                onChange={(e) => updateConfig({ benefitsText: e.target.value })}
                placeholder="You'll enjoy ultra-low fees and faster confirmations."
                rows={3}
              />
            </div>

            {/* Footer Text */}
            <div className="space-y-2">
              <Label htmlFor="footerText">Footer Text</Label>
              <Textarea
                id="footerText"
                value={config.footerText}
                onChange={(e) => updateConfig({ footerText: e.target.value })}
                placeholder="WE SUPPORT ALL OTHER COINS, YOU CAN CHOOSE ANY COIN."
                rows={2}
              />
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-between pt-4 border-t">
              <Button
                variant="outline"
                onClick={handleReset}
                disabled={saveMutation.isPending}
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Reset to Defaults
              </Button>
              <Button
                onClick={handleSave}
                disabled={!hasChanges || saveMutation.isPending}
              >
                {saveMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Save Changes
                  </>
                )}
              </Button>
            </div>

            {saveMutation.isSuccess && (
              <Alert>
                <CheckCircle2 className="h-4 w-4" />
                <AlertDescription>
                  Settings saved successfully! Changes will be reflected on the wallet page and deposit dialog.
                </AlertDescription>
              </Alert>
            )}

            {saveMutation.isError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Failed to save settings. Please try again.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      </div>
  );
}
