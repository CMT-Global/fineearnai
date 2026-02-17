import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminBreadcrumb } from "@/components/admin/AdminBreadcrumb";
import { AdminErrorBoundary } from "@/components/admin/AdminErrorBoundary";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Zap, Loader2, Crown, Shield, RotateCcw, Check } from "lucide-react";
import { PageLoading } from "@/components/shared/PageLoading";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useTranslation } from "react-i18next";

interface Task4OptAccessConfig {
  plans_4opt: string[];
  roles_4opt: string[];
}

const DEFAULT_CONFIG: Task4OptAccessConfig = {
  plans_4opt: [],
  roles_4opt: ["trainee_4opt"],
};

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  moderator: "Moderator",
  user: "User Only",
  trainee_4opt: "4-Option Tasks (assign via User Detail → Manage Roles)",
};

// trainee_4opt commented out - uncomment to show "4-Option Tasks" role toggle
const AVAILABLE_ROLES = ["admin", "moderator", "user" /* , "trainee_4opt" */] as const;

function TaskAccess4OptContent() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [config, setConfig] = useState<Task4OptAccessConfig>(DEFAULT_CONFIG);
  const [hasChanges, setHasChanges] = useState(false);

  const { data: plans, isLoading: plansLoading } = useQuery({
    queryKey: ["membership-plans-admin"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("membership_plans")
        .select("id, name, display_name")
        .eq("is_active", true)
        .order("price", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: configData, isLoading: configLoading } = useQuery({
    queryKey: ["task-4opt-access-config"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("platform_config")
        .select("value")
        .eq("key", "task_4opt_access_config")
        .maybeSingle();
      if (error) throw error;
      return (data?.value as Task4OptAccessConfig) || DEFAULT_CONFIG;
    },
  });

  useEffect(() => {
    if (configData) {
      setConfig({
        plans_4opt: configData.plans_4opt || [],
        roles_4opt: configData.roles_4opt || ["trainee_4opt"],
      });
    }
  }, [configData]);

  const saveMutation = useMutation({
    mutationFn: async (payload: Task4OptAccessConfig) => {
      const { error } = await supabase
        .from("platform_config")
        .upsert(
          {
            key: "task_4opt_access_config",
            value: payload,
            description: "4-option AI task access: plans_4opt and roles_4opt",
            updated_at: new Date().toISOString(),
          },
          { onConflict: "key" }
        );
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["task-4opt-access-config"] });
      setHasChanges(false);
      toast.success("4-option access config saved");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to save config");
    },
  });

  const togglePlan = (planName: string) => {
    setConfig((prev) => {
      const plans = prev.plans_4opt.includes(planName)
        ? prev.plans_4opt.filter((p) => p !== planName)
        : [...prev.plans_4opt, planName];
      return { ...prev, plans_4opt: plans };
    });
    setHasChanges(true);
  };

  const toggleRole = (role: string) => {
    setConfig((prev) => {
      const roles = prev.roles_4opt.includes(role)
        ? prev.roles_4opt.filter((r) => r !== role)
        : [...prev.roles_4opt, role];
      return { ...prev, roles_4opt: roles };
    });
    setHasChanges(true);
  };

  const handleSave = () => {
    saveMutation.mutate(config);
  };

  const handleReset = () => {
    if (configData) {
      setConfig({
        plans_4opt: configData.plans_4opt || [],
        roles_4opt: configData.roles_4opt || ["trainee_4opt"],
      });
      setHasChanges(false);
    }
  };

  const isLoading = plansLoading || configLoading;

  return (
    <div className="min-h-screen bg-background">
      {/* Header with gradient accent */}
      <div className="relative overflow-hidden border-b border-border/50 bg-gradient-to-b from-card/80 to-background">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,hsl(var(--primary)/0.08),transparent_50%)]" />
        <div className="relative px-6 py-8 md:px-8">
          <div className="mx-auto max-w-4xl">
            <AdminBreadcrumb
              items={[
                { label: t("admin.sidebar.categories.taskManagement") },
                { label: "4-Option Access Control" },
              ]}
            />
            <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h1 className="flex items-center gap-3 text-2xl font-semibold tracking-tight md:text-3xl">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary">
                    <Zap className="h-5 w-5" />
                  </span>
                  4-Option Access Control
                </h1>
                <p className="mt-2 max-w-2xl text-sm text-muted-foreground leading-relaxed">
                  Configure which membership plans and roles get 4-option AI tasks. Users on enabled plans
                  or with enabled roles see 4-option questions instead of 2-option.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-6 py-8 md:px-8">
        {isLoading ? (
          <PageLoading text="Loading..." />
        ) : (
          <div className="space-y-8">
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Membership Plans Card */}
              <Card className="overflow-hidden border-border/60 bg-card/50 transition-all hover:border-primary/20 hover:shadow-[0_0_30px_hsl(var(--primary)/0.06)]">
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <Crown className="h-4 w-4" />
                      </span>
                      <div>
                        <CardTitle className="text-lg">Membership Plans</CardTitle>
                        <CardDescription className="mt-0.5">
                          Plans that grant 4-option task access
                        </CardDescription>
                      </div>
                    </div>
                    <Badge variant="secondary" className="shrink-0">
                      {config.plans_4opt.length} selected
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2 pt-0">
                  {!plans?.length ? (
                    <p className="rounded-lg border border-dashed border-border/60 py-8 text-center text-sm text-muted-foreground">
                      No active membership plans
                    </p>
                  ) : (
                    <div className="space-y-1">
                      {plans.map((plan: { id: string; name: string; display_name?: string }) => {
                        const isEnabled = config.plans_4opt.includes(plan.name);
                        return (
                          <label
                            key={plan.id}
                            className={`flex cursor-pointer items-center justify-between rounded-lg border px-3 py-2.5 transition-all hover:bg-muted/30 ${
                              isEnabled ? "border-primary/30 bg-primary/5" : "border-transparent"
                            }`}
                          >
                            <span className="flex items-center gap-2 text-sm font-medium">
                              {isEnabled && <Check className="h-4 w-4 text-primary" />}
                              {plan.display_name || plan.name}
                            </span>
                            <Switch
                              checked={isEnabled}
                              onCheckedChange={() => togglePlan(plan.name)}
                            />
                          </label>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Roles Card */}
              <Card className="overflow-hidden border-border/60 bg-card/50 transition-all hover:border-primary/20 hover:shadow-[0_0_30px_hsl(var(--primary)/0.06)]">
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <Shield className="h-4 w-4" />
                      </span>
                      <div>
                        <CardTitle className="text-lg">Roles</CardTitle>
                        <CardDescription className="mt-0.5">
                          Assign via User Detail → Manage Roles
                        </CardDescription>
                      </div>
                    </div>
                    <Badge variant="secondary" className="shrink-0">
                      {config.roles_4opt.length} selected
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2 pt-0">
                  <div className="space-y-1">
                    {AVAILABLE_ROLES.map((role) => {
                      const isEnabled = config.roles_4opt.includes(role);
                      return (
                        <label
                          key={role}
                          className={`flex cursor-pointer items-center justify-between rounded-lg border px-3 py-2.5 transition-all hover:bg-muted/30 ${
                            isEnabled ? "border-primary/30 bg-primary/5" : "border-transparent"
                          }`}
                        >
                          <span className="flex items-center gap-2 text-sm font-medium">
                            {isEnabled && <Check className="h-4 w-4 text-primary" />}
                            {ROLE_LABELS[role]}
                          </span>
                          <Switch
                            checked={isEnabled}
                            onCheckedChange={() => toggleRole(role)}
                          />
                        </label>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Action bar - sticky with highlight when there are unsaved changes */}
            <div
              className={`flex flex-wrap items-center justify-between gap-4 rounded-xl border px-4 py-3 transition-all ${
                hasChanges
                  ? "sticky bottom-4 z-10 border-primary/30 bg-card/95 shadow-lg backdrop-blur-sm"
                  : "border-border/40 bg-muted/20"
              }`}
            >
              <p className="text-sm text-muted-foreground">
                {hasChanges ? "Unsaved changes" : "No changes to save"}
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleReset} disabled={!hasChanges}>
                  <RotateCcw className="mr-1.5 h-4 w-4" />
                  Reset
                </Button>
                <Button
                  size="sm"
                  onClick={handleSave}
                  disabled={!hasChanges || saveMutation.isPending}
                >
                  {saveMutation.isPending ? (
                    <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="mr-1.5 h-4 w-4" />
                  )}
                  Save
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function TaskAccess4Opt() {
  return (
    <AdminErrorBoundary>
      <TaskAccess4OptContent />
    </AdminErrorBoundary>
  );
}
