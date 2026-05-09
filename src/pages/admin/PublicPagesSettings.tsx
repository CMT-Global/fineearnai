import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import {
  Globe2,
  RotateCcw,
  AlertCircle,
  CheckCircle2,
  Loader2,
  ExternalLink,
  ShieldCheck,
} from "lucide-react";
import { PageLoading } from "@/components/shared/PageLoading";
import { AdminBreadcrumb } from "@/components/admin/AdminBreadcrumb";

interface PublicPagesConfig {
  withdrawalsHistoryEnabled: boolean;
}

const DEFAULT_CONFIG: PublicPagesConfig = {
  withdrawalsHistoryEnabled: false,
};

export default function PublicPagesSettings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [config, setConfig] = useState<PublicPagesConfig>(DEFAULT_CONFIG);
  const [hasChanges, setHasChanges] = useState(false);

  // ── Fetch current settings ──────────────────────────────────────────────
  const { data, isLoading } = useQuery({
    queryKey: ["public-pages-settings"],
    queryFn: async () => {
      const { data: configData, error } = await supabase
        .from("platform_config")
        .select("key, value")
        .eq("key", "public_pages")
        .maybeSingle();

      if (error) throw error;

      return (configData?.value as PublicPagesConfig) || DEFAULT_CONFIG;
    },
  });

  useEffect(() => {
    if (data) {
      setConfig({ ...DEFAULT_CONFIG, ...data });
      setHasChanges(false);
    }
  }, [data]);

  // ── Save mutation ───────────────────────────────────────────────────────
  const saveMutation = useMutation({
    mutationFn: async (payload: PublicPagesConfig) => {
      const { error } = await supabase.from("platform_config").upsert(
        [
          {
            key: "public_pages",
            value: payload as unknown as Json,
            description:
              "Controls visibility of public-facing pages like the Withdrawals History page",
            updated_at: new Date().toISOString(),
          },
        ],
        { onConflict: "key" }
      );
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["public-pages-settings"] });
      queryClient.invalidateQueries({ queryKey: ["public-pages-config"] });
      setHasChanges(false);
      toast({
        title: "Settings saved",
        description: "Public pages settings updated successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error saving settings",
        description: error.message || "An unexpected error occurred.",
        variant: "destructive",
      });
    },
  });

  const updateConfig = (updates: Partial<PublicPagesConfig>) => {
    setConfig((prev) => ({ ...prev, ...updates }));
    setHasChanges(true);
  };

  if (isLoading) {
    return <PageLoading text="Loading public page settings…" />;
  }

  return (
    <div className="container mx-auto px-4 py-8 space-y-6 max-w-5xl">
      <AdminBreadcrumb
        items={[
          { label: "Content Management" },
          { label: "Public Pages" },
        ]}
      />

      <div>
        <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2 break-words">
          <Globe2 className="h-8 w-8 text-primary shrink-0" />
          <span>Public Pages</span>
        </h1>
        <p className="text-muted-foreground mt-2">
          Control which public-facing pages are visible to visitors and linked
          in the site footer.
        </p>
      </div>

      {/* Privacy Notice */}
      <Alert>
        <ShieldCheck className="h-4 w-4" />
        <AlertDescription>
          Public pages are privacy-safe by design. The Withdrawals History page
          masks usernames (e.g. <strong>jo***</strong>), shows only country
          flags, and never exposes emails, phone numbers, wallet addresses, or
          any private payout details.
        </AlertDescription>
      </Alert>

      {/* Withdrawals History Toggle */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 break-words">
            <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
            Withdrawals History Page
          </CardTitle>
          <CardDescription className="break-words">
            When enabled, a public page at{" "}
            <a
              href="/withdrawals-history"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline inline-flex items-center gap-1"
            >
              /withdrawals-history
              <ExternalLink className="h-3 w-3" />
            </a>{" "}
            shows completed withdrawal records to build trust with new users.
            The footer link also appears automatically when enabled.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 border rounded-lg gap-4">
            <div className="space-y-1">
              <Label
                htmlFor="withdrawals-history-toggle"
                className="text-base font-semibold break-words cursor-pointer"
              >
                Show Withdrawals History page
              </Label>
              <p className="text-sm text-muted-foreground break-words">
                {config.withdrawalsHistoryEnabled
                  ? "✅ Page is live at /withdrawals-history. Footer link is visible."
                  : "❌ Page is hidden. Visitors will see a \"Page Not Available\" message."}
              </p>
            </div>
            <Switch
              id="withdrawals-history-toggle"
              checked={config.withdrawalsHistoryEnabled}
              onCheckedChange={(checked) =>
                updateConfig({ withdrawalsHistoryEnabled: checked })
              }
            />
          </div>

          {config.withdrawalsHistoryEnabled && (
            <Alert>
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <AlertDescription className="text-green-700 dark:text-green-400">
                The Withdrawals History page is <strong>enabled</strong>. 
                It shows only completed withdrawals with masked usernames, 
                country flags, net amounts, payment method display names, and 
                timestamps. No private data is ever exposed.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Actions */}
      <Card>
        <CardContent className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 py-4">
          <div className="space-y-1 text-sm text-muted-foreground">
            <p>Changes apply immediately after saving.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
            <Button
              variant="outline"
              onClick={() => {
                setConfig({ ...DEFAULT_CONFIG, ...(data || {}) });
                setHasChanges(false);
              }}
              disabled={saveMutation.isPending}
              className="flex-1 sm:flex-none"
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Discard Changes
            </Button>
            <Button
              onClick={() => saveMutation.mutate(config)}
              disabled={!hasChanges || saveMutation.isPending}
              className="flex-1 sm:flex-none"
            >
              {saveMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving…
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Save Changes
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
                Settings saved successfully.
              </AlertDescription>
            </Alert>
          </CardContent>
        )}

        {saveMutation.isError && (
          <CardContent className="pt-0">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Failed to save settings. Please try again.
              </AlertDescription>
            </Alert>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
