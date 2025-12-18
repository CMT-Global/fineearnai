import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, TrendingUp, Target, Award, Users } from "lucide-react";
import { toast } from "sonner";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

interface TaskStats {
  totalTasks: number;
  totalCompletions: number;
  overallAccuracy: number;
  categoryStats: Array<{
    category: string;
    total: number;
    completed: number;
    accuracy: number;
  }>;
  difficultyStats: Array<{
    difficulty: string;
    total: number;
    completed: number;
    accuracy: number;
  }>;
  popularTasks: Array<{
    id: string;
    prompt: string;
    category: string;
    completion_count: number;
    accuracy: number;
  }>;
  topPerformers: Array<{
    username: string;
    total_completed: number;
    accuracy: number;
    total_earned: number;
  }>;
}

const COLORS = ["#B9F94D", "#C9F158", "#56CCF2", "#F2C94C", "#EB5757", "#9DB8B1"];

const TaskAnalytics = () => {
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdmin();
  const navigate = useNavigate();
  const [stats, setStats] = useState<TaskStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/login");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!adminLoading && !isAdmin) {
      toast.error("Access denied. Admin privileges required.");
      navigate("/dashboard");
    }
  }, [isAdmin, adminLoading, navigate]);

  useEffect(() => {
    if (isAdmin) {
      loadAnalytics();
    }
  }, [isAdmin]);

  const loadAnalytics = async () => {
    try {
      setLoading(true);

      // Get total tasks
      const { count: totalTasks } = await supabase
        .from("ai_tasks")
        .select("*", { count: "exact", head: true })
        .eq("is_active", true);

      // Get all completions with task details
      const { data: completionsData } = await supabase
        .from("task_completions")
        .select(`
          is_correct,
          earnings_amount,
          task_id,
          user_id,
          ai_tasks!inner (
            category,
            difficulty
          ),
          profiles!inner (
            username
          )
        `);

      const totalCompletions = completionsData?.length || 0;
      const correctCompletions =
        completionsData?.filter((c) => c.is_correct).length || 0;
      const overallAccuracy =
        totalCompletions > 0 ? (correctCompletions / totalCompletions) * 100 : 0;

      // Category stats
      const categoryMap = new Map<string, { total: number; correct: number }>();
      completionsData?.forEach((c: any) => {
        const category = c.ai_tasks?.category || "Unknown";
        const current = categoryMap.get(category) || { total: 0, correct: 0 };
        current.total++;
        if (c.is_correct) current.correct++;
        categoryMap.set(category, current);
      });

      const categoryStats = Array.from(categoryMap.entries()).map(([category, stats]) => ({
        category,
        total: stats.total,
        completed: stats.total,
        accuracy: stats.total > 0 ? (stats.correct / stats.total) * 100 : 0,
      }));

      // Difficulty stats
      const difficultyMap = new Map<string, { total: number; correct: number }>();
      completionsData?.forEach((c: any) => {
        const difficulty = c.ai_tasks?.difficulty || "Unknown";
        const current = difficultyMap.get(difficulty) || { total: 0, correct: 0 };
        current.total++;
        if (c.is_correct) current.correct++;
        difficultyMap.set(difficulty, current);
      });

      const difficultyStats = Array.from(difficultyMap.entries()).map(
        ([difficulty, stats]) => ({
          difficulty,
          total: stats.total,
          completed: stats.total,
          accuracy: stats.total > 0 ? (stats.correct / stats.total) * 100 : 0,
        })
      );

      // Popular tasks
      const taskCompletionMap = new Map<string, any>();
      completionsData?.forEach((c: any) => {
        const taskId = c.task_id;
        const current = taskCompletionMap.get(taskId) || {
          count: 0,
          correct: 0,
          category: c.ai_tasks?.category,
        };
        current.count++;
        if (c.is_correct) current.correct++;
        taskCompletionMap.set(taskId, current);
      });

      const popularTasksData = await Promise.all(
        Array.from(taskCompletionMap.entries())
          .sort(([, a], [, b]) => b.count - a.count)
          .slice(0, 5)
          .map(async ([taskId, data]) => {
            const { data: taskData } = await supabase
              .from("ai_tasks")
              .select("prompt")
              .eq("id", taskId)
              .single();

            return {
              id: taskId,
              prompt: taskData?.prompt || "Unknown",
              category: data.category,
              completion_count: data.count,
              accuracy: data.count > 0 ? (data.correct / data.count) * 100 : 0,
            };
          })
      );

      // Top performers
      const userStatsMap = new Map<
        string,
        { username: string; total: number; correct: number; earned: number }
      >();
      completionsData?.forEach((c: any) => {
        const userId = c.user_id;
        const username = c.profiles?.username || "Unknown";
        const current = userStatsMap.get(userId) || {
          username,
          total: 0,
          correct: 0,
          earned: 0,
        };
        current.total++;
        if (c.is_correct) current.correct++;
        current.earned += parseFloat(String(c.earnings_amount || 0));
        userStatsMap.set(userId, current);
      });

      const topPerformers = Array.from(userStatsMap.values())
        .map((stats) => ({
          username: stats.username,
          total_completed: stats.total,
          accuracy: stats.total > 0 ? (stats.correct / stats.total) * 100 : 0,
          total_earned: stats.earned,
        }))
        .sort((a, b) => b.total_completed - a.total_completed)
        .slice(0, 5);

      setStats({
        totalTasks: totalTasks || 0,
        totalCompletions,
        overallAccuracy,
        categoryStats,
        difficultyStats,
        popularTasks: popularTasksData,
        topPerformers,
      });
    } catch (error: any) {
      console.error("Error loading analytics:", error);
      toast.error("Failed to load task analytics");
    } finally {
      setLoading(false);
    }
  };

  if (authLoading || adminLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <LoadingSpinner size="lg" text="Loading analytics..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <Button variant="ghost" onClick={() => navigate("/admin")} className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Admin
          </Button>

          <h1 className="text-3xl font-bold mb-2">Task Analytics Dashboard</h1>
          <p className="text-muted-foreground">
            Comprehensive insights into task performance and user engagement
          </p>
        </div>

        {/* Overview Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Active Tasks
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="text-2xl font-bold">{stats?.totalTasks || 0}</div>
                <Target className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Completions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="text-2xl font-bold">{stats?.totalCompletions || 0}</div>
                <TrendingUp className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Overall Accuracy
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="text-2xl font-bold">
                  {stats?.overallAccuracy.toFixed(1) || 0}%
                </div>
                <Award className="h-8 w-8 text-yellow-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Active Users
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="text-2xl font-bold">{stats?.topPerformers.length || 0}</div>
                <Users className="h-8 w-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Category Performance */}
          <Card>
            <CardHeader>
              <CardTitle>Completion Rates by Category</CardTitle>
              <CardDescription>Task completions across different categories</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={stats?.categoryStats || []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="category" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="completed" fill="#B9F94D" name="Completions" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Difficulty Distribution */}
          <Card>
            <CardHeader>
              <CardTitle>Difficulty Distribution</CardTitle>
              <CardDescription>Task difficulty breakdown</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={stats?.difficultyStats || []}
                    dataKey="completed"
                    nameKey="difficulty"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label
                  >
                    {stats?.difficultyStats.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: "#123630", border: "none", borderRadius: "8px", color: "#EAF4F2" }} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Accuracy by Category */}
          <Card>
            <CardHeader>
              <CardTitle>Accuracy Rates by Category</CardTitle>
              <CardDescription>User accuracy across categories</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={stats?.categoryStats || []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="category" />
                  <YAxis />
                  <Tooltip contentStyle={{ backgroundColor: "#123630", border: "none", borderRadius: "8px", color: "#EAF4F2" }} />
                  <Legend />
                  <Bar dataKey="accuracy" fill="#C9F158" name="Accuracy %" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Accuracy by Difficulty */}
          <Card>
            <CardHeader>
              <CardTitle>Accuracy Rates by Difficulty</CardTitle>
              <CardDescription>Success rates across difficulty levels</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={stats?.difficultyStats || []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="difficulty" />
                  <YAxis />
                  <Tooltip contentStyle={{ backgroundColor: "#123630", border: "none", borderRadius: "8px", color: "#EAF4F2" }} />
                  <Legend />
                  <Bar dataKey="accuracy" fill="#56CCF2" name="Accuracy %" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Popular Tasks */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Most Popular Tasks</CardTitle>
            <CardDescription>Tasks with highest completion counts</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {stats?.popularTasks.map((task, index) => (
                <div key={task.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-4">
                    <Badge variant="outline" className="text-lg font-bold">
                      #{index + 1}
                    </Badge>
                    <div>
                      <div className="font-medium line-clamp-1">{task.prompt}</div>
                      <div className="text-sm text-muted-foreground">
                        <Badge variant="secondary" className="mr-2">
                          {task.category}
                        </Badge>
                        {task.completion_count} completions
                      </div>
                    </div>
                  </div>
                  <Badge
                    variant={task.accuracy >= 75 ? "default" : "secondary"}
                    className="text-base"
                  >
                    {task.accuracy.toFixed(1)}% accuracy
                  </Badge>
                </div>
              ))}
              {stats?.popularTasks.length === 0 && (
                <p className="text-center text-muted-foreground">No task data available</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Top Performers */}
        <Card>
          <CardHeader>
            <CardTitle>Top Performing Users</CardTitle>
            <CardDescription>Users with most task completions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {stats?.topPerformers.map((user, index) => (
                <div key={user.username} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-4">
                    <Badge variant="outline" className="text-lg font-bold">
                      #{index + 1}
                    </Badge>
                    <div>
                      <div className="font-medium">{user.username}</div>
                      <div className="text-sm text-muted-foreground">
                        {user.total_completed} tasks completed • ${user.total_earned.toFixed(2)} earned
                      </div>
                    </div>
                  </div>
                  <Badge
                    variant={user.accuracy >= 75 ? "default" : "secondary"}
                    className="text-base"
                  >
                    {user.accuracy.toFixed(1)}% accuracy
                  </Badge>
                </div>
              ))}
              {stats?.topPerformers.length === 0 && (
                <p className="text-center text-muted-foreground">No user data available</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default TaskAnalytics;
