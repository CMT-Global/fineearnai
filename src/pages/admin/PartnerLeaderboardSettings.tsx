import { useState, useEffect } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Trophy } from "lucide-react";

const PartnerLeaderboardSettings = () => {
  const queryClient = useQueryClient();
  const [isEnabled, setIsEnabled] = useState(false);

  const { data: config, isLoading } = useQuery({
    queryKey: ['partner-leaderboard-config'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('platform_config')
        .select('*')
        .eq('key', 'partner_leaderboard_enabled')
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
  });

  useEffect(() => {
    if (config) {
      setIsEnabled(config.value === true);
    }
  }, [config]);

  const updateMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      if (config) {
        const { error } = await supabase
          .from('platform_config')
          .update({ value: enabled, updated_at: new Date().toISOString() })
          .eq('key', 'partner_leaderboard_enabled');

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('platform_config')
          .insert({
            key: 'partner_leaderboard_enabled',
            value: enabled,
            description: 'Controls visibility of partner leaderboard in partner dashboard'
          });

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['partner-leaderboard-config'] });
      toast.success("Leaderboard settings updated successfully");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to update settings");
    },
  });

  const handleToggle = (checked: boolean) => {
    setIsEnabled(checked);
    updateMutation.mutate(checked);
  };

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Trophy className="h-8 w-8" />
          Partner Leaderboard Settings
        </h1>
        <p className="text-muted-foreground mt-1">
          Control leaderboard visibility for partners
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Leaderboard Visibility</CardTitle>
          <CardDescription>
            Show or hide the partner leaderboard in the partner dashboard
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="space-y-0.5">
                  <Label htmlFor="leaderboard-toggle" className="text-base">
                    Enable Partner Leaderboard
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    When enabled, partners can see top performers ranked by sales
                  </p>
                </div>
                <Switch
                  id="leaderboard-toggle"
                  checked={isEnabled}
                  onCheckedChange={handleToggle}
                  disabled={updateMutation.isPending}
                />
              </div>

              <div className="bg-muted/50 p-4 rounded-lg">
                <p className="text-sm text-muted-foreground">
                  <strong>Note:</strong> The leaderboard displays top 50 partners with filters for different time periods (week, month, year, all-time). Partners can only see rankings, not detailed sales figures of others.
                </p>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default PartnerLeaderboardSettings;
