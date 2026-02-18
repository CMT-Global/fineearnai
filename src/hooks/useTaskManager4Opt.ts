import { useEffect, useState } from "react";
import { useAuth } from "./useAuth";
import { supabase } from "@/integrations/supabase/client";

/**
 * Returns true if the user has admin or task_manager_4opt role.
 * Used to conditionally show 4-option task management pages in the admin sidebar.
 */
export const useTaskManager4Opt = () => {
  const { user, loading: authLoading } = useAuth();
  const [canManage4Opt, setCanManage4Opt] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkRole = async () => {
      if (!user) {
        setCanManage4Opt(false);
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .in("role", ["admin", "task_manager_4opt"])
          .limit(1)
          .maybeSingle();

        if (error) {
          console.error("Error checking 4-opt task manager role:", error);
          setCanManage4Opt(false);
        } else {
          setCanManage4Opt(!!data);
        }
      } catch (err) {
        console.error("Error checking 4-opt task manager role:", err);
        setCanManage4Opt(false);
      } finally {
        setLoading(false);
      }
    };

    if (!authLoading) {
      checkRole();
    }
  }, [user, authLoading]);

  return { canManage4Opt, loading: authLoading || loading };
};
