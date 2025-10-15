import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Sidebar } from "@/components/layout/Sidebar";
import { TaskCard } from "@/components/tasks/TaskCard";
import { 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  TrendingUp 
} from "lucide-react";
import { toast } from "sonner";

interface Task {
  id: string;
  title: string;
  description: string;
  difficulty: "easy" | "medium" | "hard";
  base_reward: number;
  time_estimate_minutes: number;
  instructions: any;
}

interface UserTask {
  id: string;
  task_id: string;
  status: string;
  assigned_at: string;
  expires_at: string;
  task: Task;
}

const Tasks = () => {
  const { user, loading, signOut } = useAuth();
  const { isAdmin } = useAdmin();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<any>(null);
  const [availableTasks, setAvailableTasks] = useState<Task[]>([]);
  const [userTasks, setUserTasks] = useState<UserTask[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/login");
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      // Load profile
      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user?.id)
        .single();

      if (profileData) {
        setProfile(profileData);
      }

      // Load available tasks
      const { data: tasksData } = await supabase
        .from("tasks")
        .select("*")
        .eq("is_active", true)
        .order("difficulty", { ascending: true });

      if (tasksData) {
        setAvailableTasks(tasksData);
      }

      // Load user's assigned tasks
      const { data: userTasksData } = await supabase
        .from("user_tasks")
        .select(`
          *,
          task:tasks(*)
        `)
        .eq("user_id", user?.id)
        .in("status", ["pending", "in_progress"])
        .order("assigned_at", { ascending: false });

      if (userTasksData) {
        setUserTasks(userTasksData);
      }
    } catch (error) {
      console.error("Error loading data:", error);
      toast.error("Failed to load tasks");
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartTask = async (taskId: string) => {
    try {
      // Get membership plan to check limits
      const { data: plan } = await supabase
        .from("membership_plans")
        .select("*")
        .eq("name", profile.membership_plan)
        .single();

      if (!plan) {
        toast.error("Unable to verify membership plan");
        return;
      }

      // Check if user has reached daily limit
      if (profile.tasks_completed_today >= plan.daily_task_limit) {
        toast.error("Daily task limit reached", {
          description: "Upgrade your plan to complete more tasks per day",
        });
        return;
      }

      // Check if user already has this task assigned
      const existingTask = userTasks.find(
        (ut) => ut.task_id === taskId && ut.status === "in_progress"
      );

      if (existingTask) {
        navigate(`/tasks/${existingTask.id}`);
        return;
      }

      // Assign new task to user
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24);

      const { data: newUserTask, error } = await supabase
        .from("user_tasks")
        .insert({
          user_id: user?.id,
          task_id: taskId,
          status: "in_progress",
          started_at: new Date().toISOString(),
          expires_at: expiresAt.toISOString(),
        })
        .select()
        .single();

      if (error) throw error;

      toast.success("Task started!");
      navigate(`/tasks/${newUserTask.id}`);
    } catch (error: any) {
      console.error("Error starting task:", error);
      toast.error(error.message || "Failed to start task");
    }
  };

  if (loading || isLoading || !profile) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col lg:flex-row">
      <Sidebar profile={profile} isAdmin={isAdmin} onSignOut={signOut} />
      
      <main className="flex-1 overflow-auto lg:mt-0 mt-16">
        {/* Header */}
        <header className="bg-card border-b px-4 lg:px-8 py-6">
          <div className="flex-1 mb-4">
            <h1 className="text-2xl font-bold">AI Training Tasks</h1>
            <p className="text-muted-foreground">
              Complete tasks to earn money and help train AI
            </p>
          </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-[hsl(var(--wallet-tasks))]/10 flex items-center justify-center">
                <CheckCircle2 className="h-5 w-5 text-[hsl(var(--wallet-tasks))]" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Today</p>
                <p className="text-xl font-bold">
                  {profile.tasks_completed_today}/{availableTasks.length}
                </p>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-[hsl(var(--wallet-earnings))]/10 flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-[hsl(var(--wallet-earnings))]" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Earnings Balance</p>
                <p className="text-xl font-bold">
                  ${parseFloat(profile.earnings_wallet_balance).toFixed(2)}
                </p>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-[hsl(var(--wallet-referrals))]/10 flex items-center justify-center">
                <Clock className="h-5 w-5 text-[hsl(var(--wallet-referrals))]" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">In Progress</p>
                <p className="text-xl font-bold">{userTasks.length}</p>
              </div>
            </div>
          </Card>
        </div>
        </header>

        {/* Main Content */}
        <div className="p-4 lg:p-8">
        {/* Active Tasks */}
        {userTasks.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-[hsl(var(--wallet-tasks))]" />
              Your Active Tasks
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {userTasks.map((userTask) => (
                <TaskCard
                  key={userTask.id}
                  title={userTask.task.title}
                  description={userTask.task.description}
                  difficulty={userTask.task.difficulty}
                  baseReward={userTask.task.base_reward}
                  timeEstimate={userTask.task.time_estimate_minutes}
                  status={userTask.status}
                  onStart={() => navigate(`/tasks/${userTask.id}`)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Available Tasks */}
        <div>
          <h2 className="text-xl font-semibold mb-4">Available Tasks</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {availableTasks.map((task) => {
              const isInProgress = userTasks.some(
                (ut) => ut.task_id === task.id
              );
              return (
                <TaskCard
                  key={task.id}
                  title={task.title}
                  description={task.description}
                  difficulty={task.difficulty}
                  baseReward={task.base_reward}
                  timeEstimate={task.time_estimate_minutes}
                  onStart={() => handleStartTask(task.id)}
                  isDisabled={isInProgress}
                />
              );
            })}
          </div>
        </div>
        </div>
      </main>
    </div>
  );
};

export default Tasks;
