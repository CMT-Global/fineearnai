import { useEffect, useState } from "react";
import { useAuth } from "./useAuth";
import { supabase } from "@/integrations/supabase/client";

interface Task4OptAccessConfig {
  plans_4opt: string[];
  roles_4opt: string[];
}

/**
 * Returns true if the current user has 4-option task access based on:
 * - membership plan (if profile.membership_plan is in config.plans_4opt)
 * - role (if user has any role in config.roles_4opt, e.g. trainee_4opt)
 */
export const useTrainee4Opt = () => {
  const { user, loading: authLoading } = useAuth();
  const [has4OptAccess, setHas4OptAccess] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const check4OptAccess = async () => {
      if (!user) {
        setHas4OptAccess(false);
        setLoading(false);
        return;
      }

      try {
        const [configRes, profileRes, rolesRes] = await Promise.all([
          supabase
            .from("platform_config")
            .select("value")
            .eq("key", "task_4opt_access_config")
            .maybeSingle(),
          supabase
            .from("profiles")
            .select("membership_plan")
            .eq("id", user.id)
            .maybeSingle(),
          supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", user.id),
        ]);

        const config = (configRes.data?.value as Task4OptAccessConfig) || {
          plans_4opt: [],
          roles_4opt: ["trainee_4opt"],
        };
        const plan = profileRes.data?.membership_plan as string | undefined;
        const roles = (rolesRes.data?.map((r: { role: string }) => r.role) || []) as string[];

        const byPlan =
          config.plans_4opt?.length > 0 &&
          plan &&
          config.plans_4opt.includes(plan);
        const byRole =
          config.roles_4opt?.length > 0 &&
          config.roles_4opt.some((r) => roles.includes(r));

        setHas4OptAccess(!!(byPlan || byRole));
      } catch (err) {
        console.error("Error checking 4-opt access:", err);
        setHas4OptAccess(false);
      } finally {
        setLoading(false);
      }
    };

    if (!authLoading) {
      check4OptAccess();
    }
  }, [user, authLoading]);

  return { has4OptAccess, loading: authLoading || loading };
};
