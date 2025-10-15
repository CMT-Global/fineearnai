import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAdmin } from "@/hooks/useAdmin";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { AdminBreadcrumb } from "@/components/admin/AdminBreadcrumb";
import { Plus, Edit, Trash2, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

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
}

const AITasksManage = () => {
  const { isAdmin, loading: adminLoading } = useAdmin();
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

  useEffect(() => {
    if (isAdmin) {
      loadTasks();
    }
  }, [isAdmin]);

  const loadTasks = async () => {
    try {
      const { data, error } = await supabase
        .from("ai_tasks")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setTasks(data || []);
    } catch (error) {
      console.error("Error loading tasks:", error);
      toast.error("Failed to load tasks");
    } finally {
      setLoading(false);
    }
  };

  const toggleTaskStatus = async (taskId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from("ai_tasks")
        .update({ is_active: !currentStatus })
        .eq("id", taskId);

      if (error) throw error;

      toast.success(currentStatus ? "Task deactivated" : "Task activated");
      loadTasks();
    } catch (error) {
      console.error("Error toggling task status:", error);
      toast.error("Failed to update task status");
    }
  };

  const deleteTask = async (taskId: string) => {
    if (!confirm("Are you sure you want to delete this task?")) return;

    try {
      const { error } = await supabase
        .from("ai_tasks")
        .delete()
        .eq("id", taskId);

      if (error) throw error;

      toast.success("Task deleted");
      loadTasks();
    } catch (error) {
      console.error("Error deleting task:", error);
      toast.error("Failed to delete task");
    }
  };

  const filteredTasks = tasks.filter((task) => {
    if (categoryFilter !== "all" && task.category !== categoryFilter) return false;
    if (difficultyFilter !== "all" && task.difficulty !== difficultyFilter) return false;
    if (statusFilter === "active" && !task.is_active) return false;
    if (statusFilter === "inactive" && task.is_active) return false;
    return true;
  });

  const categories = Array.from(new Set(tasks.map(t => t.category)));

  if (adminLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  if (!isAdmin) return null;

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="container mx-auto">
        <AdminBreadcrumb 
          items={[
            { label: "Task Management" },
            { label: "Manage AI Tasks" }
          ]} 
        />
        
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold">AI Task Management</h1>
            <p className="text-muted-foreground mt-1">
              Manage all AI training tasks ({filteredTasks.length} tasks)
            </p>
          </div>
          <Button onClick={() => navigate("/admin/tasks/generate")}>
            <Plus className="h-4 w-4 mr-2" />
            Generate Tasks
          </Button>
        </div>

        {/* Filters */}
        <Card className="p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Category</label>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Difficulty</label>
              <Select value={difficultyFilter} onValueChange={setDifficultyFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Difficulties</SelectItem>
                  <SelectItem value="easy">Easy</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="hard">Hard</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Status</label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </Card>

        {/* Task List */}
        <div className="space-y-4">
          {filteredTasks.map((task) => (
            <Card key={task.id} className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="secondary">{task.category}</Badge>
                    <Badge variant="outline">{task.difficulty}</Badge>
                    <Badge variant={task.is_active ? "default" : "secondary"}>
                      {task.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                  <p className="text-lg font-semibold mb-3">{task.prompt}</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className={`p-3 rounded-lg border ${task.correct_response === 'a' ? 'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800' : 'bg-muted'}`}>
                      <p className="text-sm font-medium mb-1">Option A:</p>
                      <p className="text-sm">{task.response_a}</p>
                    </div>
                    <div className={`p-3 rounded-lg border ${task.correct_response === 'b' ? 'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800' : 'bg-muted'}`}>
                      <p className="text-sm font-medium mb-1">Option B:</p>
                      <p className="text-sm">{task.response_b}</p>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 ml-4">
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={() => toggleTaskStatus(task.id, task.is_active)}
                  >
                    {task.is_active ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={() => deleteTask(task.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Created: {new Date(task.created_at).toLocaleString()}
              </p>
            </Card>
          ))}

          {filteredTasks.length === 0 && (
            <Card className="p-12 text-center">
              <p className="text-muted-foreground">No tasks found</p>
              <Button
                className="mt-4"
                onClick={() => navigate("/admin/tasks/generate")}
              >
                Generate Your First Tasks
              </Button>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default AITasksManage;