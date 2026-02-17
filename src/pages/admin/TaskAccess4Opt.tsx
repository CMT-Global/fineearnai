import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminBreadcrumb } from "@/components/admin/AdminBreadcrumb";
import { AdminErrorBoundary } from "@/components/admin/AdminErrorBoundary";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Zap, Loader2 } from "lucide-react";
import { PageLoading } from "@/components/shared/PageLoading";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
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
  trainee_4opt: "4-Option Tasks role (assign via User Detail → Manage Roles for specific users)",
};

const AVAILABLE_ROLES = ["admin", "moderator", "user", "trainee_4opt"] as const;

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
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-3xl mx-auto">
        <AdminBreadcrumb
          items={[
            { label: t("admin.sidebar.categories.taskManagement") },
            { label: "4-Option Access Control" },
          ]}
        />

        <div className="mb-6">
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Zap className="h-8 w-8" />
            4-Option Access Control
          </h1>
          <p className="text-muted-foreground mt-1">
            Configure which membership plans and roles get 4-option AI tasks. Users on enabled plans
            or with enabled roles see 4-option questions instead of 2-option on the Tasks page. No
            user list—access is controlled by plan and role rules.
          </p>
        </div>

        {isLoading ? (
          <PageLoading text="Loading..." />
        ) : (
          <div className="space-y-6">
            {/* Membership Plans */}
            <Card>
              <CardHeader>
                <CardTitle>Membership Plans with 4-Option Access</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Users on these plans automatically see 4-option tasks.
                </p>
              </CardHeader>
              <CardContent className="space-y-3">
                {!plans?.length ? (
                  <p className="text-muted-foreground text-sm">No active membership plans.</p>
                ) : (
                  plans.map((plan: { id: string; name: string; display_name?: string }) => (
                    <div key={plan.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`plan-${plan.id}`}
                        checked={config.plans_4opt.includes(plan.name)}
                        onCheckedChange={() => togglePlan(plan.name)}
                      />
                      <Label
                        htmlFor={`plan-${plan.id}`}
                        className="text-sm font-normal cursor-pointer"
                      >
                        {plan.display_name || plan.name}
                      </Label>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            {/* Roles */}
            <Card>
              <CardHeader>
                <CardTitle>Roles with 4-Option Access</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Users with these roles get 4-option tasks. Assign roles via User Detail → Manage
                  Roles.
                </p>
              </CardHeader>
              <CardContent className="space-y-3">
                {AVAILABLE_ROLES.map((role) => (
                  <div key={role} className="flex items-center space-x-2">
                    <Checkbox
                      id={`role-${role}`}
                      checked={config.roles_4opt.includes(role)}
                      onCheckedChange={() => toggleRole(role)}
                    />
                    <Label
                      htmlFor={`role-${role}`}
                      className="text-sm font-normal cursor-pointer"
                    >
                      {ROLE_LABELS[role]}
                    </Label>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Actions */}
            <div className="flex gap-2">
              <Button onClick={handleSave} disabled={!hasChanges || saveMutation.isPending}>
                {saveMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Save
              </Button>
              <Button variant="outline" onClick={handleReset} disabled={!hasChanges}>
                Reset
              </Button>
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
