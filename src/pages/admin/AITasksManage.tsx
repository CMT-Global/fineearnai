import { useEffect, useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAdmin } from "@/hooks/useAdmin";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { AdminBreadcrumb } from "@/components/admin/AdminBreadcrumb";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Plus, Edit, Trash2, Eye, EyeOff, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useTranslation } from "react-i18next";
import { useLanguageSync } from "@/hooks/useLanguageSync";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { cn } from "@/lib/utils";

interface AITask {
  id: string;
  prompt: string;
  response_a: string;
  response_b: string;
  correct_response: string;
  category: string;
  difficulty: string;
  is_active: boolean;
  created_at: string;
  created_by: string | null;
}

const AITasksManage = () => {
  const { t } = useTranslation();
  const { languageKey } = useLanguageSync(); // Use languageKey to ensure re-render on language change
  const { isAdmin, loading: adminLoading } = useAdmin();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<AITask[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [difficultyFilter, setDifficultyFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  useEffect(() => {
    if (!adminLoading && !isAdmin) {
      navigate("/");
    }
  }, [isAdmin, adminLoading, navigate]);

  const loadTasks = useCallback(async () => {
    if (!user) {
      console.log("No user available, skipping task load");
      setLoading(false);
      return;
    }

    try {
      console.log("Loading tasks for user:", user.id);
      
      const query = supabase
        .from("ai_tasks")
        .select("*")
        .eq("created_by", user.id)
        .order("created_at", { ascending: false });
      
      const { data, error } = await query;

      if (error) {
        console.error("Query error details:", error);
        throw error;
      }
      
      setTasks(data || []);
    } catch (error) {
      console.error("Error loading tasks:", error);
      toast.error(t("admin.aiTasksManage.errorFailedToLoad"));
    } finally {
      setLoading(false);
    }
  }, [user, t]);

  useEffect(() => {
    if (isAdmin && user && !authLoading) {
      loadTasks();
    }
  }, [isAdmin, user, authLoading, loadTasks]);

  const toggleTaskStatus = async (taskId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from("ai_tasks")
        .update({ is_active: !currentStatus })
        .eq("id", taskId);

      if (error) throw error;

      toast.success(currentStatus ? t("admin.aiTasksManage.taskDeactivated") : t("admin.aiTasksManage.taskActivated"));
      loadTasks();
    } catch (error) {
      console.error("Error toggling task status:", error);
      toast.error(t("admin.aiTasksManage.errorFailedToUpdateStatus"));
    }
  };

  const deleteTask = async (taskId: string) => {
    if (!confirm(t("admin.aiTasksManage.confirmDelete"))) return;

    try {
      const { error } = await supabase
        .from("ai_tasks")
        .delete()
        .eq("id", taskId);

      if (error) throw error;

      toast.success(t("admin.aiTasksManage.taskDeleted"));
      loadTasks();
    } catch (error) {
      console.error("Error deleting task:", error);
      toast.error(t("admin.aiTasksManage.errorFailedToDelete"));
    }
  };

  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      if (categoryFilter !== "all" && task.category !== categoryFilter) return false;
      if (difficultyFilter !== "all" && task.difficulty !== difficultyFilter) return false;
      if (statusFilter === "active" && !task.is_active) return false;
      if (statusFilter === "inactive" && task.is_active) return false;
      return true;
    });
  }, [tasks, categoryFilter, difficultyFilter, statusFilter]);

  const categories = useMemo(() => {
    return Array.from(new Set(tasks.map(t => t.category)))
      .filter(Boolean)
      .sort();
  }, [tasks]);

  if (adminLoading || loading || authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <LoadingSpinner size="lg" text={t("common.loading")} />
      </div>
    );
  }

  if (!isAdmin) return null;

  return (
    <div key={languageKey} className="p-6">
      <div className="container-custom">
        <AdminBreadcrumb 
          items={[
            { label: t("admin.sidebar.categories.taskManagement") },
            { label: t("admin.sidebar.items.manageAITasks") }
          ]} 
        />
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold">{t("admin.aiTasksManage.title")}</h1>
            <p className="text-muted-foreground mt-1">
              {t("admin.aiTasksManage.subtitle", { count: filteredTasks.length })}
            </p>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={() => {
                setLoading(true);
                loadTasks();
              }}
              disabled={loading || !user}
            >
              <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
              {t("common.refresh")}
            </Button>
            <Button onClick={() => navigate("/admin/tasks/generate")}>
              <Plus className="h-4 w-4 mr-2" />
              {t("admin.aiTasksManage.generateTasks")}
            </Button>
          </div>
        </div>

        {/* Filters */}
        <Card className="p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">{t("admin.aiTasksManage.category")}</label>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger>
                  <SelectValue placeholder={t("admin.aiTasksManage.allCategories")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("admin.aiTasksManage.allCategories")}</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">{t("admin.aiTasksManage.difficulty")}</label>
              <Select value={difficultyFilter} onValueChange={setDifficultyFilter}>
                <SelectTrigger>
                  <SelectValue placeholder={t("admin.aiTasksManage.allDifficulties")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("admin.aiTasksManage.allDifficulties")}</SelectItem>
                  <SelectItem value="easy">{t("admin.aiTasksManage.easy")}</SelectItem>
                  <SelectItem value="medium">{t("admin.aiTasksManage.medium")}</SelectItem>
                  <SelectItem value="hard">{t("admin.aiTasksManage.hard")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">{t("admin.aiTasksManage.status")}</label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder={t("admin.aiTasksManage.allStatus")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("admin.aiTasksManage.allStatus")}</SelectItem>
                  <SelectItem value="active">{t("admin.aiTasksManage.active")}</SelectItem>
                  <SelectItem value="inactive">{t("admin.aiTasksManage.inactive")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </Card>

        {/* Task List */}
        <div className="space-y-4">
          {filteredTasks.map((task) => (
            <Card key={task.id} className="p-6">
              <div className="flex flex-col lg:flex-row justify-between items-start gap-4 mb-4">
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <Badge variant="secondary">{task.category}</Badge>
                    <Badge variant="outline">{task.difficulty}</Badge>
                    <Badge variant={task.is_active ? "default" : "secondary"}>
                      {task.is_active ? t("admin.aiTasksManage.active") : t("admin.aiTasksManage.inactive")}
                    </Badge>
                  </div>
                  <p className="text-lg font-semibold mb-3">{task.prompt}</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className={cn(
                      "p-4 rounded-lg border-2",
                      task.correct_response === 'a' 
                        ? 'bg-green-200 dark:bg-green-800/30 border-green-500 dark:border-green-500/50' 
                        : 'bg-white dark:bg-gray-800/50 border-gray-300 dark:border-gray-700'
                    )}>
                      <p className={cn(
                        "text-sm font-semibold mb-2",
                        task.correct_response === 'a' 
                          ? 'text-green-950 dark:text-green-50' 
                          : 'text-gray-900 dark:text-gray-50'
                      )}>
                        {t("admin.aiTasksManage.optionA")}
                      </p>
                      <p className={cn(
                        "text-base font-medium",
                        task.correct_response === 'a' 
                          ? 'text-green-950 dark:text-green-50' 
                          : 'text-gray-900 dark:text-gray-50'
                      )}>
                        {task.response_a}
                      </p>
                    </div>
                    <div className={cn(
                      "p-4 rounded-lg border-2",
                      task.correct_response === 'b' 
                        ? 'bg-green-200 dark:bg-green-800/30 border-green-500 dark:border-green-500/50' 
                        : 'bg-white dark:bg-gray-800/50 border-gray-300 dark:border-gray-700'
                    )}>
                      <p className={cn(
                        "text-sm font-semibold mb-2",
                        task.correct_response === 'b' 
                          ? 'text-green-950 dark:text-green-50' 
                          : 'text-gray-900 dark:text-gray-50'
                      )}>
                        {t("admin.aiTasksManage.optionB")}
                      </p>
                      <p className={cn(
                        "text-base font-medium",
                        task.correct_response === 'b' 
                          ? 'text-green-950 dark:text-green-50' 
                          : 'text-gray-900 dark:text-gray-50'
                      )}>
                        {task.response_b}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          size="icon"
                          variant="outline"
                          onClick={() => toggleTaskStatus(task.id, task.is_active)}
                          aria-label={task.is_active ? t("admin.aiTasksManage.deactivateTask") : t("admin.aiTasksManage.activateTask")}
                        >
                          {task.is_active ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{task.is_active ? t("admin.aiTasksManage.deactivateTask") : t("admin.aiTasksManage.activateTask")}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          size="icon"
                          variant="outline"
                          onClick={() => deleteTask(task.id)}
                          aria-label={t("admin.aiTasksManage.deleteTask")}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{t("admin.aiTasksManage.deleteTask")}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                {t("admin.aiTasksManage.created")}: {new Date(task.created_at).toLocaleString()}
              </p>
            </Card>
          ))}

          {filteredTasks.length === 0 && (
            <Card className="p-12 text-center">
              <p className="text-muted-foreground">{t("admin.aiTasksManage.noTasksFound")}</p>
              <Button
                className="mt-4"
                onClick={() => navigate("/admin/tasks/generate")}
              >
                {t("admin.aiTasksManage.generateFirstTasks")}
              </Button>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default AITasksManage;
