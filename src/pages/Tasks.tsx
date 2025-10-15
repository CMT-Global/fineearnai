import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";
import { supabase } from "@/integrations/supabase/client";
import { Sidebar } from "@/components/layout/Sidebar";
import { TaskStats } from "@/components/tasks/TaskStats";
import { TaskInterface } from "@/components/tasks/TaskInterface";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Info, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface AITask {
  id: string;
  prompt: string;
  response_a: string;
  response_b: string;
  category: string;
  difficulty: string;
  reward: number;
}

interface UserStats {
  username: string;
  tasksCompletedToday: number;
  dailyLimit: number;
  remainingTasks: number;
  earningsBalance: number;
  depositBalance: number;
  totalEarned: number;
  skipsToday: number;
  skipLimit: number;
  remainingSkips: number;
  membershipPlan: string;
  planExpiresAt: string | null;
}

interface Feedback {
  isCorrect: boolean;
  correctAnswer: string;
  earnedAmount: number;
  newBalance: number;
}

const Tasks = () => {
  const { user, loading, signOut } = useAuth();
  const { isAdmin } = useAdmin();
  const navigate = useNavigate();

  // State management - single task approach
  const [profile, setProfile] = useState<any>(null);
  const [currentTask, setCurrentTask] = useState<AITask | null>(null);
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [selectedResponse, setSelectedResponse] = useState<string>("");
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [startTime] = useState<number>(Date.now());

  // Redirect if not authenticated
  useEffect(() => {
    if (!loading && !user) {
      navigate("/login");
    }
  }, [user, loading, navigate]);

  // Load profile and initial task
  useEffect(() => {
    if (user) {
      loadProfileAndTask();
    }
  }, [user]);

  /**
   * Load user profile and fetch next task using the new edge function
   */
  const loadProfileAndTask = async () => {
    setIsLoading(true);
    try {
      // Load basic profile for sidebar
      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user?.id)
        .single();

      if (profileData) {
        setProfile(profileData);
      }

      // Fetch next task using the optimized edge function
      await loadNextTask();
    } catch (error) {
      console.error("Error loading data:", error);
      toast.error("Failed to load tasks");
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Load next available task using get-next-task edge function
   * This replaces 5-7 sequential queries with a single optimized call
   */
  const loadNextTask = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("get-next-task");

      if (error) {
        console.error("Error fetching next task:", error);
        
        // Handle specific error cases
        if (error.message?.includes("daily_limit_reached")) {
          toast.error("Daily task limit reached!", {
            description: "Upgrade your plan to complete more tasks per day",
          });
          navigate("/membership");
          return;
        }

        if (error.message?.includes("plan_expired")) {
          toast.error("Your membership plan has expired", {
            description: "Please upgrade to continue completing tasks",
          });
          navigate("/membership");
          return;
        }

        if (error.message?.includes("no_tasks_available")) {
          toast.info("No more tasks available", {
            description: "Please check back later for new tasks",
          });
          setCurrentTask(null);
          return;
        }

        toast.error("Failed to load task");
        return;
      }

      if (!data.success || !data.task) {
        toast.info("No tasks available at the moment");
        setCurrentTask(null);
        return;
      }

      // Update state with task and user stats
      setCurrentTask(data.task);
      setUserStats(data.userStats);
      setSelectedResponse("");
      setFeedback(null);

      console.log("Loaded task:", data.task.id);
    } catch (error: any) {
      console.error("Unexpected error loading task:", error);
      toast.error(error.message || "Failed to load task");
    }
  };

  /**
   * Handle skip task functionality
   */
  const handleSkipTask = async () => {
    if (!userStats) return;

    // Check skip limit
    if (userStats.skipsToday >= userStats.skipLimit) {
      toast.error("Daily skip limit reached!");
      return;
    }

    try {
      // Update skip count in profile
      const { error } = await supabase
        .from("profiles")
        .update({ skips_today: userStats.skipsToday + 1 })
        .eq("id", user?.id);

      if (error) throw error;

      toast.info("Task skipped");
      
      // Load next task immediately
      await loadNextTask();
    } catch (error: any) {
      console.error("Error skipping task:", error);
      toast.error(error.message || "Failed to skip task");
    }
  };

  /**
   * Handle task submission
   */
  const handleSubmitAnswer = async (response: string) => {
    if (!currentTask) return;

    setIsSubmitting(true);
    const timeTaken = Math.floor((Date.now() - startTime) / 1000);

    try {
      const { data, error } = await supabase.functions.invoke("complete-ai-task", {
        body: {
          taskId: currentTask.id,
          selectedResponse: response,
          timeTakenSeconds: timeTaken,
        },
      });

      if (error) throw error;

      // Show feedback
      setFeedback(data);

      if (data.isCorrect) {
        toast.success(`Correct! You earned $${data.earnedAmount.toFixed(2)}`);
      } else {
        toast.error("Incorrect answer");
      }

      // Update user stats with new values
      if (userStats) {
        setUserStats({
          ...userStats,
          tasksCompletedToday: data.tasksCompletedToday,
          remainingTasks: userStats.dailyLimit - data.tasksCompletedToday,
          earningsBalance: data.newBalance,
        });
      }

      // Auto-load next task after 3 seconds
      setTimeout(() => {
        setFeedback(null);
        setSelectedResponse("");
        loadNextTask();
        setIsSubmitting(false);
      }, 3000);
    } catch (error: any) {
      console.error("Error submitting answer:", error);
      toast.error(error.message || "Failed to submit answer");
      setIsSubmitting(false);
    }
  };

  // Loading state
  if (loading || isLoading || !profile) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading tasks...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col lg:flex-row">
      <Sidebar profile={profile} isAdmin={isAdmin} onSignOut={signOut} />

      <main className="flex-1 overflow-auto lg:mt-0 mt-16">
        {/* Header */}
        <header className="bg-card border-b px-4 lg:px-8 py-6">
          <div>
            <h1 className="text-2xl font-bold">AI Training Tasks</h1>
            <p className="text-muted-foreground">
              Complete tasks to earn money and help train AI
            </p>
          </div>
        </header>

        {/* Main Content */}
        <div className="p-4 lg:p-8 max-w-5xl mx-auto">
          {/* AI Training Explanation Alert */}
          <Alert className="mb-6">
            <Info className="h-4 w-4" />
            <AlertDescription>
              <strong>Understanding AI Training:</strong> The 'correct' response for these
              tasks is determined by the collective analysis and consensus of many human
              evaluators, not by pre-existing AI knowledge. Your contributions are vital for
              refining and advancing AI models.
            </AlertDescription>
          </Alert>

          {/* Stats Cards */}
          {userStats && (
            <TaskStats
              tasksCompletedToday={userStats.tasksCompletedToday}
              dailyLimit={userStats.dailyLimit}
              remainingTasks={userStats.remainingTasks}
              earningsBalance={userStats.earningsBalance}
            />
          )}

          {/* Task Interface or No Tasks Message */}
          {currentTask ? (
            <TaskInterface
              task={currentTask}
              onSubmit={handleSubmitAnswer}
              onSkip={handleSkipTask}
              isSubmitting={isSubmitting}
              feedback={feedback}
              selectedResponse={selectedResponse}
              onResponseChange={setSelectedResponse}
            />
          ) : (
            <div className="text-center py-12">
              <p className="text-lg text-muted-foreground mb-4">
                No tasks available at the moment
              </p>
              <p className="text-sm text-muted-foreground">
                Please check back later or upgrade your plan for more tasks
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default Tasks;
